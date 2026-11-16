import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_SECTIONS,
  CAPABILITY_PILLARS,
  GROWTH_STAGES,
  PROFESSIONAL_STYLES,
  QUESTION_MAP,
} from '../src/domain/assessmentContent.ts';
import {
  ASSESSMENT_VERSION,
  PART_A_CONFIG_VERSION,
  SCORING_ENGINE_VERSION,
  scoreAssessment,
  validateAllAnswers,
} from '../src/domain/scoring.ts';
import {
  DEFAULT_PART_A_SCORING_CONFIG,
  validatePartAScoringConfig,
  type PartAScoringConfig,
} from '../src/domain/scoringConfig.ts';
import {
  DEFAULT_LEAD_SEGMENTATION_CONFIG,
  evaluateLeadSegmentation,
  validateLeadSegmentationConfig,
} from '../src/domain/segmentationConfig.ts';
import type {
  AdminAnalyticsSummary,
  AdminSubmissionFilters,
  AssessmentEventRecord,
  AssessmentQuestion,
  AssessmentResult,
  AssessmentSectionId,
  AssessmentSectionMeta,
  AssessmentVersionRecord,
  AssessmentVersionSnapshot,
  CampaignAttribution,
  CampaignCostRecord,
  CampaignPerformanceItem,
  CommunicationChannel,
  CommunicationDeliveryStatus,
  CommunicationMessageRecord,
  CommunicationTemplateType,
  ConsultationRequestRecord,
  ConsultationStatus,
  CrmSyncEventRecord,
  HumanReviewCategory,
  LeadSegmentationConfig,
  PilotFeedback,
  QuestionAnalyticsItem,
  QuestionTelemetryInput,
  QuestionTelemetryRecord,
  ReportDeliveryEventRecord,
  RespondentAnswers,
  SectionDropOffItem,
  StorageBoundaryStatus,
  SubmissionCompletionStatus,
  SubmissionRecord,
} from '../src/domain/types.ts';
import {
  generateAccessToken,
  generatePrivateId,
  hashAccessToken,
  sanitizeAnswersPayload,
  sanitizeAttributionPayload,
  sanitizeIdToken,
  sanitizeMultiline,
  sanitizeSingleLine,
  sanitizeTelemetryBatch,
  verifyAccessTokenHash,
} from './security.ts';
import { buildXlsxWorkbookBuffer } from './xlsx.ts';

export class DomainConflictError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export class DomainValidationError extends Error {
  readonly code: string;
  readonly missingQuestionIds?: string[];
  constructor(
    code: string,
    message: string,
    missingQuestionIds?: string[]
  ) {
    super(message);
    this.code = code;
    this.missingQuestionIds = missingQuestionIds;
  }
}

export class DomainForbiddenError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const ALL_CONSULTATION_STATUSES: ConsultationStatus[] = [
  'requested',
  'awaiting_review',
  'approved_for_contact',
  'contact_attempted',
  'contacted',
  'scheduled',
  'completed',
  'no_response',
  'declined',
  'closed',
];

export const ALL_REVIEW_CATEGORIES: HumanReviewCategory[] = [
  'unreviewed',
  'priority_consultation',
  'potential_consultation',
  'future_opportunity',
  'market_insight',
];

export function normalizeLegacyStatus(raw: string): ConsultationStatus {
  if (raw === 'pending') return 'awaiting_review';
  if (raw === 'archived') return 'closed';
  if (ALL_CONSULTATION_STATUSES.includes(raw as ConsultationStatus)) {
    return raw as ConsultationStatus;
  }
  return 'awaiting_review';
}

const EMPTY_ANSWERS: RespondentAnswers = {
  selections: {},
  otherText: {},
  contact: {
    fullName: '',
    whatsappNumber: '',
    email: '',
    city: '',
    state: '',
    institution: '',
    whatsappConsent: false,
  },
};

function resolveDataDir(): string {
  const custom = process.env.KWS_DATA_DIR?.trim();
  if (custom) return path.resolve(custom);
  return path.resolve(process.cwd(), 'data');
}

function resolveDbPath(): string {
  const explicit = process.env.KWS_DB_PATH?.trim();
  if (explicit) {
    if (explicit === ':memory:') return explicit;
    return path.resolve(explicit);
  }
  return path.join(resolveDataDir(), 'kws_academy.db');
}

function buildVersionSnapshot(
  questions: AssessmentQuestion[] = ASSESSMENT_QUESTIONS,
  assessmentVersion = ASSESSMENT_VERSION,
  partAConfig: PartAScoringConfig = DEFAULT_PART_A_SCORING_CONFIG
): AssessmentVersionSnapshot {
  return {
    assessmentVersion,
    scoringVersion: SCORING_ENGINE_VERSION,
    partAConfigVersion: partAConfig.approved ? 'approved-v1' : PART_A_CONFIG_VERSION,
    partAConfigApproved: partAConfig.approved,
    questionIds: questions.filter((q) => q.active !== false).map((q) => q.id),
  };
}

function splitSelectionsByPart(
  answers: RespondentAnswers,
  questions: AssessmentQuestion[] = ASSESSMENT_QUESTIONS
) {
  const partA: Record<string, string> = {};
  const partB: Record<string, string> = {};
  const partC: Record<string, string> = {};
  const partD: Record<string, string> = {};
  const qById = new Map<string, AssessmentQuestion>(
    ASSESSMENT_QUESTIONS.map((q) => [q.id, q])
  );
  for (const q of questions) {
    qById.set(q.id, q);
  }

  for (const [qId, optId] of Object.entries(answers.selections)) {
    const q = qById.get(qId) ?? QUESTION_MAP[qId];
    if (!q) continue;
    if (q.sectionId === 'professional_style') partA[qId] = optId;
    else if (q.sectionId === 'growth_journey') partB[qId] = optId;
    else if (q.sectionId === 'strengths_growth') partC[qId] = optId;
    else if (q.sectionId === 'profile_next_steps') partD[qId] = optId;
  }

  return { partA, partB, partC, partD };
}

function resolveQuestionOptionLabel(
  rec: SubmissionRecord,
  questionId: string
): string {
  const optId = rec.answers.selections[questionId];
  if (!optId) return 'Unspecified';
  const label =
    QUESTION_MAP[questionId]?.options.find((o) => o.id === optId)?.label ??
    optId;
  const extra = rec.answers.otherText[questionId]?.trim();
  return extra ? `${label} (${extra})` : label;
}

export class SqliteAssessmentRepository {
  private readonly dbPath: string;
  private readonly db: DatabaseSync;
  private walEnabled = false;
  private foreignKeysEnabled = false;

  constructor(dbPath = resolveDbPath()) {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
    this.migrateLegacyJsonIfEmpty();
  }

  private initSchema(): void {
    this.db.exec('PRAGMA foreign_keys = ON;');
    const fkRow = this.db.prepare('PRAGMA foreign_keys;').get() as
      | { foreign_keys?: number }
      | undefined;
    this.foreignKeysEnabled = fkRow?.foreign_keys === 1;

    if (this.dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
      const jmRow = this.db.prepare('PRAGMA journal_mode;').get() as
        | { journal_mode?: string }
        | undefined;
      this.walEnabled = String(jmRow?.journal_mode ?? '').toLowerCase() === 'wal';
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS respondent_contacts (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL DEFAULT '',
        whatsapp_number TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL DEFAULT '',
        institution TEXT NOT NULL DEFAULT '',
        whatsapp_consent INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assessment_submissions (
        id TEXT PRIMARY KEY,
        result_token_hash TEXT NOT NULL,
        idempotency_key TEXT UNIQUE,
        submit_nonce TEXT,
        completion_status TEXT NOT NULL CHECK (completion_status IN ('in_progress', 'submitted')),
        assessment_version TEXT NOT NULL,
        scoring_version TEXT NOT NULL,
        part_a_config_version TEXT NOT NULL,
        assessment_snapshot_json TEXT NOT NULL,
        respondent_id TEXT NOT NULL REFERENCES respondent_contacts(id) ON DELETE RESTRICT,
        duration_minutes INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        submitted_at TEXT,
        raw_selections_json TEXT NOT NULL,
        raw_other_text_json TEXT NOT NULL,
        calculated_result_json TEXT,
        feedback_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_submissions_status_submitted_at
        ON assessment_submissions(completion_status, submitted_at DESC);

      CREATE TABLE IF NOT EXISTS part_a_responses (
        submission_id TEXT PRIMARY KEY REFERENCES assessment_submissions(id) ON DELETE CASCADE,
        raw_answers_json TEXT NOT NULL,
        result_status TEXT,
        pattern TEXT,
        lead_title TEXT,
        style_scores_json TEXT,
        result_json TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS part_b_responses (
        submission_id TEXT PRIMARY KEY REFERENCES assessment_submissions(id) ON DELETE CASCADE,
        raw_answers_json TEXT NOT NULL,
        scored_raw_values_json TEXT,
        unrounded_average REAL,
        rounded_stage_level INTEGER,
        spread INTEGER,
        mixed_stage_flag INTEGER,
        result_json TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS part_c_responses (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
        pillar_id TEXT NOT NULL,
        understanding_question_id TEXT NOT NULL,
        understanding_option_id TEXT NOT NULL DEFAULT '',
        understanding_score INTEGER,
        experience_question_id TEXT NOT NULL,
        experience_option_id TEXT NOT NULL DEFAULT '',
        experience_score INTEGER,
        interpretation TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL,
        UNIQUE (submission_id, pillar_id)
      );

      CREATE TABLE IF NOT EXISTS part_d_responses (
        submission_id TEXT PRIMARY KEY REFERENCES assessment_submissions(id) ON DELETE CASCADE,
        raw_answers_json TEXT NOT NULL,
        other_text_json TEXT NOT NULL,
        consultation_preference TEXT NOT NULL DEFAULT 'none',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS consultation_requests (
        id TEXT PRIMARY KEY,
        submission_id TEXT UNIQUE NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
        requested_at TEXT NOT NULL,
        preference TEXT NOT NULL CHECK (preference IN ('book', 'more_info', 'none')),
        review_category TEXT NOT NULL DEFAULT 'unreviewed',
        reviewed_at TEXT,
        reviewed_by TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN (
          'requested', 'awaiting_review', 'approved_for_contact', 'contact_attempted',
          'contacted', 'scheduled', 'completed', 'no_response', 'declined', 'closed'
        )),
        status_updated_at TEXT NOT NULL DEFAULT '',
        assigned_staff_member TEXT NOT NULL DEFAULT '',
        contact_attempts INTEGER NOT NULL DEFAULT 0,
        last_contacted_at TEXT,
        scheduled_at TEXT,
        completed_at TEXT,
        outcome_notes TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_consultation_status
        ON consultation_requests(status, requested_at DESC);

      CREATE TABLE IF NOT EXISTS campaign_attributions (
        submission_id TEXT PRIMARY KEY REFERENCES assessment_submissions(id) ON DELETE CASCADE,
        utm_source TEXT NOT NULL DEFAULT '',
        utm_medium TEXT NOT NULL DEFAULT '',
        utm_campaign TEXT NOT NULL DEFAULT '',
        utm_term TEXT NOT NULL DEFAULT '',
        utm_content TEXT NOT NULL DEFAULT '',
        ad_set TEXT NOT NULL DEFAULT '',
        creative TEXT NOT NULL DEFAULT '',
        placement TEXT NOT NULL DEFAULT '',
        referrer TEXT NOT NULL DEFAULT '',
        landing_path TEXT NOT NULL DEFAULT '',
        discovery_source_option_id TEXT NOT NULL DEFAULT '',
        discovery_source_label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assessment_events (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_events_submission
        ON assessment_events(submission_id, created_at ASC);

      CREATE TABLE IF NOT EXISTS report_delivery_events (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        recipient TEXT NOT NULL DEFAULT '',
        provider TEXT NOT NULL DEFAULT '',
        detail TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_delivery_submission
        ON report_delivery_events(submission_id, created_at ASC);

      CREATE TABLE IF NOT EXISTS question_telemetry_events (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        section_id TEXT NOT NULL DEFAULT '',
        question_id TEXT NOT NULL DEFAULT '',
        option_id TEXT NOT NULL DEFAULT '',
        previous_option_id TEXT NOT NULL DEFAULT '',
        active_time_ms INTEGER NOT NULL DEFAULT 0,
        inactive_time_ms INTEGER NOT NULL DEFAULT 0,
        wall_time_ms INTEGER NOT NULL DEFAULT 0,
        client_timestamp TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_telemetry_submission
        ON question_telemetry_events(submission_id, created_at ASC);

      CREATE INDEX IF NOT EXISTS idx_telemetry_question
        ON question_telemetry_events(question_id, event_type);

      CREATE TABLE IF NOT EXISTS campaign_costs (
        id TEXT PRIMARY KEY,
        campaign_key TEXT UNIQUE NOT NULL,
        utm_source TEXT NOT NULL DEFAULT '',
        utm_campaign TEXT NOT NULL DEFAULT '',
        currency TEXT NOT NULL DEFAULT 'NGN',
        amount_spent REAL NOT NULL DEFAULT 0,
        period_label TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assessment_versions (
        version_id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'draft', 'archived')),
        created_by TEXT NOT NULL DEFAULT 'system',
        change_summary TEXT NOT NULL DEFAULT '',
        questions_json TEXT NOT NULL,
        sections_json TEXT NOT NULL,
        part_a_config_version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        activated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS communication_messages (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
        channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
        message_type TEXT NOT NULL,
        recipient TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL DEFAULT '',
        body_preview TEXT NOT NULL DEFAULT '',
        provider TEXT NOT NULL DEFAULT 'none',
        status TEXT NOT NULL,
        external_message_id TEXT NOT NULL DEFAULT '',
        error_detail TEXT NOT NULL DEFAULT '',
        sent_by TEXT NOT NULL DEFAULT 'system',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_comm_submission
        ON communication_messages(submission_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS crm_sync_events (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        status TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        triggered_by TEXT NOT NULL DEFAULT 'staff',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_configs (
        config_key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL DEFAULT ''
      );
    `);

    // Ensure consultation_requests has auto_categorized & matched_rule_label columns
    const consCols = this.db
      .prepare("PRAGMA table_info('consultation_requests')")
      .all() as Array<{ name?: string }>;
    const consColNames = new Set(consCols.map((c) => c.name));
    if (!consColNames.has('auto_categorized')) {
      this.db.exec(
        'ALTER TABLE consultation_requests ADD COLUMN auto_categorized INTEGER NOT NULL DEFAULT 0;'
      );
    }
    if (!consColNames.has('matched_rule_label')) {
      this.db.exec(
        "ALTER TABLE consultation_requests ADD COLUMN matched_rule_label TEXT NOT NULL DEFAULT '';"
      );
    }

    // Migrate campaign_attributions if ad_set / creative / placement columns were missing
    const attrCols = this.db
      .prepare("PRAGMA table_info('campaign_attributions')")
      .all() as Array<{ name?: string }>;
    const attrColNames = new Set(attrCols.map((c) => c.name));
    if (!attrColNames.has('ad_set')) {
      this.db.exec(
        "ALTER TABLE campaign_attributions ADD COLUMN ad_set TEXT NOT NULL DEFAULT '';"
      );
    }
    if (!attrColNames.has('creative')) {
      this.db.exec(
        "ALTER TABLE campaign_attributions ADD COLUMN creative TEXT NOT NULL DEFAULT '';"
      );
    }
    if (!attrColNames.has('placement')) {
      this.db.exec(
        "ALTER TABLE campaign_attributions ADD COLUMN placement TEXT NOT NULL DEFAULT '';"
      );
    }

    // Seed baseline active assessment version if none exists, or keep untouched system baseline aligned
    const verCount = (
      this.db
        .prepare('SELECT COUNT(*) AS cnt FROM assessment_versions')
        .get() as { cnt: number }
    ).cnt;
    if (verCount === 0) {
      const now = new Date().toISOString();
      this.db
        .prepare(
          `INSERT INTO assessment_versions
           (version_id, label, status, created_by, change_summary, questions_json, sections_json, part_a_config_version, created_at, activated_at)
           VALUES (?, ?, 'active', 'system', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          ASSESSMENT_VERSION,
          'Approved Baseline Discovery Assessment',
          'Initial master specification assessment configuration (9 Part A, 6 Part B, 6 Part C cards, 8 Part D questions + contact).',
          JSON.stringify(ASSESSMENT_QUESTIONS),
          JSON.stringify(ASSESSMENT_SECTIONS),
          PART_A_CONFIG_VERSION,
          now,
          now
        );
    } else if (verCount === 1) {
      const seedRow = this.db
        .prepare(
          "SELECT version_id, created_by, questions_json, sections_json, part_a_config_version FROM assessment_versions WHERE version_id = ? AND created_by = 'system'"
        )
        .get(ASSESSMENT_VERSION) as
        | {
            version_id?: string;
            created_by?: string;
            questions_json?: string;
            sections_json?: string;
            part_a_config_version?: string;
          }
        | undefined;
      if (seedRow?.questions_json) {
        const expectedQuestionsJson = JSON.stringify(ASSESSMENT_QUESTIONS);
        const expectedSectionsJson = JSON.stringify(ASSESSMENT_SECTIONS);
        if (
          seedRow.questions_json !== expectedQuestionsJson ||
          seedRow.sections_json !== expectedSectionsJson ||
          seedRow.part_a_config_version !== PART_A_CONFIG_VERSION
        ) {
          this.db
            .prepare(
              'UPDATE assessment_versions SET questions_json = ?, sections_json = ?, part_a_config_version = ? WHERE version_id = ?'
            )
            .run(
              expectedQuestionsJson,
              expectedSectionsJson,
              PART_A_CONFIG_VERSION,
              ASSESSMENT_VERSION
            );
        }
      }
    }

    // Migrate Stage 4 consultation_requests table if it still carries old CHECK constraint or lacks Stage 5 columns
    const consMaster = this.db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'consultation_requests'"
      )
      .get() as { sql?: string } | undefined;

    if (
      consMaster?.sql &&
      (!consMaster.sql.includes("'awaiting_review'") ||
        !consMaster.sql.includes('review_category'))
    ) {
      this.runInTransaction(() => {
        this.db.exec(`
          CREATE TABLE consultation_requests_v5 (
            id TEXT PRIMARY KEY,
            submission_id TEXT UNIQUE NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
            requested_at TEXT NOT NULL,
            preference TEXT NOT NULL CHECK (preference IN ('book', 'more_info', 'none')),
            review_category TEXT NOT NULL DEFAULT 'unreviewed',
            reviewed_at TEXT,
            reviewed_by TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL CHECK (status IN (
              'requested', 'awaiting_review', 'approved_for_contact', 'contact_attempted',
              'contacted', 'scheduled', 'completed', 'no_response', 'declined', 'closed'
            )),
            status_updated_at TEXT NOT NULL DEFAULT '',
            assigned_staff_member TEXT NOT NULL DEFAULT '',
            contact_attempts INTEGER NOT NULL DEFAULT 0,
            last_contacted_at TEXT,
            scheduled_at TEXT,
            completed_at TEXT,
            outcome_notes TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL
          );

          INSERT INTO consultation_requests_v5
            (id, submission_id, requested_at, preference, review_category, reviewed_at, reviewed_by,
             status, status_updated_at, assigned_staff_member, contact_attempts, last_contacted_at,
             scheduled_at, completed_at, outcome_notes, updated_at)
          SELECT
            id,
            submission_id,
            requested_at,
            preference,
            'unreviewed',
            NULL,
            '',
            CASE
              WHEN status = 'pending' AND preference IN ('book', 'more_info') THEN 'requested'
              WHEN status = 'pending' THEN 'awaiting_review'
              WHEN status = 'archived' THEN 'closed'
              ELSE status
            END,
            updated_at,
            assigned_staff_member,
            contact_attempts,
            last_contacted_at,
            scheduled_at,
            completed_at,
            outcome_notes,
            updated_at
          FROM consultation_requests;

          DROP TABLE consultation_requests;
          ALTER TABLE consultation_requests_v5 RENAME TO consultation_requests;
          CREATE INDEX IF NOT EXISTS idx_consultation_status
            ON consultation_requests(status, requested_at DESC);
        `);
      });
    }
  }

  private runInTransaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const value = fn();
      this.db.exec('COMMIT;');
      return value;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // Ignore rollback error
      }
      throw err;
    }
  }

  private migrateLegacyJsonIfEmpty(): void {
    if (this.dbPath === ':memory:') return;
    const countRow = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM assessment_submissions')
      .get() as { cnt: number };
    if (countRow.cnt > 0) return;

    const legacyPath = path.join(path.dirname(this.dbPath), 'submissions.json');
    if (!fs.existsSync(legacyPath)) return;

    try {
      const raw = fs.readFileSync(legacyPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      for (const item of parsed) {
        if (!item || typeof item !== 'object' || !item.answers || !item.id) continue;
        const answers = sanitizeAnswersPayload(item.answers);
        const createdAt =
          typeof item.createdAt === 'string'
            ? item.createdAt
            : new Date().toISOString();
        const result: AssessmentResult =
          item.result && item.result.professionalStyle && item.result.growthJourney
            ? (item.result as AssessmentResult)
            : scoreAssessment(answers);

        this.runInTransaction(() => {
          const token = generateAccessToken();
          const respondentId = generatePrivateId('resp');
          const attribution = sanitizeAttributionPayload({}, answers);

          this.db
            .prepare(
              `INSERT INTO respondent_contacts
               (id, full_name, whatsapp_number, email, city, state, institution, whatsapp_consent, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              respondentId,
              answers.contact.fullName,
              answers.contact.whatsappNumber,
              answers.contact.email,
              answers.contact.city,
              answers.contact.state,
              answers.contact.institution,
              answers.contact.whatsappConsent ? 1 : 0,
              createdAt,
              createdAt
            );

          this.db
            .prepare(
              `INSERT INTO assessment_submissions
               (id, result_token_hash, idempotency_key, submit_nonce, completion_status,
                assessment_version, scoring_version, part_a_config_version, assessment_snapshot_json,
                respondent_id, duration_minutes, created_at, updated_at, submitted_at,
                raw_selections_json, raw_other_text_json, calculated_result_json, feedback_json)
               VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              String(item.id),
              hashAccessToken(token),
              `migrated_${String(item.id)}`,
              `migrated_${String(item.id)}`,
              ASSESSMENT_VERSION,
              result.scoringVersion || SCORING_ENGINE_VERSION,
              PART_A_CONFIG_VERSION,
              JSON.stringify(buildVersionSnapshot()),
              respondentId,
              Math.max(1, Number(item.durationMinutes) || 1),
              createdAt,
              typeof item.updatedAt === 'string' ? item.updatedAt : createdAt,
              createdAt,
              JSON.stringify(answers.selections),
              JSON.stringify(answers.otherText),
              JSON.stringify(result),
              JSON.stringify(
                item.feedback ?? { archetypeFits: '', stageFits: '', notes: '' }
              )
            );

          this.upsertPartTablesSync(String(item.id), answers, result, createdAt);
          this.upsertAttributionSync(String(item.id), attribution, createdAt);

          const pref = result.nextStep?.consultationIntent ?? 'none';
          const status: ConsultationStatus = item.consultationStatus
            ? normalizeLegacyStatus(String(item.consultationStatus))
            : result.nextStep?.wantsConsultation
              ? 'requested'
              : 'awaiting_review';

          this.db
            .prepare(
              `INSERT INTO consultation_requests
               (id, submission_id, requested_at, preference, review_category, reviewed_at, reviewed_by,
                status, status_updated_at, assigned_staff_member, contact_attempts, last_contacted_at,
                scheduled_at, completed_at, outcome_notes, updated_at)
               VALUES (?, ?, ?, ?, 'unreviewed', NULL, '', ?, ?, '', 0, NULL, NULL, NULL, ?, ?)`
            )
            .run(
              generatePrivateId('cons'),
              String(item.id),
              createdAt,
              pref,
              status,
              createdAt,
              sanitizeMultiline(item.staffNotes ?? '', 2000),
              createdAt
            );
        });
      }
    } catch {
      // Non-fatal
    }
  }

  getBoundaryStatus(): StorageBoundaryStatus {
    const externalConfigured = Boolean(process.env.DATABASE_URL?.trim());
    return {
      mode: 'sqlite',
      databasePath: this.dbPath,
      walEnabled: this.walEnabled,
      foreignKeysEnabled: this.foreignKeysEnabled,
      externalDatabaseConfigured: externalConfigured,
      description:
        'Normalized 10-table SQLite relational database active with transactional writes, WAL durability, foreign-key integrity, and hot backup snapshots.',
    };
  }

  private upsertPartTablesSync(
    submissionId: string,
    answers: RespondentAnswers,
    result: AssessmentResult | null,
    now: string,
    questions: AssessmentQuestion[] = ASSESSMENT_QUESTIONS
  ): void {
    const { partA, partB, partC, partD } = splitSelectionsByPart(answers, questions);

    this.db
      .prepare(
        `INSERT INTO part_a_responses
         (submission_id, raw_answers_json, result_status, pattern, lead_title, style_scores_json, result_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(submission_id) DO UPDATE SET
           raw_answers_json = excluded.raw_answers_json,
           result_status = excluded.result_status,
           pattern = excluded.pattern,
           lead_title = excluded.lead_title,
           style_scores_json = excluded.style_scores_json,
           result_json = excluded.result_json,
           updated_at = excluded.updated_at`
      )
      .run(
        submissionId,
        JSON.stringify(partA),
        result?.professionalStyle.status ?? null,
        result?.professionalStyle.pattern ?? null,
        result?.professionalStyle.leadTitle ?? null,
        result ? JSON.stringify(result.professionalStyle.styleScores) : null,
        result ? JSON.stringify(result.professionalStyle) : null,
        now
      );

    this.db
      .prepare(
        `INSERT INTO part_b_responses
         (submission_id, raw_answers_json, scored_raw_values_json, unrounded_average,
          rounded_stage_level, spread, mixed_stage_flag, result_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(submission_id) DO UPDATE SET
           raw_answers_json = excluded.raw_answers_json,
           scored_raw_values_json = excluded.scored_raw_values_json,
           unrounded_average = excluded.unrounded_average,
           rounded_stage_level = excluded.rounded_stage_level,
           spread = excluded.spread,
           mixed_stage_flag = excluded.mixed_stage_flag,
           result_json = excluded.result_json,
           updated_at = excluded.updated_at`
      )
      .run(
        submissionId,
        JSON.stringify(partB),
        result ? JSON.stringify(result.growthJourney.rawResponses) : null,
        result?.growthJourney.unroundedAverage ?? null,
        result?.growthJourney.roundedStageLevel ?? null,
        result?.growthJourney.spread ?? null,
        result ? (result.growthJourney.mixedStageFlag ? 1 : 0) : null,
        result ? JSON.stringify(result.growthJourney) : null,
        now
      );

    for (const pillar of CAPABILITY_PILLARS) {
      const kQ = ASSESSMENT_QUESTIONS.find(
        (q) => q.kind === 'capability_knowledge' && q.pillarId === pillar.id
      )!;
      const eQ = ASSESSMENT_QUESTIONS.find(
        (q) => q.kind === 'capability_experience' && q.pillarId === pillar.id
      )!;
      const capRes = result?.capabilities.find((c) => c.pillarId === pillar.id);

      this.db
        .prepare(
          `INSERT INTO part_c_responses
           (id, submission_id, pillar_id, understanding_question_id, understanding_option_id,
            understanding_score, experience_question_id, experience_option_id, experience_score,
            interpretation, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(submission_id, pillar_id) DO UPDATE SET
             understanding_option_id = excluded.understanding_option_id,
             understanding_score = excluded.understanding_score,
             experience_option_id = excluded.experience_option_id,
             experience_score = excluded.experience_score,
             interpretation = excluded.interpretation,
             updated_at = excluded.updated_at`
        )
        .run(
          generatePrivateId('partc'),
          submissionId,
          pillar.id,
          kQ.id,
          partC[kQ.id] ?? '',
          capRes ? capRes.understandingScore : null,
          eQ.id,
          partC[eQ.id] ?? '',
          capRes ? capRes.experienceScore : null,
          capRes?.constructiveInterpretation ?? '',
          now
        );
    }

    const q7Id = partD['profile_q07'];
    const q7Pref =
      QUESTION_MAP['profile_q07']?.options.find((o) => o.id === q7Id)
        ?.consultationIntent ?? 'none';

    this.db
      .prepare(
        `INSERT INTO part_d_responses
         (submission_id, raw_answers_json, other_text_json, consultation_preference, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(submission_id) DO UPDATE SET
           raw_answers_json = excluded.raw_answers_json,
           other_text_json = excluded.other_text_json,
           consultation_preference = excluded.consultation_preference,
           updated_at = excluded.updated_at`
      )
      .run(
        submissionId,
        JSON.stringify(partD),
        JSON.stringify(answers.otherText),
        q7Pref,
        now
      );
  }

  private upsertAttributionSync(
    submissionId: string,
    attribution: CampaignAttribution,
    now: string
  ): void {
    this.db
      .prepare(
        `INSERT INTO campaign_attributions
         (submission_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          ad_set, creative, placement, referrer, landing_path,
          discovery_source_option_id, discovery_source_label, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(submission_id) DO UPDATE SET
           utm_source = CASE WHEN campaign_attributions.utm_source != '' THEN campaign_attributions.utm_source ELSE excluded.utm_source END,
           utm_medium = CASE WHEN campaign_attributions.utm_medium != '' THEN campaign_attributions.utm_medium ELSE excluded.utm_medium END,
           utm_campaign = CASE WHEN campaign_attributions.utm_campaign != '' THEN campaign_attributions.utm_campaign ELSE excluded.utm_campaign END,
           utm_term = CASE WHEN campaign_attributions.utm_term != '' THEN campaign_attributions.utm_term ELSE excluded.utm_term END,
           utm_content = CASE WHEN campaign_attributions.utm_content != '' THEN campaign_attributions.utm_content ELSE excluded.utm_content END,
           ad_set = CASE WHEN campaign_attributions.ad_set != '' THEN campaign_attributions.ad_set ELSE excluded.ad_set END,
           creative = CASE WHEN campaign_attributions.creative != '' THEN campaign_attributions.creative ELSE excluded.creative END,
           placement = CASE WHEN campaign_attributions.placement != '' THEN campaign_attributions.placement ELSE excluded.placement END,
           referrer = CASE WHEN campaign_attributions.referrer != '' THEN campaign_attributions.referrer ELSE excluded.referrer END,
           landing_path = CASE WHEN campaign_attributions.landing_path != '' THEN campaign_attributions.landing_path ELSE excluded.landing_path END,
           discovery_source_option_id = CASE WHEN excluded.discovery_source_option_id != '' THEN excluded.discovery_source_option_id ELSE campaign_attributions.discovery_source_option_id END,
           discovery_source_label = CASE WHEN excluded.discovery_source_label != '' THEN excluded.discovery_source_label ELSE campaign_attributions.discovery_source_label END,
           updated_at = excluded.updated_at`
      )
      .run(
        submissionId,
        attribution.utmSource,
        attribution.utmMedium,
        attribution.utmCampaign,
        attribution.utmTerm,
        attribution.utmContent,
        attribution.adSet,
        attribution.creative,
        attribution.placement,
        attribution.referrer,
        attribution.landingPath,
        attribution.discoverySourceOptionId,
        attribution.discoverySourceLabel,
        now,
        now
      );
  }

  private insertEventSync(
    submissionId: string,
    eventType: AssessmentEventRecord['eventType'],
    actorType: AssessmentEventRecord['actorType'],
    actorId: string,
    metadata: Record<string, unknown>,
    now = new Date().toISOString()
  ): void {
    this.db
      .prepare(
        `INSERT INTO assessment_events
         (id, submission_id, event_type, actor_type, actor_id, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        generatePrivateId('evt'),
        submissionId,
        eventType,
        actorType,
        actorId,
        JSON.stringify(metadata),
        now
      );
  }

  private insertDeliveryEventSync(
    submissionId: string,
    channel: ReportDeliveryEventRecord['channel'],
    status: ReportDeliveryEventRecord['status'],
    recipient: string,
    provider: string,
    detail: string,
    now = new Date().toISOString()
  ): void {
    this.db
      .prepare(
        `INSERT INTO report_delivery_events
         (id, submission_id, channel, status, recipient, provider, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        generatePrivateId('dlv'),
        submissionId,
        channel,
        status,
        recipient,
        provider,
        detail,
        now
      );
  }

  private hydrateRecordSync(
    row: Record<string, unknown>,
    includeEvents = false
  ): SubmissionRecord {
    const id = String(row.id);
    const contactRow = this.db
      .prepare('SELECT * FROM respondent_contacts WHERE id = ?')
      .get(String(row.respondent_id)) as Record<string, unknown>;

    const attrRow = this.db
      .prepare('SELECT * FROM campaign_attributions WHERE submission_id = ?')
      .get(id) as Record<string, unknown> | undefined;

    const consRow = this.db
      .prepare('SELECT * FROM consultation_requests WHERE submission_id = ?')
      .get(id) as Record<string, unknown> | undefined;

    const answers: RespondentAnswers = {
      selections: JSON.parse(String(row.raw_selections_json || '{}')),
      otherText: JSON.parse(String(row.raw_other_text_json || '{}')),
      contact: {
        fullName: String(contactRow?.full_name ?? ''),
        whatsappNumber: String(contactRow?.whatsapp_number ?? ''),
        email: String(contactRow?.email ?? ''),
        city: String(contactRow?.city ?? ''),
        state: String(contactRow?.state ?? ''),
        institution: String(contactRow?.institution ?? ''),
        whatsappConsent: contactRow?.whatsapp_consent === 1,
      },
    };

    const result: AssessmentResult = row.calculated_result_json
      ? (JSON.parse(String(row.calculated_result_json)) as AssessmentResult)
      : scoreAssessment(answers);

    const feedback: PilotFeedback = JSON.parse(
      String(
        row.feedback_json ||
          '{"archetypeFits":"","stageFits":"","notes":""}'
      )
    );

    const attribution: CampaignAttribution = {
      utmSource: String(attrRow?.utm_source ?? ''),
      utmMedium: String(attrRow?.utm_medium ?? ''),
      utmCampaign: String(attrRow?.utm_campaign ?? ''),
      utmTerm: String(attrRow?.utm_term ?? ''),
      utmContent: String(attrRow?.utm_content ?? ''),
      adSet: String(attrRow?.ad_set ?? ''),
      creative: String(attrRow?.creative ?? ''),
      placement: String(attrRow?.placement ?? ''),
      referrer: String(attrRow?.referrer ?? ''),
      landingPath: String(attrRow?.landing_path ?? ''),
      discoverySourceOptionId: String(attrRow?.discovery_source_option_id ?? ''),
      discoverySourceLabel: String(attrRow?.discovery_source_label ?? ''),
    };

    const normalizedStatus = consRow
      ? normalizeLegacyStatus(String(consRow.status ?? 'awaiting_review'))
      : 'awaiting_review';

    const reviewCategory: HumanReviewCategory = ALL_REVIEW_CATEGORIES.includes(
      consRow?.review_category as HumanReviewCategory
    )
      ? (consRow?.review_category as HumanReviewCategory)
      : 'unreviewed';

    const consultation: ConsultationRequestRecord = consRow
      ? {
          id: String(consRow.id),
          submissionId: id,
          requestedAt: String(consRow.requested_at),
          preference:
            (consRow.preference as 'book' | 'more_info' | 'none') ?? 'none',
          reviewCategory,
          autoCategorized: Number(consRow.auto_categorized ?? 0) === 1,
          matchedRuleLabel: String(consRow.matched_rule_label ?? ''),
          reviewedAt: consRow.reviewed_at ? String(consRow.reviewed_at) : null,
          reviewedBy: String(consRow.reviewed_by ?? ''),
          status: normalizedStatus,
          statusUpdatedAt: String(
            consRow.status_updated_at || consRow.updated_at || row.updated_at
          ),
          assignedStaffMember: String(consRow.assigned_staff_member ?? ''),
          contactAttempts: Number(consRow.contact_attempts ?? 0),
          lastContactedAt: consRow.last_contacted_at
            ? String(consRow.last_contacted_at)
            : null,
          scheduledAt: consRow.scheduled_at ? String(consRow.scheduled_at) : null,
          completedAt: consRow.completed_at ? String(consRow.completed_at) : null,
          outcomeNotes: String(consRow.outcome_notes ?? ''),
          updatedAt: String(consRow.updated_at),
        }
      : {
          id: '',
          submissionId: id,
          requestedAt: String(row.created_at),
          preference: 'none',
          reviewCategory: 'unreviewed',
          reviewedAt: null,
          reviewedBy: '',
          status: 'awaiting_review',
          statusUpdatedAt: String(row.updated_at),
          assignedStaffMember: '',
          contactAttempts: 0,
          lastContactedAt: null,
          scheduledAt: null,
          completedAt: null,
          outcomeNotes: '',
          updatedAt: String(row.updated_at),
        };

    const snapshot: AssessmentVersionSnapshot = JSON.parse(
      String(
        row.assessment_snapshot_json || JSON.stringify(buildVersionSnapshot())
      )
    );

    const record: SubmissionRecord = {
      id,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      submittedAt: row.submitted_at ? String(row.submitted_at) : null,
      completionStatus: row.completion_status as SubmissionCompletionStatus,
      assessmentVersion: String(row.assessment_version),
      scoringVersion: String(row.scoring_version),
      partAConfigVersion: String(row.part_a_config_version),
      assessmentSnapshot: snapshot,
      durationMinutes: Number(row.duration_minutes || 1),
      answers,
      result,
      attribution,
      feedback,
      consultation,
      consultationStatus: consultation.status,
      staffNotes: consultation.outcomeNotes,
    };

    if (includeEvents) {
      const eventRows = this.db
        .prepare(
          'SELECT * FROM assessment_events WHERE submission_id = ? ORDER BY created_at ASC'
        )
        .all(id) as Array<Record<string, unknown>>;
      record.events = eventRows.map((e) => ({
        id: String(e.id),
        submissionId: String(e.submission_id),
        eventType: e.event_type as AssessmentEventRecord['eventType'],
        actorType: e.actor_type as AssessmentEventRecord['actorType'],
        actorId: String(e.actor_id ?? ''),
        metadata: JSON.parse(String(e.metadata_json ?? '{}')),
        createdAt: String(e.created_at),
      }));

      const deliveryRows = this.db
        .prepare(
          'SELECT * FROM report_delivery_events WHERE submission_id = ? ORDER BY created_at ASC'
        )
        .all(id) as Array<Record<string, unknown>>;
      record.deliveryEvents = deliveryRows.map((d) => ({
        id: String(d.id),
        submissionId: String(d.submission_id),
        channel: d.channel as ReportDeliveryEventRecord['channel'],
        status: d.status as ReportDeliveryEventRecord['status'],
        recipient: String(d.recipient ?? ''),
        provider: String(d.provider ?? ''),
        detail: String(d.detail ?? ''),
        createdAt: String(d.created_at),
      }));
      const telemetryRows = this.db
        .prepare(
          'SELECT * FROM question_telemetry_events WHERE submission_id = ? ORDER BY created_at ASC'
        )
        .all(id) as Array<Record<string, unknown>>;
      record.telemetryEvents = telemetryRows.map((t) => ({
        id: String(t.id),
        submissionId: String(t.submission_id),
        eventType: t.event_type as QuestionTelemetryRecord['eventType'],
        sectionId: String(t.section_id ?? ''),
        questionId: String(t.question_id ?? ''),
        optionId: String(t.option_id ?? ''),
        previousOptionId: String(t.previous_option_id ?? ''),
        activeTimeMs: Number(t.active_time_ms ?? 0),
        inactiveTimeMs: Number(t.inactive_time_ms ?? 0),
        wallTimeMs: Number(t.wall_time_ms ?? 0),
        clientTimestamp: String(t.client_timestamp ?? ''),
        metadata: JSON.parse(String(t.metadata_json ?? '{}')),
        createdAt: String(t.created_at),
      }));

      const commRows = this.db
        .prepare(
          'SELECT * FROM communication_messages WHERE submission_id = ? ORDER BY created_at DESC'
        )
        .all(id) as Array<Record<string, unknown>>;
      record.communicationMessages = commRows.map((m) => ({
        id: String(m.id),
        submissionId: String(m.submission_id),
        channel: m.channel as CommunicationChannel,
        messageType: m.message_type as CommunicationTemplateType,
        recipient: String(m.recipient ?? ''),
        subject: String(m.subject ?? ''),
        bodyPreview: String(m.body_preview ?? ''),
        provider: String(m.provider ?? ''),
        status: m.status as CommunicationDeliveryStatus,
        externalMessageId: String(m.external_message_id ?? ''),
        errorDetail: String(m.error_detail ?? ''),
        sentBy: String(m.sent_by ?? ''),
        createdAt: String(m.created_at),
        updatedAt: String(m.updated_at),
      }));
    }

    return record;
  }

  async createDraftSubmission(input: {
    idempotencyKey?: string;
    durationMinutes?: number;
    answers?: unknown;
    attribution?: unknown;
  }): Promise<{
    record: SubmissionRecord;
    accessToken: string;
    deduplicated: boolean;
  }> {
    const idempotencyKey = sanitizeSingleLine(input.idempotencyKey ?? '', 128);
    const answers = input.answers
      ? sanitizeAnswersPayload(input.answers)
      : EMPTY_ANSWERS;
    const attribution = sanitizeAttributionPayload(input.attribution, answers);
    const now = new Date().toISOString();

    return this.runInTransaction(() => {
      if (idempotencyKey) {
        const existing = this.db
          .prepare('SELECT * FROM assessment_submissions WHERE idempotency_key = ?')
          .get(idempotencyKey) as Record<string, unknown> | undefined;

        if (existing) {
          if (existing.completion_status === 'submitted') {
            this.insertEventSync(
              String(existing.id),
              'replay_blocked',
              'respondent',
              String(existing.id),
              { reason: 'duplicate_idempotency_key_after_submit' },
              now
            );
            return {
              record: this.hydrateRecordSync(existing),
              accessToken: '',
              deduplicated: true,
            };
          }

          let rotatedToken = '';
          if (idempotencyKey.length >= 16) {
            rotatedToken = generateAccessToken();
            this.db
              .prepare(
                'UPDATE assessment_submissions SET result_token_hash = ?, updated_at = ? WHERE id = ?'
              )
              .run(hashAccessToken(rotatedToken), now, String(existing.id));
          }
          return {
            record: this.hydrateRecordSync(existing),
            accessToken: rotatedToken,
            deduplicated: true,
          };
        }
      }

      const submissionId = generatePrivateId('kws');
      const respondentId = generatePrivateId('resp');
      const accessToken = generateAccessToken();
      const activeVersion = this.getActiveAssessmentVersionSync();
      const partAConfig = this.getPartAScoringConfigSync();
      const partAConfigVersion = partAConfig.approved
        ? 'approved-v1'
        : PART_A_CONFIG_VERSION;
      const snapshot = buildVersionSnapshot(
        activeVersion.questions,
        activeVersion.versionId,
        partAConfig
      );

      this.db
        .prepare(
          `INSERT INTO respondent_contacts
           (id, full_name, whatsapp_number, email, city, state, institution, whatsapp_consent, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          respondentId,
          answers.contact.fullName,
          answers.contact.whatsappNumber,
          answers.contact.email,
          answers.contact.city,
          answers.contact.state,
          answers.contact.institution,
          answers.contact.whatsappConsent ? 1 : 0,
          now,
          now
        );

      this.db
        .prepare(
          `INSERT INTO assessment_submissions
           (id, result_token_hash, idempotency_key, submit_nonce, completion_status,
            assessment_version, scoring_version, part_a_config_version, assessment_snapshot_json,
            respondent_id, duration_minutes, created_at, updated_at, submitted_at,
            raw_selections_json, raw_other_text_json, calculated_result_json, feedback_json)
           VALUES (?, ?, ?, NULL, 'in_progress', ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?)`
        )
        .run(
          submissionId,
          hashAccessToken(accessToken),
          idempotencyKey || null,
          activeVersion.versionId,
          SCORING_ENGINE_VERSION,
          partAConfigVersion,
          JSON.stringify(snapshot),
          respondentId,
          Math.max(1, Math.round(input.durationMinutes || 1)),
          now,
          now,
          JSON.stringify(answers.selections),
          JSON.stringify(answers.otherText),
          JSON.stringify({ archetypeFits: '', stageFits: '', notes: '' })
        );

      this.upsertPartTablesSync(
        submissionId,
        answers,
        null,
        now,
        activeVersion.questions
      );
      this.upsertAttributionSync(submissionId, attribution, now);
      this.insertEventSync(
        submissionId,
        'submission_created',
        'respondent',
        submissionId,
        {
          assessmentVersion: activeVersion.versionId,
          scoringVersion: SCORING_ENGINE_VERSION,
        },
        now
      );

      const created = this.db
        .prepare('SELECT * FROM assessment_submissions WHERE id = ?')
        .get(submissionId) as Record<string, unknown>;

      return {
        record: this.hydrateRecordSync(created),
        accessToken,
        deduplicated: false,
      };
    });
  }

  async saveDraftAnswers(
    id: string,
    accessToken: string,
    input: {
      answers: unknown;
      attribution?: unknown;
      durationMinutes?: number;
    }
  ): Promise<SubmissionRecord | null> {
    const answers = sanitizeAnswersPayload(input.answers);
    const attribution = sanitizeAttributionPayload(input.attribution, answers);
    const now = new Date().toISOString();

    return this.runInTransaction(() => {
      const existing = this.db
        .prepare('SELECT * FROM assessment_submissions WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      if (!existing) return null;

      if (
        !verifyAccessTokenHash(accessToken, String(existing.result_token_hash))
      ) {
        throw new DomainForbiddenError(
          'INVALID_ACCESS_TOKEN',
          'A valid private submission token is required to update this draft.'
        );
      }

      if (existing.completion_status === 'submitted') {
        this.insertEventSync(
          id,
          'replay_blocked',
          'respondent',
          id,
          { reason: 'attempted_mutation_after_submit' },
          now
        );
        throw new DomainConflictError(
          'SUBMISSION_ALREADY_FINALIZED',
          'This assessment has already been finalized and cannot be modified.'
        );
      }

      this.db
        .prepare(
          `UPDATE respondent_contacts
           SET full_name = ?, whatsapp_number = ?, email = ?, city = ?, state = ?,
               institution = ?, whatsapp_consent = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          answers.contact.fullName,
          answers.contact.whatsappNumber,
          answers.contact.email,
          answers.contact.city,
          answers.contact.state,
          answers.contact.institution,
          answers.contact.whatsappConsent ? 1 : 0,
          now,
          String(existing.respondent_id)
        );

      this.db
        .prepare(
          `UPDATE assessment_submissions
           SET raw_selections_json = ?, raw_other_text_json = ?,
               duration_minutes = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          JSON.stringify(answers.selections),
          JSON.stringify(answers.otherText),
          Math.max(
            1,
            Math.round(
              input.durationMinutes || Number(existing.duration_minutes) || 1
            )
          ),
          now,
          id
        );

      const submissionVersion = this.getAssessmentVersionOrActiveSync(
        String(existing.assessment_version || '')
      );
      this.upsertPartTablesSync(
        id,
        answers,
        null,
        now,
        submissionVersion.questions
      );
      this.upsertAttributionSync(id, attribution, now);
      this.insertEventSync(
        id,
        'answers_saved',
        'respondent',
        id,
        { answeredCount: Object.keys(answers.selections).length },
        now
      );

      const updated = this.db
        .prepare('SELECT * FROM assessment_submissions WHERE id = ?')
        .get(id) as Record<string, unknown>;
      return this.hydrateRecordSync(updated);
    });
  }

  async finalizeSubmission(
    id: string,
    accessToken: string,
    input: {
      submitNonce?: string;
      answers?: unknown;
      attribution?: unknown;
      durationMinutes?: number;
    }
  ): Promise<{
    record: SubmissionRecord;
    deduplicated: boolean;
  } | null> {
    const submitNonce = sanitizeSingleLine(input.submitNonce ?? '', 128);
    const now = new Date().toISOString();

    return this.runInTransaction(() => {
      const existing = this.db
        .prepare('SELECT * FROM assessment_submissions WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      if (!existing) return null;

      if (
        !verifyAccessTokenHash(accessToken, String(existing.result_token_hash))
      ) {
        throw new DomainForbiddenError(
          'INVALID_ACCESS_TOKEN',
          'A valid private submission token is required to submit this assessment.'
        );
      }

      if (existing.completion_status === 'submitted') {
        const storedNonce = String(existing.submit_nonce ?? '');
        if (submitNonce && storedNonce && submitNonce === storedNonce) {
          return {
            record: this.hydrateRecordSync(existing),
            deduplicated: true,
          };
        }
        this.insertEventSync(
          id,
          'replay_blocked',
          'respondent',
          id,
          { reason: 'duplicate_submit_rejected' },
          now
        );
        throw new DomainConflictError(
          'DUPLICATE_SUBMISSION',
          'This assessment has already been submitted.'
        );
      }

      const answers: RespondentAnswers = input.answers
        ? sanitizeAnswersPayload(input.answers)
        : {
            selections: JSON.parse(String(existing.raw_selections_json || '{}')),
            otherText: JSON.parse(String(existing.raw_other_text_json || '{}')),
            contact: this.hydrateRecordSync(existing).answers.contact,
          };

      const submissionVersion = this.getAssessmentVersionOrActiveSync(
        String(existing.assessment_version || '')
      );
      const validation = validateAllAnswers(answers, submissionVersion.questions);
      if (!validation.valid) {
        throw new DomainValidationError(
          'INCOMPLETE_ASSESSMENT',
          'Please complete all required assessment questions before submitting.',
          validation.missingQuestionIds
        );
      }

      const partAConfig = this.getPartAScoringConfigSync();
      const partAConfigVersion = partAConfig.approved
        ? 'approved-v1'
        : PART_A_CONFIG_VERSION;
      const result = scoreAssessment(answers, {
        partAConfig,
        questions: submissionVersion.questions,
      });
      const attribution = sanitizeAttributionPayload(input.attribution, answers);
      const durationMinutes = Math.max(
        1,
        Math.round(
          input.durationMinutes || Number(existing.duration_minutes) || 1
        )
      );

      this.db
        .prepare(
          `UPDATE respondent_contacts
           SET full_name = ?, whatsapp_number = ?, email = ?, city = ?, state = ?,
               institution = ?, whatsapp_consent = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          answers.contact.fullName,
          answers.contact.whatsappNumber,
          answers.contact.email,
          answers.contact.city,
          answers.contact.state,
          answers.contact.institution,
          answers.contact.whatsappConsent ? 1 : 0,
          now,
          String(existing.respondent_id)
        );

      this.db
        .prepare(
          `UPDATE assessment_submissions
           SET completion_status = 'submitted',
               submit_nonce = ?,
               scoring_version = ?,
               part_a_config_version = ?,
               duration_minutes = ?,
               raw_selections_json = ?,
               raw_other_text_json = ?,
               calculated_result_json = ?,
               submitted_at = ?,
               updated_at = ?
           WHERE id = ?`
        )
        .run(
          submitNonce || generatePrivateId('nonce'),
          result.scoringVersion,
          partAConfigVersion,
          durationMinutes,
          JSON.stringify(answers.selections),
          JSON.stringify(answers.otherText),
          JSON.stringify(result),
          now,
          now,
          id
        );

      this.upsertPartTablesSync(
        id,
        answers,
        result,
        now,
        submissionVersion.questions
      );
      this.upsertAttributionSync(id, attribution, now);

      const pref = result.nextStep.consultationIntent;
      const consStatus: ConsultationStatus =
        pref === 'book' || pref === 'more_info'
          ? 'requested'
          : 'awaiting_review';

      const segConfig = this.getLeadSegmentationConfigSync();
      const segEval = evaluateLeadSegmentation(answers, segConfig);
      const initialReviewCategory = segEval.category;
      const initialAutoCat = segEval.autoCategorized ? 1 : 0;
      const initialRuleLabel = segEval.matchedRuleLabel;
      const initialReviewedAt = segEval.autoCategorized ? now : null;
      const initialReviewedBy = segEval.autoCategorized
        ? 'auto:segmentation'
        : '';

      this.db
        .prepare(
          `INSERT INTO consultation_requests
           (id, submission_id, requested_at, preference, review_category, auto_categorized, matched_rule_label,
            reviewed_at, reviewed_by, status, status_updated_at, assigned_staff_member, contact_attempts,
            last_contacted_at, scheduled_at, completed_at, outcome_notes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, NULL, NULL, NULL, '', ?)
           ON CONFLICT(submission_id) DO UPDATE SET
             requested_at = excluded.requested_at,
             preference = excluded.preference,
             review_category = CASE
               WHEN consultation_requests.reviewed_by = '' OR consultation_requests.reviewed_by = 'auto:segmentation'
               THEN excluded.review_category
               ELSE consultation_requests.review_category
             END,
             auto_categorized = CASE
               WHEN consultation_requests.reviewed_by = '' OR consultation_requests.reviewed_by = 'auto:segmentation'
               THEN excluded.auto_categorized
               ELSE consultation_requests.auto_categorized
             END,
             matched_rule_label = CASE
               WHEN consultation_requests.reviewed_by = '' OR consultation_requests.reviewed_by = 'auto:segmentation'
               THEN excluded.matched_rule_label
               ELSE consultation_requests.matched_rule_label
             END,
             reviewed_at = CASE
               WHEN consultation_requests.reviewed_by = '' OR consultation_requests.reviewed_by = 'auto:segmentation'
               THEN excluded.reviewed_at
               ELSE consultation_requests.reviewed_at
             END,
             reviewed_by = CASE
               WHEN consultation_requests.reviewed_by = '' OR consultation_requests.reviewed_by = 'auto:segmentation'
               THEN excluded.reviewed_by
               ELSE consultation_requests.reviewed_by
             END,
             status = excluded.status,
             status_updated_at = excluded.status_updated_at,
             updated_at = excluded.updated_at`
        )
        .run(
          generatePrivateId('cons'),
          id,
          now,
          pref,
          initialReviewCategory,
          initialAutoCat,
          initialRuleLabel,
          initialReviewedAt,
          initialReviewedBy,
          consStatus,
          now,
          now
        );

      this.insertEventSync(
        id,
        'submitted',
        'respondent',
        id,
        {
          assessmentVersion: String(existing.assessment_version),
          scoringVersion: result.scoringVersion,
          consultationIntent: pref,
        },
        now
      );

      this.insertDeliveryEventSync(
        id,
        'on_screen',
        'delivered_on_screen',
        answers.contact.email || answers.contact.fullName,
        'internal_view',
        'Personalized results computed on server and returned for immediate display.',
        now
      );

      const emailProviderConfigured = Boolean(
        process.env.KWS_REPORT_WEBHOOK_URL?.trim()
      );
      this.insertDeliveryEventSync(
        id,
        'email',
        emailProviderConfigured ? 'queued' : 'skipped_no_provider',
        answers.contact.email,
        emailProviderConfigured ? 'webhook' : 'none',
        emailProviderConfigured
          ? 'Queued for report delivery webhook dispatch.'
          : 'No outbound email provider configured; results delivered immediately on screen.',
        now
      );

      this.insertDeliveryEventSync(
        id,
        'whatsapp',
        answers.contact.whatsappConsent
          ? emailProviderConfigured
            ? 'queued'
            : 'skipped_no_provider'
          : 'skipped_no_consent',
        answers.contact.whatsappNumber,
        emailProviderConfigured ? 'webhook' : 'none',
        answers.contact.whatsappConsent
          ? 'Respondent consented to WhatsApp follow-up; ready for staff/provider outreach.'
          : 'Respondent did not opt in to WhatsApp outreach.',
        now
      );

      const finalized = this.db
        .prepare('SELECT * FROM assessment_submissions WHERE id = ?')
        .get(id) as Record<string, unknown>;
      return {
        record: this.hydrateRecordSync(finalized),
        deduplicated: false,
      };
    });
  }

  async createAndSubmitAtomic(input: {
    idempotencyKey?: string;
    submitNonce?: string;
    durationMinutes: number;
    answers: unknown;
    attribution?: unknown;
  }): Promise<{
    record: SubmissionRecord;
    accessToken: string;
    deduplicated: boolean;
  }> {
    const idempotencyKey = sanitizeSingleLine(input.idempotencyKey ?? '', 128);
    const submitNonce = sanitizeSingleLine(input.submitNonce ?? '', 128);
    const answers = sanitizeAnswersPayload(input.answers);

    const activeVersion = this.getActiveAssessmentVersionSync();
    const validation = validateAllAnswers(answers, activeVersion.questions);
    if (!validation.valid) {
      throw new DomainValidationError(
        'INCOMPLETE_ASSESSMENT',
        'Please complete all required assessment questions before submitting.',
        validation.missingQuestionIds
      );
    }

    if (idempotencyKey) {
      const existing = this.db
        .prepare('SELECT * FROM assessment_submissions WHERE idempotency_key = ?')
        .get(idempotencyKey) as Record<string, unknown> | undefined;

      if (existing) {
        if (existing.completion_status === 'submitted') {
          const storedNonce = String(existing.submit_nonce ?? '');
          if (!submitNonce || !storedNonce || submitNonce === storedNonce) {
            return {
              record: this.hydrateRecordSync(existing),
              accessToken: '',
              deduplicated: true,
            };
          }
          this.insertEventSync(
            String(existing.id),
            'replay_blocked',
            'respondent',
            String(existing.id),
            { reason: 'atomic_submit_nonce_mismatch' }
          );
          throw new DomainConflictError(
            'DUPLICATE_SUBMISSION',
            'A submission for this assessment attempt has already been recorded.'
          );
        }

        const rotatedToken = generateAccessToken();
        this.db
          .prepare(
            'UPDATE assessment_submissions SET result_token_hash = ? WHERE id = ?'
          )
          .run(hashAccessToken(rotatedToken), String(existing.id));

        const finalized = await this.finalizeSubmission(
          String(existing.id),
          rotatedToken,
          {
            submitNonce: submitNonce || idempotencyKey,
            answers,
            attribution: input.attribution,
            durationMinutes: input.durationMinutes,
          }
        );
        return {
          record: finalized!.record,
          accessToken: rotatedToken,
          deduplicated: finalized!.deduplicated,
        };
      }
    }

    const draft = await this.createDraftSubmission({
      idempotencyKey,
      durationMinutes: input.durationMinutes,
      answers,
      attribution: input.attribution,
    });

    const finalized = await this.finalizeSubmission(
      draft.record.id,
      draft.accessToken,
      {
        submitNonce: submitNonce || idempotencyKey || generatePrivateId('nonce'),
        answers,
        attribution: input.attribution,
        durationMinutes: input.durationMinutes,
      }
    );

    return {
      record: finalized!.record,
      accessToken: draft.accessToken,
      deduplicated: finalized!.deduplicated,
    };
  }

  async verifySubmissionAccess(
    id: string,
    candidateToken: string
  ): Promise<{ exists: boolean; authorized: boolean }> {
    const row = this.db
      .prepare('SELECT result_token_hash FROM assessment_submissions WHERE id = ?')
      .get(id) as { result_token_hash?: string } | undefined;
    if (!row) return { exists: false, authorized: false };
    return {
      exists: true,
      authorized: verifyAccessTokenHash(
        candidateToken,
        String(row.result_token_hash ?? '')
      ),
    };
  }

  async getSubmissionById(
    id: string,
    options?: { includeEvents?: boolean; recordViewActor?: boolean }
  ): Promise<SubmissionRecord | null> {
    const row = this.db
      .prepare('SELECT * FROM assessment_submissions WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    if (options?.recordViewActor) {
      this.insertEventSync(id, 'result_viewed', 'respondent', id, {});
    }

    return this.hydrateRecordSync(row, Boolean(options?.includeEvents));
  }

  async recordDeliveryAttempt(
    submissionId: string,
    channel: ReportDeliveryEventRecord['channel'],
    status: ReportDeliveryEventRecord['status'],
    recipient: string,
    provider: string,
    detail: string
  ): Promise<void> {
    this.insertDeliveryEventSync(
      submissionId,
      channel,
      status,
      recipient,
      provider,
      detail
    );
  }

  async requestConsultation(
    id: string,
    preference: 'book' | 'more_info'
  ): Promise<SubmissionRecord | null> {
    const now = new Date().toISOString();
    return this.runInTransaction(() => {
      const existing = this.db
        .prepare('SELECT * FROM assessment_submissions WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      if (!existing) return null;

      const hydrated = this.hydrateRecordSync(existing);
      const nextStep =
        preference === 'book'
          ? {
              wantsConsultation: true,
              consultationIntent: 'book' as const,
              headline: 'Consultation requested',
              description:
                'You requested a conversation with KWS Academy to discuss your discovery results and possible next steps.',
              invitationNote:
                'Our team will follow up via your preferred contact details. Meanwhile, choose one priority above to explore this month.',
            }
          : {
              wantsConsultation: true,
              consultationIntent: 'more_info' as const,
              headline: 'More information requested',
              description:
                'You requested additional programme details from KWS Academy before deciding on a consultation.',
              invitationNote:
                'Review your priorities above while our team shares helpful next-step information.',
            };

      const updatedResult: AssessmentResult = {
        ...hydrated.result,
        nextStep,
      };

      this.db
        .prepare(
          'UPDATE assessment_submissions SET calculated_result_json = ?, updated_at = ? WHERE id = ?'
        )
        .run(JSON.stringify(updatedResult), now, id);

      this.db
        .prepare(
          `INSERT INTO consultation_requests
           (id, submission_id, requested_at, preference, review_category, reviewed_at, reviewed_by,
            status, status_updated_at, assigned_staff_member, contact_attempts, last_contacted_at,
            scheduled_at, completed_at, outcome_notes, updated_at)
           VALUES (?, ?, ?, ?, 'unreviewed', NULL, '', 'requested', ?, '', 0, NULL, NULL, NULL, '', ?)
           ON CONFLICT(submission_id) DO UPDATE SET
             requested_at = excluded.requested_at,
             preference = excluded.preference,
             status = 'requested',
             status_updated_at = excluded.status_updated_at,
             updated_at = excluded.updated_at`
        )
        .run(generatePrivateId('cons'), id, now, preference, now, now);

      this.insertEventSync(
        id,
        'consultation_requested',
        'respondent',
        id,
        { preference },
        now
      );

      const updated = this.db
        .prepare('SELECT * FROM assessment_submissions WHERE id = ?')
        .get(id) as Record<string, unknown>;
      return this.hydrateRecordSync(updated);
    });
  }

  async updateFeedback(
    id: string,
    feedback: PilotFeedback
  ): Promise<SubmissionRecord | null> {
    const now = new Date().toISOString();
    return this.runInTransaction(() => {
      const existing = this.db
        .prepare('SELECT * FROM assessment_submissions WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      if (!existing) return null;

      const payload: PilotFeedback = {
        archetypeFits: feedback.archetypeFits,
        stageFits: feedback.stageFits,
        notes: sanitizeMultiline(feedback.notes, 1500),
        submittedAt: now,
      };

      this.db
        .prepare(
          'UPDATE assessment_submissions SET feedback_json = ?, updated_at = ? WHERE id = ?'
        )
        .run(JSON.stringify(payload), now, id);

      this.insertEventSync(
        id,
        'feedback_submitted',
        'respondent',
        id,
        {
          archetypeFits: payload.archetypeFits,
          stageFits: payload.stageFits,
        },
        now
      );

      const updated = this.db
        .prepare('SELECT * FROM assessment_submissions WHERE id = ?')
        .get(id) as Record<string, unknown>;
      return this.hydrateRecordSync(updated);
    });
  }

  async listSubmissions(options?: {
    includeDrafts?: boolean;
  }): Promise<SubmissionRecord[]> {
    const sql = options?.includeDrafts
      ? 'SELECT * FROM assessment_submissions ORDER BY created_at DESC'
      : "SELECT * FROM assessment_submissions WHERE completion_status = 'submitted' ORDER BY submitted_at DESC, created_at DESC";
    const rows = this.db.prepare(sql).all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.hydrateRecordSync(row));
  }

  filterSubmissions(
    records: SubmissionRecord[],
    filters: AdminSubmissionFilters = {}
  ): SubmissionRecord[] {
    const q = (filters.q ?? '').trim().toLowerCase();
    const dateFrom = (filters.dateFrom ?? '').trim();
    const dateTo = (filters.dateTo ?? '').trim();
    const source = (filters.source ?? '').trim().toLowerCase();
    const audience = (filters.audience ?? '').trim();
    const location = (filters.location ?? '').trim().toLowerCase();
    const urgency = (filters.urgency ?? '').trim();
    const financialReadiness = (filters.financialReadiness ?? '').trim();
    const januaryCohort = (filters.januaryCohort ?? '').trim();
    const consultationStatus = (filters.consultationStatus ?? 'all').trim();
    const reviewCategory = (filters.reviewCategory ?? 'all').trim();

    return records.filter((rec) => {
      if (
        consultationStatus &&
        consultationStatus !== 'all' &&
        rec.consultation.status !== consultationStatus
      ) {
        return false;
      }

      if (
        reviewCategory &&
        reviewCategory !== 'all' &&
        rec.consultation.reviewCategory !== reviewCategory
      ) {
        return false;
      }

      const dateStr = (rec.submittedAt ?? rec.createdAt).slice(0, 10);
      if (dateFrom && dateStr < dateFrom) return false;
      if (dateTo && dateStr > dateTo) return false;

      if (source && source !== 'all') {
        const recSource = (
          rec.attribution.utmSource ||
          rec.attribution.discoverySourceLabel ||
          'Direct / Unspecified'
        ).toLowerCase();
        if (!recSource.includes(source)) return false;
      }

      if (audience && audience !== 'all') {
        if (rec.answers.selections['profile_q01'] !== audience) return false;
      }

      if (location && location !== 'all') {
        const locStr = `${rec.answers.contact.city} ${rec.answers.contact.state}`.toLowerCase();
        if (!locStr.includes(location)) return false;
      }

      if (urgency && urgency !== 'all') {
        if (rec.answers.selections['profile_q03'] !== urgency) return false;
      }

      if (financialReadiness && financialReadiness !== 'all') {
        if (rec.answers.selections['profile_q05'] !== financialReadiness) {
          return false;
        }
      }

      if (januaryCohort && januaryCohort !== 'all') {
        if (rec.answers.selections['profile_q06'] !== januaryCohort) {
          return false;
        }
      }

      if (q) {
        const haystack = [
          rec.id,
          rec.answers.contact.fullName,
          rec.answers.contact.email,
          rec.answers.contact.whatsappNumber,
          rec.answers.contact.city,
          rec.answers.contact.state,
          rec.answers.contact.institution,
          rec.result.professionalStyle.leadTitle,
          rec.result.growthJourney.indicativeStage.name,
          rec.consultation.assignedStaffMember,
          rec.consultation.reviewCategory,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }

  async listFilteredSubmissions(
    filters: AdminSubmissionFilters = {}
  ): Promise<{ records: SubmissionRecord[]; totalCount: number }> {
    const all = await this.listSubmissions({
      includeDrafts: Boolean(filters.includeDrafts),
    });
    return {
      records: this.filterSubmissions(all, filters),
      totalCount: all.length,
    };
  }

  async updateConsultation(
    id: string,
    patch: {
      consultationStatus?: ConsultationStatus;
      reviewCategory?: HumanReviewCategory;
      staffNotes?: string;
      assignedStaffMember?: string;
      incrementAttempt?: boolean;
      scheduledAt?: string | null;
    },
    actorLabel = 'KWS Staff'
  ): Promise<SubmissionRecord | null> {
    const now = new Date().toISOString();
    return this.runInTransaction(() => {
      const existing = this.db
        .prepare('SELECT * FROM assessment_submissions WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      if (!existing) return null;

      const currentCons = this.db
        .prepare('SELECT * FROM consultation_requests WHERE submission_id = ?')
        .get(id) as Record<string, unknown> | undefined;

      const currentStatus = currentCons
        ? normalizeLegacyStatus(String(currentCons.status ?? 'awaiting_review'))
        : 'awaiting_review';
      const nextStatus: ConsultationStatus =
        patch.consultationStatus ?? currentStatus;
      const statusChanged = nextStatus !== currentStatus;

      const currentReviewCategory = ALL_REVIEW_CATEGORIES.includes(
        currentCons?.review_category as HumanReviewCategory
      )
        ? (currentCons?.review_category as HumanReviewCategory)
        : 'unreviewed';
      const nextReviewCategory: HumanReviewCategory =
        patch.reviewCategory ?? currentReviewCategory;
      const reviewChanged =
        patch.reviewCategory !== undefined &&
        patch.reviewCategory !== currentReviewCategory;

      const nextReviewedAt = reviewChanged
        ? now
        : (currentCons?.reviewed_at as string | null) ?? null;
      const nextReviewedBy = reviewChanged
        ? actorLabel
        : String(currentCons?.reviewed_by ?? '');
      const nextAutoCategorized = reviewChanged
        ? 0
        : Number(currentCons?.auto_categorized ?? 0);
      const nextMatchedRuleLabel = reviewChanged
        ? ''
        : String(currentCons?.matched_rule_label ?? '');

      const nextStatusUpdatedAt = statusChanged
        ? now
        : String(currentCons?.status_updated_at || currentCons?.updated_at || now);

      const nextAssigned =
        patch.assignedStaffMember !== undefined
          ? sanitizeSingleLine(patch.assignedStaffMember, 120)
          : String(currentCons?.assigned_staff_member ?? '');
      const nextNotes =
        patch.staffNotes !== undefined
          ? sanitizeMultiline(patch.staffNotes, 2000)
          : String(currentCons?.outcome_notes ?? '');

      const currentAttempts = Number(currentCons?.contact_attempts ?? 0);
      const nextAttempts = patch.incrementAttempt
        ? currentAttempts + 1
        : currentAttempts;
      const nextLastContacted = patch.incrementAttempt
        ? now
        : (currentCons?.last_contacted_at as string | null) ?? null;
      const nextScheduledAt =
        patch.scheduledAt !== undefined
          ? patch.scheduledAt
            ? sanitizeSingleLine(patch.scheduledAt, 64)
            : null
          : (currentCons?.scheduled_at as string | null) ?? null;
      const nextCompletedAt =
        nextStatus === 'completed'
          ? (currentCons?.completed_at as string | null) ?? now
          : nextStatus === 'declined' || nextStatus === 'closed'
            ? (currentCons?.completed_at as string | null) ?? null
            : null;

      this.db
        .prepare(
          `INSERT INTO consultation_requests
           (id, submission_id, requested_at, preference, review_category, auto_categorized, matched_rule_label,
            reviewed_at, reviewed_by, status, status_updated_at, assigned_staff_member, contact_attempts,
            last_contacted_at, scheduled_at, completed_at, outcome_notes, updated_at)
           VALUES (?, ?, ?, 'none', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(submission_id) DO UPDATE SET
             review_category = excluded.review_category,
             auto_categorized = excluded.auto_categorized,
             matched_rule_label = excluded.matched_rule_label,
             reviewed_at = excluded.reviewed_at,
             reviewed_by = excluded.reviewed_by,
             status = excluded.status,
             status_updated_at = excluded.status_updated_at,
             assigned_staff_member = excluded.assigned_staff_member,
             contact_attempts = excluded.contact_attempts,
             last_contacted_at = excluded.last_contacted_at,
             scheduled_at = excluded.scheduled_at,
             completed_at = excluded.completed_at,
             outcome_notes = excluded.outcome_notes,
             updated_at = excluded.updated_at`
        )
        .run(
          generatePrivateId('cons'),
          id,
          now,
          nextReviewCategory,
          nextAutoCategorized,
          nextMatchedRuleLabel,
          nextReviewedAt,
          nextReviewedBy,
          nextStatus,
          nextStatusUpdatedAt,
          nextAssigned,
          nextAttempts,
          nextLastContacted,
          nextScheduledAt,
          nextCompletedAt,
          nextNotes,
          now
        );

      this.db
        .prepare('UPDATE assessment_submissions SET updated_at = ? WHERE id = ?')
        .run(now, id);

      this.insertEventSync(
        id,
        'consultation_updated',
        'staff',
        actorLabel,
        {
          status: nextStatus,
          reviewCategory: nextReviewCategory,
          assignedStaffMember: nextAssigned,
          contactAttempts: nextAttempts,
        },
        now
      );

      const updated = this.db
        .prepare('SELECT * FROM assessment_submissions WHERE id = ?')
        .get(id) as Record<string, unknown>;
      return this.hydrateRecordSync(updated, true);
    });
  }

  async computeAnalytics(
    filters: AdminSubmissionFilters = {}
  ): Promise<AdminAnalyticsSummary> {
    const allAll = await this.listSubmissions({ includeDrafts: true });
    const filteredAll = this.filterSubmissions(allAll, {
      ...filters,
      includeDrafts: true,
    });
    const completedRecords = filteredAll.filter(
      (r) => r.completionStatus === 'submitted'
    );
    const inProgressDrafts = filteredAll.filter(
      (r) => r.completionStatus === 'in_progress'
    ).length;

    const totalStarts = filteredAll.length;
    const total = completedRecords.length;
    const completionRatePct =
      totalStarts > 0 ? Math.round((total / totalStarts) * 100) : null;

    const styleCounts: Record<string, number> = Object.fromEntries(
      PROFESSIONAL_STYLES.map((s) => [s.id, 0])
    );
    const stageCounts: Record<number, number> = Object.fromEntries(
      GROWTH_STAGES.map((s) => [s.level, 0])
    );
    const statusCounts: Record<ConsultationStatus, number> = Object.fromEntries(
      ALL_CONSULTATION_STATUSES.map((s) => [s, 0])
    ) as Record<ConsultationStatus, number>;
    const reviewCounts: Record<HumanReviewCategory, number> = Object.fromEntries(
      ALL_REVIEW_CATEGORIES.map((c) => [c, 0])
    ) as Record<HumanReviewCategory, number>;

    const pillarTotals: Record<
      string,
      {
        expSum: number;
        alignedCount: number;
        revisitCount: number;
        expLevels: [number, number, number, number, number];
      }
    > = Object.fromEntries(
      CAPABILITY_PILLARS.map((p) => [
        p.id,
        {
          expSum: 0,
          alignedCount: 0,
          revisitCount: 0,
          expLevels: [0, 0, 0, 0, 0],
        },
      ])
    );

    const buildSurveyCounter = (qId: string) => {
      const map = new Map<string, { optionId: string; label: string; count: number }>();
      for (const opt of QUESTION_MAP[qId]?.options ?? []) {
        map.set(opt.id, { optionId: opt.id, label: opt.label, count: 0 });
      }
      return map;
    };

    const audienceMap = buildSurveyCounter('profile_q01');
    const challengeMap = buildSurveyCounter('profile_q02');
    const urgencyMap = buildSurveyCounter('profile_q03');
    const financialMap = buildSurveyCounter('profile_q05');
    const janMap = buildSurveyCounter('profile_q06');

    const ikejaMap = new Map<string, number>();
    const attributionMap = new Map<string, number>();
    const geoMap = new Map<string, { location: string; state: string; count: number }>();

    let durationSum = 0;
    let consultationRequests = 0;
    let whatsappConsentedCount = 0;
    let incompleteStyleCount = 0;
    let mixedStageCount = 0;

    for (const rec of completedRecords) {
      durationSum += rec.durationMinutes || 1;
      if (rec.result.nextStep?.wantsConsultation) consultationRequests += 1;
      if (rec.answers.contact.whatsappConsent) whatsappConsentedCount += 1;

      statusCounts[rec.consultation.status] =
        (statusCounts[rec.consultation.status] ?? 0) + 1;
      reviewCounts[rec.consultation.reviewCategory] =
        (reviewCounts[rec.consultation.reviewCategory] ?? 0) + 1;

      if (rec.result.professionalStyle?.status === 'incomplete_configuration') {
        incompleteStyleCount += 1;
      } else {
        const leadStyle = rec.result.professionalStyle?.leadingStyles?.[0];
        if (leadStyle) {
          styleCounts[leadStyle.styleId] =
            (styleCounts[leadStyle.styleId] ?? 0) + 1;
        }
      }

      const stageLevel = rec.result.growthJourney?.roundedStageLevel;
      if (stageLevel) {
        stageCounts[stageLevel] = (stageCounts[stageLevel] ?? 0) + 1;
      }
      if (rec.result.growthJourney?.mixedStageFlag) {
        mixedStageCount += 1;
      }

      for (const cap of rec.result.capabilities ?? []) {
        const entry = pillarTotals[cap.pillarId];
        if (entry) {
          entry.expSum += cap.experienceScore;
          if (cap.understandingScore === 1) entry.alignedCount += 1;
          else entry.revisitCount += 1;
          entry.expLevels[cap.experienceScore] += 1;
        }
      }

      const incCounter = (
        map: Map<string, { optionId: string; label: string; count: number }>,
        qId: string
      ) => {
        const optId = rec.answers.selections[qId] || 'unspecified';
        const existing = map.get(optId);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(optId, {
            optionId: optId,
            label:
              QUESTION_MAP[qId]?.options.find((o) => o.id === optId)?.label ??
              'Unspecified',
            count: 1,
          });
        }
      };

      incCounter(audienceMap, 'profile_q01');
      incCounter(challengeMap, 'profile_q02');
      incCounter(urgencyMap, 'profile_q03');
      incCounter(financialMap, 'profile_q05');
      incCounter(janMap, 'profile_q06');

      const q4Label = resolveQuestionOptionLabel(rec, 'profile_q04');
      ikejaMap.set(q4Label, (ikejaMap.get(q4Label) ?? 0) + 1);

      const sourceKey =
        rec.attribution.utmSource ||
        rec.attribution.discoverySourceLabel ||
        'Unknown / Direct';
      attributionMap.set(sourceKey, (attributionMap.get(sourceKey) ?? 0) + 1);

      const city = rec.answers.contact.city.trim() || 'Unspecified';
      const state = rec.answers.contact.state.trim() || 'Unspecified';
      const geoKey = `${city.toLowerCase()}::${state.toLowerCase()}`;
      const existingGeo = geoMap.get(geoKey);
      if (existingGeo) {
        existingGeo.count += 1;
      } else {
        geoMap.set(geoKey, {
          location: city === state ? city : `${city}, ${state}`,
          state,
          count: 1,
        });
      }
    }

    const consultationRequestRatePct =
      total > 0 ? Math.round((consultationRequests / total) * 100) : null;
    const consultationConversionOutcomes = {
      scheduledCount: statusCounts.scheduled ?? 0,
      completedCount: statusCounts.completed ?? 0,
      declinedOrClosedCount:
        (statusCounts.declined ?? 0) + (statusCounts.closed ?? 0),
    };

    const questionAnalytics = this.computeQuestionAnalyticsSync(filteredAll);
    const campaignPerformance = this.computeCampaignPerformanceSync(filteredAll);

    const partAConfig = this.getPartAScoringConfigSync();
    return {
      totalStarts,
      totalSubmissions: total,
      completionRatePct,
      inProgressDrafts,
      consultationRequests,
      consultationRequestRatePct,
      consultationConversionOutcomes,
      whatsappConsentedCount,
      averageDurationMinutes:
        total > 0 ? Math.round((durationSum / total) * 10) / 10 : null,
      partAConfigApproved: partAConfig.approved,
      incompleteStyleCount,
      mixedStageCount,
      styleDistribution: PROFESSIONAL_STYLES.map((s) => ({
        styleId: s.id,
        name: s.name,
        leadCount: styleCounts[s.id] ?? 0,
      })),
      stageDistribution: GROWTH_STAGES.map((s) => ({
        level: s.level,
        name: s.name,
        count: stageCounts[s.level] ?? 0,
      })),
      pillarAverages: CAPABILITY_PILLARS.map((p) => {
        const totals = pillarTotals[p.id];
        return {
          pillarId: p.id,
          name: p.name,
          avgExperience:
            total > 0 ? Math.round((totals.expSum / total) * 10) / 10 : 0,
          understandingAlignedCount: totals.alignedCount,
          understandingRevisitCount: totals.revisitCount,
          understandingAlignmentRate:
            total > 0 ? Math.round((totals.alignedCount / total) * 100) : 0,
          experienceDistribution: ([0, 1, 2, 3, 4] as const).map((lvl) => ({
            level: lvl,
            count: totals.expLevels[lvl],
          })),
        };
      }),
      audienceSegments: Array.from(audienceMap.values()),
      challengesBreakdown: Array.from(challengeMap.values()),
      urgencyBreakdown: Array.from(urgencyMap.values()),
      geographicBreakdown: Array.from(geoMap.values()).sort(
        (a, b) => b.count - a.count
      ),
      financialReadinessBreakdown: Array.from(financialMap.values()),
      januaryCohortBreakdown: Array.from(janMap.values()),
      ikejaAttendanceBreakdown: Array.from(ikejaMap.entries()).map(
        ([label, count]) => ({ label, count })
      ),
      attributionBreakdown: Array.from(attributionMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      consultationStatusCounts: statusCounts,
      reviewCategoryCounts: reviewCounts,
      questionAnalytics,
      campaignPerformance,
    };
  }

  private computeQuestionAnalyticsSync(filteredAll: SubmissionRecord[]) {
    const filteredIds = new Set(filteredAll.map((r) => r.id));
    const activeVersion = this.getActiveAssessmentVersionSync();
    const trackableQuestions = activeVersion.questions.filter(
      (q) => q.active !== false
    );

    const perQStats = new Map<
      string,
      {
        viewsSubs: Set<string>;
        responseSubs: Set<string>;
        changesCount: number;
        backClicksCount: number;
        abandonmentsCount: number;
        activeMsBySub: Map<string, number>;
        inactiveMsBySub: Map<string, number>;
      }
    >();

    for (const q of trackableQuestions) {
      perQStats.set(q.id, {
        viewsSubs: new Set<string>(),
        responseSubs: new Set<string>(),
        changesCount: 0,
        backClicksCount: 0,
        abandonmentsCount: 0,
        activeMsBySub: new Map<string, number>(),
        inactiveMsBySub: new Map<string, number>(),
      });
    }

    const sectionEntered = new Map<AssessmentSectionId, Set<string>>();
    const sectionCompleted = new Map<AssessmentSectionId, Set<string>>();
    for (const sec of ASSESSMENT_SECTIONS) {
      sectionEntered.set(sec.id, new Set<string>());
      sectionCompleted.set(sec.id, new Set<string>());
    }

    let totalAbandonedSessions = 0;

    if (filteredIds.size > 0) {
      const allTelemetry = this.db
        .prepare(
          'SELECT * FROM question_telemetry_events ORDER BY created_at ASC'
        )
        .all() as Array<Record<string, unknown>>;

      const lastDisplayedBySub = new Map<string, string>();
      const abandonedSubs = new Set<string>();

      for (const row of allTelemetry) {
        const subId = String(row.submission_id ?? '');
        if (!filteredIds.has(subId)) continue;

        const evtType = String(row.event_type ?? '');
        const secId = String(row.section_id ?? '') as AssessmentSectionId;
        const qId = String(row.question_id ?? '');
        const activeMs = Number(row.active_time_ms ?? 0);
        const inactiveMs = Number(row.inactive_time_ms ?? 0);

        if (secId && sectionEntered.has(secId)) {
          if (evtType === 'section_entered' || evtType === 'question_displayed') {
            sectionEntered.get(secId)!.add(subId);
          }
          if (evtType === 'section_completed') {
            sectionEntered.get(secId)!.add(subId);
            sectionCompleted.get(secId)!.add(subId);
          }
        }

        if (evtType === 'assessment_abandoned') {
          abandonedSubs.add(subId);
        }

        const qEntry = qId ? perQStats.get(qId) : undefined;
        if (!qEntry) continue;

        if (evtType === 'question_displayed') {
          qEntry.viewsSubs.add(subId);
          lastDisplayedBySub.set(subId, qId);
        } else if (evtType === 'answer_selected') {
          qEntry.viewsSubs.add(subId);
          qEntry.responseSubs.add(subId);
        } else if (evtType === 'answer_changed') {
          qEntry.viewsSubs.add(subId);
          qEntry.responseSubs.add(subId);
          qEntry.changesCount += 1;
        } else if (
          evtType === 'continue_clicked' ||
          evtType === 'back_clicked' ||
          evtType === 'assessment_abandoned' ||
          evtType === 'assessment_submitted'
        ) {
          qEntry.viewsSubs.add(subId);
          if (evtType === 'continue_clicked' || evtType === 'assessment_submitted') {
            qEntry.responseSubs.add(subId);
          }
          if (evtType === 'back_clicked') {
            qEntry.backClicksCount += 1;
          }
          if (activeMs > 0) {
            qEntry.activeMsBySub.set(
              subId,
              (qEntry.activeMsBySub.get(subId) ?? 0) + activeMs
            );
          }
          if (inactiveMs > 0) {
            qEntry.inactiveMsBySub.set(
              subId,
              (qEntry.inactiveMsBySub.get(subId) ?? 0) + inactiveMs
            );
          }
        }
      }

      // Count abandonments for incomplete/abandoned filtered sessions on their last displayed question
      for (const rec of filteredAll) {
        if (rec.completionStatus === 'in_progress' || abandonedSubs.has(rec.id)) {
          if (rec.completionStatus === 'in_progress') {
            totalAbandonedSessions += 1;
            const lastQ = lastDisplayedBySub.get(rec.id);
            if (lastQ && perQStats.has(lastQ)) {
              perQStats.get(lastQ)!.abandonmentsCount += 1;
            }
          }
        } else if (rec.completionStatus === 'submitted') {
          // Submitted records completed all four sections
          for (const sec of ASSESSMENT_SECTIONS) {
            sectionEntered.get(sec.id)!.add(rec.id);
            sectionCompleted.get(sec.id)!.add(rec.id);
          }
        }
      }
    }

    const computeMedian = (values: number[]): number | null => {
      if (values.length === 0) return null;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const raw =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      return Math.round((raw / 1000) * 10) / 10;
    };

    const questions: QuestionAnalyticsItem[] = trackableQuestions.map((q) => {
      const entry = perQStats.get(q.id)!;
      const activeSamples = Array.from(entry.activeMsBySub.values());
      const inactiveSamples = Array.from(entry.inactiveMsBySub.values());
      const avgActive =
        activeSamples.length > 0
          ? Math.round(
              (activeSamples.reduce((a, b) => a + b, 0) /
                activeSamples.length /
                1000) *
                10
            ) / 10
          : null;
      const avgInactive =
        inactiveSamples.length > 0
          ? Math.round(
              (inactiveSamples.reduce((a, b) => a + b, 0) /
                inactiveSamples.length /
                1000) *
                10
            ) / 10
          : null;

      return {
        questionId: q.id,
        sectionId: q.sectionId,
        prompt: q.prompt,
        viewsCount: entry.viewsSubs.size,
        responsesCount: entry.responseSubs.size,
        changesCount: entry.changesCount,
        backClicksCount: entry.backClicksCount,
        abandonmentsCount: entry.abandonmentsCount,
        sampleCount: activeSamples.length,
        avgActiveTimeSeconds: avgActive,
        medianActiveTimeSeconds: computeMedian(activeSamples),
        avgInactiveTimeSeconds: avgInactive,
      };
    });

    const timedQuestions = questions.filter(
      (q) => q.avgActiveTimeSeconds !== null
    );
    const longestActiveQuestions = [...timedQuestions]
      .sort(
        (a, b) => (b.avgActiveTimeSeconds ?? 0) - (a.avgActiveTimeSeconds ?? 0)
      )
      .slice(0, 5);
    const shortestActiveQuestions = [...timedQuestions]
      .sort(
        (a, b) => (a.avgActiveTimeSeconds ?? 0) - (b.avgActiveTimeSeconds ?? 0)
      )
      .slice(0, 5);

    const sectionDropOff: SectionDropOffItem[] = ASSESSMENT_SECTIONS.map(
      (sec) => {
        const enteredCount = sectionEntered.get(sec.id)!.size;
        const completedCount = sectionCompleted.get(sec.id)!.size;
        const dropOffCount = Math.max(0, enteredCount - completedCount);
        const dropOffRatePct =
          enteredCount > 0
            ? Math.round((dropOffCount / enteredCount) * 100)
            : null;
        return {
          sectionId: sec.id,
          code: sec.code,
          title: sec.title,
          enteredCount,
          completedCount,
          dropOffCount,
          dropOffRatePct,
        };
      }
    );

    return {
      questions,
      longestActiveQuestions,
      shortestActiveQuestions,
      sectionDropOff,
      totalAbandonedSessions,
      timingNote:
        'Active time excludes hidden or inactive browser tabs. Time alone reflects interaction duration and must not be interpreted as question difficulty.',
    };
  }

  private computeCampaignPerformanceSync(
    filteredAll: SubmissionRecord[]
  ): CampaignPerformanceItem[] {
    const costRows = this.listCampaignCostsSync();
    const costByKey = new Map<string, CampaignCostRecord>();
    for (const c of costRows) {
      costByKey.set(c.campaignKey.toLowerCase(), c);
    }

    const groups = new Map<
      string,
      {
        utmSource: string;
        utmMedium: string;
        utmCampaign: string;
        adSet: string;
        creative: string;
        placement: string;
        startsCount: number;
        completionsCount: number;
        consultationRequestsCount: number;
        conversionOutcomesCount: number;
      }
    >();

    const fallbackVal = (v: string) => v.trim() || 'unknown/direct';

    for (const rec of filteredAll) {
      const utmSource = fallbackVal(rec.attribution.utmSource);
      const utmMedium = fallbackVal(rec.attribution.utmMedium);
      const utmCampaign = fallbackVal(rec.attribution.utmCampaign);
      const adSet = fallbackVal(rec.attribution.adSet);
      const creative = fallbackVal(rec.attribution.creative);
      const placement = fallbackVal(rec.attribution.placement);
      const key = `${utmSource}::${utmMedium}::${utmCampaign}::${adSet}::${creative}::${placement}`;

      let entry = groups.get(key);
      if (!entry) {
        entry = {
          utmSource,
          utmMedium,
          utmCampaign,
          adSet,
          creative,
          placement,
          startsCount: 0,
          completionsCount: 0,
          consultationRequestsCount: 0,
          conversionOutcomesCount: 0,
        };
        groups.set(key, entry);
      }

      entry.startsCount += 1;
      if (rec.completionStatus === 'submitted') {
        entry.completionsCount += 1;
        if (rec.result.nextStep?.wantsConsultation) {
          entry.consultationRequestsCount += 1;
        }
        if (
          rec.consultation.status === 'scheduled' ||
          rec.consultation.status === 'completed'
        ) {
          entry.conversionOutcomesCount += 1;
        }
      }
    }

    return Array.from(groups.entries())
      .map(([campaignKey, g]) => {
        const simpleKey = `${g.utmSource.toLowerCase()}::${g.utmCampaign.toLowerCase()}`;
        const cost =
          costByKey.get(campaignKey.toLowerCase()) ??
          costByKey.get(simpleKey) ??
          costByKey.get(g.utmCampaign.toLowerCase());

        const completionRatePct =
          g.startsCount > 0
            ? Math.round((g.completionsCount / g.startsCount) * 100)
            : null;
        const consultationRequestRatePct =
          g.completionsCount > 0
            ? Math.round(
                (g.consultationRequestsCount / g.completionsCount) * 100
              )
            : null;
        const costPerCompletion =
          cost && g.completionsCount > 0
            ? Math.round((cost.amountSpent / g.completionsCount) * 100) / 100
            : null;

        return {
          campaignKey: `${g.utmSource} / ${g.utmCampaign}`,
          utmSource: g.utmSource,
          utmMedium: g.utmMedium,
          utmCampaign: g.utmCampaign,
          adSet: g.adSet,
          creative: g.creative,
          placement: g.placement,
          startsCount: g.startsCount,
          completionsCount: g.completionsCount,
          completionRatePct,
          consultationRequestsCount: g.consultationRequestsCount,
          consultationRequestRatePct,
          conversionOutcomesCount: g.conversionOutcomesCount,
          amountSpent: cost ? cost.amountSpent : null,
          currency: cost ? cost.currency : null,
          costPerCompletion,
        };
      })
      .sort((a, b) => b.startsCount - a.startsCount);
  }

  async recordTelemetryBatch(
    submissionId: string,
    rawEvents: unknown
  ): Promise<{ inserted: number }> {
    const events = sanitizeTelemetryBatch(rawEvents);
    if (events.length === 0) return { inserted: 0 };

    const exists = this.db
      .prepare('SELECT id FROM assessment_submissions WHERE id = ?')
      .get(submissionId) as { id?: string } | undefined;
    if (!exists) return { inserted: 0 };

    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `INSERT INTO question_telemetry_events
       (id, submission_id, event_type, section_id, question_id, option_id,
        previous_option_id, active_time_ms, inactive_time_ms, wall_time_ms,
        client_timestamp, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    return this.runInTransaction(() => {
      for (const evt of events) {
        stmt.run(
          generatePrivateId('tel'),
          submissionId,
          evt.eventType,
          evt.sectionId,
          evt.questionId,
          evt.optionId,
          evt.previousOptionId,
          evt.activeTimeMs,
          evt.inactiveTimeMs,
          evt.wallTimeMs,
          evt.clientTimestamp || now,
          JSON.stringify(evt.metadata),
          now
        );
      }
      return { inserted: events.length };
    });
  }

  private listCampaignCostsSync(): CampaignCostRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM campaign_costs ORDER BY updated_at DESC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      campaignKey: String(r.campaign_key),
      utmSource: String(r.utm_source ?? ''),
      utmCampaign: String(r.utm_campaign ?? ''),
      currency: String(r.currency ?? 'NGN'),
      amountSpent: Number(r.amount_spent ?? 0),
      periodLabel: String(r.period_label ?? ''),
      notes: String(r.notes ?? ''),
      updatedAt: String(r.updated_at),
    }));
  }

  listCampaignCosts(): CampaignCostRecord[] {
    return this.listCampaignCostsSync();
  }

  upsertCampaignCost(input: {
    utmSource: string;
    utmCampaign: string;
    currency: string;
    amountSpent: number;
    periodLabel?: string;
    notes?: string;
  }): CampaignCostRecord {
    const utmSource = sanitizeSingleLine(input.utmSource, 120) || 'unknown/direct';
    const utmCampaign =
      sanitizeSingleLine(input.utmCampaign, 160) || 'unknown/direct';
    const campaignKey = `${utmSource.toLowerCase()}::${utmCampaign.toLowerCase()}`;
    const currency = sanitizeSingleLine(input.currency || 'NGN', 12).toUpperCase();
    const amountSpent = Math.max(0, Number(input.amountSpent) || 0);
    const periodLabel = sanitizeSingleLine(input.periodLabel ?? '', 80);
    const notes = sanitizeSingleLine(input.notes ?? '', 300);
    const now = new Date().toISOString();
    const id = generatePrivateId('cost');

    this.db
      .prepare(
        `INSERT INTO campaign_costs
         (id, campaign_key, utm_source, utm_campaign, currency, amount_spent, period_label, notes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(campaign_key) DO UPDATE SET
           currency = excluded.currency,
           amount_spent = excluded.amount_spent,
           period_label = excluded.period_label,
           notes = excluded.notes,
           updated_at = excluded.updated_at`
      )
      .run(
        id,
        campaignKey,
        utmSource,
        utmCampaign,
        currency,
        amountSpent,
        periodLabel,
        notes,
        now
      );

    const row = this.db
      .prepare('SELECT * FROM campaign_costs WHERE campaign_key = ?')
      .get(campaignKey) as Record<string, unknown>;
    return {
      id: String(row.id),
      campaignKey: String(row.campaign_key),
      utmSource: String(row.utm_source),
      utmCampaign: String(row.utm_campaign),
      currency: String(row.currency),
      amountSpent: Number(row.amount_spent),
      periodLabel: String(row.period_label),
      notes: String(row.notes),
      updatedAt: String(row.updated_at),
    };
  }

  private getActiveAssessmentVersionSync(): AssessmentVersionRecord {
    const row = this.db
      .prepare(
        "SELECT * FROM assessment_versions WHERE status = 'active' ORDER BY activated_at DESC, created_at DESC LIMIT 1"
      )
      .get() as Record<string, unknown> | undefined;
    if (!row) {
      return {
        versionId: ASSESSMENT_VERSION,
        label: 'Baseline Discovery Assessment',
        status: 'active',
        createdBy: 'system',
        changeSummary: 'Default specification configuration',
        questions: ASSESSMENT_QUESTIONS,
        sections: ASSESSMENT_SECTIONS,
        partAConfigVersion: PART_A_CONFIG_VERSION,
        createdAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
      };
    }
    return this.mapVersionRow(row);
  }

  private mapVersionRow(row: Record<string, unknown>): AssessmentVersionRecord {
    return {
      versionId: String(row.version_id),
      label: String(row.label),
      status: row.status as AssessmentVersionRecord['status'],
      createdBy: String(row.created_by ?? 'system'),
      changeSummary: String(row.change_summary ?? ''),
      questions: JSON.parse(String(row.questions_json)) as AssessmentQuestion[],
      sections: JSON.parse(String(row.sections_json)) as AssessmentSectionMeta[],
      partAConfigVersion: String(row.part_a_config_version),
      createdAt: String(row.created_at),
      activatedAt: row.activated_at ? String(row.activated_at) : null,
    };
  }

  private getAssessmentVersionOrActiveSync(
    versionId: string
  ): AssessmentVersionRecord {
    const cleanId = sanitizeSingleLine(versionId, 64);
    if (cleanId) {
      const row = this.db
        .prepare('SELECT * FROM assessment_versions WHERE version_id = ?')
        .get(cleanId) as Record<string, unknown> | undefined;
      if (row) return this.mapVersionRow(row);
    }
    return this.getActiveAssessmentVersionSync();
  }

  private getPartAScoringConfigSync(): PartAScoringConfig {
    const row = this.db
      .prepare('SELECT value_json FROM system_configs WHERE config_key = ?')
      .get('part_a_scoring') as { value_json?: string } | undefined;
    if (!row?.value_json) {
      return DEFAULT_PART_A_SCORING_CONFIG;
    }
    try {
      const parsed = JSON.parse(row.value_json) as Partial<PartAScoringConfig>;
      const rawThreshold =
        typeof parsed.closeScoreThreshold === 'number' &&
        Number.isFinite(parsed.closeScoreThreshold)
          ? Math.max(0, Math.min(9, Math.round(parsed.closeScoreThreshold)))
          : DEFAULT_PART_A_SCORING_CONFIG.closeScoreThreshold;
      return {
        approved: Boolean(parsed.approved),
        closeScoreThreshold: rawThreshold,
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        optionToStyle: {
          ...DEFAULT_PART_A_SCORING_CONFIG.optionToStyle,
          ...(parsed.optionToStyle ?? {}),
        },
      };
    } catch {
      return DEFAULT_PART_A_SCORING_CONFIG;
    }
  }

  getPartAScoringConfig(): PartAScoringConfig {
    return this.getPartAScoringConfigSync();
  }

  savePartAScoringConfig(
    input: PartAScoringConfig,
    actorLabel = 'Admin'
  ): PartAScoringConfig {
    const activeVersion = this.getActiveAssessmentVersionSync();
    const rawThreshold =
      typeof input.closeScoreThreshold === 'number' &&
      Number.isFinite(input.closeScoreThreshold)
        ? Math.max(0, Math.min(9, Math.round(input.closeScoreThreshold)))
        : DEFAULT_PART_A_SCORING_CONFIG.closeScoreThreshold;
    const normalized: PartAScoringConfig = {
      approved: Boolean(input.approved),
      closeScoreThreshold: rawThreshold,
      notes: sanitizeMultiline(input.notes ?? '', 800),
      optionToStyle: { ...(input.optionToStyle ?? {}) },
    };
    const validation = validatePartAScoringConfig(
      normalized,
      activeVersion.questions
    );
    if (normalized.approved && !validation.valid) {
      throw new DomainValidationError(
        'INCOMPLETE_SCORING_CONFIG',
        `Cannot approve Part A scoring until all active orientation options are assigned to one of the six styles (${validation.missingOptionIds.length} unmapped, ${validation.invalidOptionIds.length} invalid).`,
        validation.missingOptionIds
      );
    }
    if (validation.invalidOptionIds.length > 0) {
      throw new DomainValidationError(
        'INVALID_STYLE_MAPPING',
        'One or more options were mapped to an unknown style ID.'
      );
    }
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO system_configs (config_key, value_json, updated_at, updated_by)
         VALUES ('part_a_scoring', ?, ?, ?)
         ON CONFLICT(config_key) DO UPDATE SET
           value_json = excluded.value_json,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`
      )
      .run(JSON.stringify(normalized), now, sanitizeSingleLine(actorLabel, 120));
    return normalized;
  }

  private getLeadSegmentationConfigSync(): LeadSegmentationConfig {
    const row = this.db
      .prepare('SELECT value_json FROM system_configs WHERE config_key = ?')
      .get('lead_segmentation') as { value_json?: string } | undefined;
    if (!row?.value_json) {
      return DEFAULT_LEAD_SEGMENTATION_CONFIG;
    }
    try {
      const parsed = JSON.parse(row.value_json) as Partial<LeadSegmentationConfig>;
      return {
        approved: Boolean(parsed.approved),
        version:
          typeof parsed.version === 'string' && parsed.version
            ? parsed.version
            : DEFAULT_LEAD_SEGMENTATION_CONFIG.version,
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        defaultCategory: ALL_REVIEW_CATEGORIES.includes(
          parsed.defaultCategory as HumanReviewCategory
        )
          ? (parsed.defaultCategory as HumanReviewCategory)
          : 'unreviewed',
        rules: Array.isArray(parsed.rules) ? parsed.rules : [],
      };
    } catch {
      return DEFAULT_LEAD_SEGMENTATION_CONFIG;
    }
  }

  getLeadSegmentationConfig(): LeadSegmentationConfig {
    return this.getLeadSegmentationConfigSync();
  }

  saveLeadSegmentationConfig(
    input: LeadSegmentationConfig,
    actorLabel = 'Admin'
  ): LeadSegmentationConfig {
    const normalized: LeadSegmentationConfig = {
      approved: Boolean(input.approved),
      version:
        sanitizeSingleLine(input.version || '', 64) ||
        (input.approved ? 'approved-v1' : 'pending-approval-v1'),
      notes: sanitizeMultiline(input.notes ?? '', 800),
      defaultCategory: ALL_REVIEW_CATEGORIES.includes(input.defaultCategory)
        ? input.defaultCategory
        : 'unreviewed',
      rules: Array.isArray(input.rules)
        ? input.rules.map((r, idx) => ({
            id: sanitizeIdToken(r.id || '', 64) || `rule_${idx + 1}`,
            label: sanitizeSingleLine(r.label ?? '', 140),
            enabled: Boolean(r.enabled),
            targetCategory: r.targetCategory,
            priorityRank: Number.isFinite(Number(r.priorityRank))
              ? Number(r.priorityRank)
              : idx + 1,
            conditions: r.conditions ?? {},
          }))
        : [],
    };
    const validation = validateLeadSegmentationConfig(normalized);
    if (!validation.valid) {
      throw new DomainValidationError(
        'INVALID_SEGMENTATION_CONFIG',
        validation.errors[0] || 'Invalid lead segmentation configuration.'
      );
    }
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO system_configs (config_key, value_json, updated_at, updated_by)
         VALUES ('lead_segmentation', ?, ?, ?)
         ON CONFLICT(config_key) DO UPDATE SET
           value_json = excluded.value_json,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`
      )
      .run(JSON.stringify(normalized), now, sanitizeSingleLine(actorLabel, 120));
    return normalized;
  }

  applyLeadSegmentationToUnreviewed(actorLabel = 'Admin'): {
    updatedCount: number;
    skippedManualCount: number;
  } {
    const config = this.getLeadSegmentationConfigSync();
    if (!config.approved) {
      throw new DomainValidationError(
        'SEGMENTATION_NOT_APPROVED',
        'Lead segmentation rules must be approved before applying to records.'
      );
    }
    const now = new Date().toISOString();
    const submittedRows = this.db
      .prepare(
        "SELECT * FROM assessment_submissions WHERE completion_status = 'submitted'"
      )
      .all() as Array<Record<string, unknown>>;

    let updatedCount = 0;
    let skippedManualCount = 0;

    this.runInTransaction(() => {
      for (const row of submittedRows) {
        const rec = this.hydrateRecordSync(row);
        const reviewedBy = rec.consultation.reviewedBy;
        const isManualOverride =
          Boolean(reviewedBy) && reviewedBy !== 'auto:segmentation';
        if (isManualOverride) {
          skippedManualCount += 1;
          continue;
        }
        const segEval = evaluateLeadSegmentation(rec.answers, config);
        this.db
          .prepare(
            `UPDATE consultation_requests
             SET review_category = ?,
                 auto_categorized = ?,
                 matched_rule_label = ?,
                 reviewed_at = ?,
                 reviewed_by = ?,
                 updated_at = ?
             WHERE submission_id = ?`
          )
          .run(
            segEval.category,
            segEval.autoCategorized ? 1 : 0,
            segEval.matchedRuleLabel,
            segEval.autoCategorized ? now : null,
            segEval.autoCategorized ? 'auto:segmentation' : '',
            now,
            rec.id
          );
        updatedCount += 1;
      }
    });

    if (updatedCount > 0) {
      this.insertEventSync(
        submittedRows[0] ? String(submittedRows[0].id) : '',
        'consultation_updated',
        'staff',
        actorLabel,
        { action: 'batch_segmentation_applied', updatedCount },
        now
      );
    }

    return { updatedCount, skippedManualCount };
  }

  getActiveAssessmentVersion(): AssessmentVersionRecord {
    return this.getActiveAssessmentVersionSync();
  }

  listAssessmentVersions(): AssessmentVersionRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM assessment_versions ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapVersionRow(r));
  }

  createAssessmentVersion(input: {
    versionId: string;
    label: string;
    changeSummary: string;
    questions: AssessmentQuestion[];
    sections?: AssessmentSectionMeta[];
    createdBy: string;
    activateImmediately?: boolean;
  }): AssessmentVersionRecord {
    const versionId = sanitizeSingleLine(input.versionId, 64).replace(
      /[^a-zA-Z0-9_.-]/g,
      '-'
    );
    if (!versionId) {
      throw new DomainValidationError(
        'INVALID_VERSION_ID',
        'Assessment version ID is required.'
      );
    }

    const existing = this.db
      .prepare('SELECT version_id FROM assessment_versions WHERE version_id = ?')
      .get(versionId);
    if (existing) {
      throw new DomainConflictError(
        'VERSION_EXISTS',
        `Assessment version "${versionId}" already exists. Any edits must create a new version ID so historical submissions retain their exact version.`
      );
    }

    if (!Array.isArray(input.questions) || input.questions.length === 0) {
      throw new DomainValidationError(
        'EMPTY_QUESTIONS',
        'An assessment version must contain at least one question.'
      );
    }

    const now = new Date().toISOString();
    const status = input.activateImmediately ? 'active' : 'draft';

    return this.runInTransaction(() => {
      if (input.activateImmediately) {
        this.db
          .prepare(
            "UPDATE assessment_versions SET status = 'archived' WHERE status = 'active'"
          )
          .run();
      }
      this.db
        .prepare(
          `INSERT INTO assessment_versions
           (version_id, label, status, created_by, change_summary, questions_json, sections_json, part_a_config_version, created_at, activated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          versionId,
          sanitizeSingleLine(input.label || versionId, 120),
          status,
          sanitizeSingleLine(input.createdBy || 'staff', 120),
          sanitizeMultiline(input.changeSummary || 'Updated question configuration.', 500),
          JSON.stringify(input.questions),
          JSON.stringify(input.sections ?? ASSESSMENT_SECTIONS),
          PART_A_CONFIG_VERSION,
          now,
          input.activateImmediately ? now : null
        );

      const created = this.db
        .prepare('SELECT * FROM assessment_versions WHERE version_id = ?')
        .get(versionId) as Record<string, unknown>;
      return this.mapVersionRow(created);
    });
  }

  activateAssessmentVersion(versionId: string): AssessmentVersionRecord | null {
    const cleanId = sanitizeSingleLine(versionId, 64);
    const now = new Date().toISOString();
    return this.runInTransaction(() => {
      const target = this.db
        .prepare('SELECT * FROM assessment_versions WHERE version_id = ?')
        .get(cleanId) as Record<string, unknown> | undefined;
      if (!target) return null;

      this.db
        .prepare(
          "UPDATE assessment_versions SET status = 'archived' WHERE status = 'active'"
        )
        .run();
      this.db
        .prepare(
          "UPDATE assessment_versions SET status = 'active', activated_at = ? WHERE version_id = ?"
        )
        .run(now, cleanId);

      const updated = this.db
        .prepare('SELECT * FROM assessment_versions WHERE version_id = ?')
        .get(cleanId) as Record<string, unknown>;
      return this.mapVersionRow(updated);
    });
  }

  recordCommunicationMessage(input: {
    submissionId: string;
    channel: CommunicationChannel;
    messageType: CommunicationTemplateType;
    recipient: string;
    subject: string;
    bodyPreview: string;
    provider: string;
    status: CommunicationDeliveryStatus;
    externalMessageId?: string;
    errorDetail?: string;
    sentBy: string;
  }): CommunicationMessageRecord {
    const id = generatePrivateId('msg');
    const now = new Date().toISOString();

    return this.runInTransaction(() => {
      this.db
        .prepare(
          `INSERT INTO communication_messages
           (id, submission_id, channel, message_type, recipient, subject, body_preview,
            provider, status, external_message_id, error_detail, sent_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          input.submissionId,
          input.channel,
          input.messageType,
          sanitizeSingleLine(input.recipient, 160),
          sanitizeSingleLine(input.subject, 200),
          sanitizeMultiline(input.bodyPreview, 400),
          sanitizeSingleLine(input.provider, 48),
          input.status,
          sanitizeSingleLine(input.externalMessageId ?? '', 120),
          sanitizeSingleLine(input.errorDetail ?? '', 300),
          sanitizeSingleLine(input.sentBy, 120),
          now,
          now
        );

      const mappedDeliveryStatus: ReportDeliveryEventRecord['status'] =
        input.status === 'sent' ||
        input.status === 'delivered' ||
        input.status === 'read' ||
        input.status === 'replied'
          ? 'sent'
          : input.status === 'skipped_no_provider'
            ? 'skipped_no_provider'
            : input.status === 'skipped_no_consent' ||
                input.status === 'blocked_preference'
              ? 'skipped_no_consent'
              : 'failed';

      this.insertDeliveryEventSync(
        input.submissionId,
        input.channel,
        mappedDeliveryStatus,
        input.recipient,
        input.provider,
        input.errorDetail || `${input.messageType} (${input.status})`,
        now
      );

      this.insertEventSync(
        input.submissionId,
        'communication_dispatched',
        'staff',
        input.sentBy,
        {
          channel: input.channel,
          messageType: input.messageType,
          status: input.status,
          provider: input.provider,
        },
        now
      );

      const row = this.db
        .prepare('SELECT * FROM communication_messages WHERE id = ?')
        .get(id) as Record<string, unknown>;
      return this.mapCommRow(row);
    });
  }

  private mapCommRow(row: Record<string, unknown>): CommunicationMessageRecord {
    return {
      id: String(row.id),
      submissionId: String(row.submission_id),
      channel: row.channel as CommunicationChannel,
      messageType: row.message_type as CommunicationTemplateType,
      recipient: String(row.recipient ?? ''),
      subject: String(row.subject ?? ''),
      bodyPreview: String(row.body_preview ?? ''),
      provider: String(row.provider ?? ''),
      status: row.status as CommunicationDeliveryStatus,
      externalMessageId: String(row.external_message_id ?? ''),
      errorDetail: String(row.error_detail ?? ''),
      sentBy: String(row.sent_by ?? ''),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  listCommunicationMessages(options?: {
    submissionId?: string;
    channel?: CommunicationChannel;
    limit?: number;
  }): CommunicationMessageRecord[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (options?.submissionId) {
      clauses.push('submission_id = ?');
      params.push(options.submissionId);
    }
    if (options?.channel) {
      clauses.push('channel = ?');
      params.push(options.channel);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(200, Math.max(1, options?.limit ?? 100));
    const rows = this.db
      .prepare(
        `SELECT * FROM communication_messages ${where} ORDER BY created_at DESC LIMIT ?`
      )
      .all(...params, limit) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapCommRow(r));
  }

  updateCommunicationMessageStatus(
    messageId: string,
    status: CommunicationDeliveryStatus,
    errorDetail?: string
  ): CommunicationMessageRecord | null {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare('SELECT * FROM communication_messages WHERE id = ?')
      .get(messageId) as Record<string, unknown> | undefined;
    if (!existing) return null;

    this.db
      .prepare(
        'UPDATE communication_messages SET status = ?, error_detail = COALESCE(?, error_detail), updated_at = ? WHERE id = ?'
      )
      .run(
        status,
        errorDetail !== undefined ? sanitizeSingleLine(errorDetail, 300) : null,
        now,
        messageId
      );

    const updated = this.db
      .prepare('SELECT * FROM communication_messages WHERE id = ?')
      .get(messageId) as Record<string, unknown>;
    return this.mapCommRow(updated);
  }

  recordCrmSyncEvent(input: {
    submissionId: string;
    provider: string;
    status: CrmSyncEventRecord['status'];
    detail: string;
    triggeredBy: string;
  }): CrmSyncEventRecord {
    const id = generatePrivateId('crm');
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO crm_sync_events
         (id, submission_id, provider, status, detail, triggered_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.submissionId,
        sanitizeSingleLine(input.provider, 48),
        input.status,
        sanitizeSingleLine(input.detail, 300),
        sanitizeSingleLine(input.triggeredBy, 120),
        now
      );

    this.insertEventSync(
      input.submissionId,
      'crm_sync_attempted',
      'staff',
      input.triggeredBy,
      { provider: input.provider, status: input.status },
      now
    );

    return {
      id,
      submissionId: input.submissionId,
      provider: input.provider,
      status: input.status,
      detail: input.detail,
      triggeredBy: input.triggeredBy,
      createdAt: now,
    };
  }

  listCrmSyncEvents(limit = 50): CrmSyncEventRecord[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM crm_sync_events ORDER BY created_at DESC LIMIT ?'
      )
      .all(Math.min(200, Math.max(1, limit))) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      submissionId: String(r.submission_id),
      provider: String(r.provider),
      status: r.status as CrmSyncEventRecord['status'],
      detail: String(r.detail ?? ''),
      triggeredBy: String(r.triggered_by ?? ''),
      createdAt: String(r.created_at),
    }));
  }

  createBackupSnapshot(targetDir?: string): { path: string; sizeBytes: number } {
    if (this.dbPath === ':memory:') {
      throw new Error('Cannot snapshot an in-memory database to disk.');
    }
    const dir = targetDir
      ? path.resolve(targetDir)
      : path.join(path.dirname(this.dbPath), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = path.join(dir, `kws-academy-backup-${stamp}.db`);
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    const escapedPath = outPath.replace(/'/g, "''");
    this.db.exec(`VACUUM INTO '${escapedPath}';`);
    const stat = fs.statSync(outPath);
    return { path: outPath, sizeBytes: stat.size };
  }

  close(): void {
    this.db.close();
  }
}

export function escapeCsvCell(value: unknown): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildExportTabularRows(records: SubmissionRecord[]): {
  headers: string[];
  rows: Array<Array<string | number>>;
} {
  const headers = [
    'ID',
    'Submitted At',
    'Assessment Version',
    'Scoring Version',
    'Part A Config Version',
    'Full Name',
    'Email',
    'WhatsApp Number',
    'City',
    'State',
    'Institution',
    'Audience Category',
    'Main Challenge',
    'Urgency',
    'Ikeja Availability',
    'Financial Readiness',
    'January 2027 Cohort',
    'Discovery Source',
    'UTM Source',
    'UTM Medium',
    'UTM Campaign',
    'Ad Set',
    'Creative',
    'Placement',
    'Referrer',
    'WhatsApp Consent',
    'Professional Style Status',
    'Lead Style',
    'Growth Stage',
    'Unrounded Stage Mean',
    'Stage Spread',
    'Mixed Stage Flag',
    'Consultation Preference',
    'Human Review Category',
    'Follow-up Status',
    'Assigned Staff Member',
    'Contact Attempts',
    'Scheduled At',
    'Duration (min)',
    'Capabilities (Understanding 0-1 / Experience 0-4)',
    'Feedback Style Fits',
    'Feedback Stage Fits',
    'Feedback Notes',
    'Outcome / Staff Notes',
  ];

  const rows: Array<Array<string | number>> = records.map((rec) => [
    rec.id,
    rec.submittedAt ?? rec.createdAt,
    rec.assessmentVersion,
    rec.scoringVersion,
    rec.partAConfigVersion,
    rec.answers.contact.fullName,
    rec.answers.contact.email,
    rec.answers.contact.whatsappNumber,
    rec.answers.contact.city,
    rec.answers.contact.state,
    rec.answers.contact.institution,
    resolveQuestionOptionLabel(rec, 'profile_q01'),
    resolveQuestionOptionLabel(rec, 'profile_q02'),
    resolveQuestionOptionLabel(rec, 'profile_q03'),
    resolveQuestionOptionLabel(rec, 'profile_q04'),
    resolveQuestionOptionLabel(rec, 'profile_q05'),
    resolveQuestionOptionLabel(rec, 'profile_q06'),
    resolveQuestionOptionLabel(rec, 'profile_q08'),
    rec.attribution.utmSource || 'unknown/direct',
    rec.attribution.utmMedium || 'unknown/direct',
    rec.attribution.utmCampaign || 'unknown/direct',
    rec.attribution.adSet || 'unknown/direct',
    rec.attribution.creative || 'unknown/direct',
    rec.attribution.placement || 'unknown/direct',
    rec.attribution.referrer || 'unknown/direct',
    rec.answers.contact.whatsappConsent ? 'Yes' : 'No',
    rec.result.professionalStyle.status,
    rec.result.professionalStyle.leadTitle,
    rec.result.growthJourney.indicativeStage.name,
    rec.result.growthJourney.unroundedAverage,
    rec.result.growthJourney.spread,
    rec.result.growthJourney.mixedStageFlag ? 'Yes' : 'No',
    rec.consultation.preference,
    rec.consultation.reviewCategory,
    rec.consultation.status,
    rec.consultation.assignedStaffMember,
    rec.consultation.contactAttempts,
    rec.consultation.scheduledAt ?? '',
    rec.durationMinutes,
    rec.result.capabilities
      .map(
        (c) =>
          `${c.name}: U=${c.understandingScore}/1, E=${c.experienceScore}/4`
      )
      .join(' | '),
    rec.feedback.archetypeFits,
    rec.feedback.stageFits,
    rec.feedback.notes,
    rec.consultation.outcomeNotes,
  ]);

  return { headers, rows };
}

export function submissionsToCsv(records: SubmissionRecord[]): string {
  const { headers, rows } = buildExportTabularRows(records);
  return '\uFEFF' + [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}

export function submissionsToXlsx(records: SubmissionRecord[]): Buffer {
  const { headers, rows } = buildExportTabularRows(records);
  return buildXlsxWorkbookBuffer('KWS Academy Submissions', [headers, ...rows]);
}
