import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_SECTIONS,
  GROWTH_STAGES,
  PROFESSIONAL_STYLES,
  buildAssessmentSteps,
  buildCapabilityCards,
} from '../src/domain/assessmentContent.ts';
import {
  ASSESSMENT_VERSION,
  PART_A_CONFIG_VERSION,
  SCORING_ENGINE_VERSION,
} from '../src/domain/scoring.ts';
import { getInsightForPillar } from '../src/domain/pillarInsightEngine.ts';
import type { PartAScoringConfig } from '../src/domain/scoringConfig.ts';
import type {
  AdminSubmissionFilters,
  AssessmentQuestion,
  AssessmentResult,
  AssessmentSectionId,
  AssessmentSectionMeta,
  CommunicationChannel,
  CommunicationDeliveryStatus,
  CommunicationTemplateType,
  ConsultationStatus,
  HumanReviewCategory,
  LeadSegmentationConfig,
  RespondentAnswers,
  SubmissionRecord,
} from '../src/domain/types.ts';
import {
  dispatchEmailMessage,
  dispatchWhatsAppMessage,
  evaluateWhatsAppRecipient,
  getEmailProviderConfig,
} from './communications.ts';
import { getIntegrationStatuses, syncRecordToCrm } from './integrations.ts';
import {
  authenticateStaffCredentials,
  clearSessionCookie,
  createSessionToken,
  getAuthConfigurationInfo,
  getRequestStaffSession,
  isStaffAuthConfigured,
  requireStaffRole,
  setSessionCookie,
} from './auth.ts';
import {
  LoginRateLimiter,
  extractSubmissionToken,
  sanitizeFeedbackPayload,
  sanitizeIdToken,
  sanitizeSingleLine,
  securityHeadersMiddleware,
} from './security.ts';
import {
  ALL_CONSULTATION_STATUSES,
  ALL_REVIEW_CATEGORIES,
  DomainConflictError,
  DomainForbiddenError,
  DomainValidationError,
  SqliteAssessmentRepository,
  submissionsToCsv,
  submissionsToXlsx,
} from './storage.ts';

dotenv.config();

export function toPublicRespondentRecord(record: SubmissionRecord) {
  const sanitizedResult: AssessmentResult = {
    ...record.result,
    professionalStyle: {
      ...record.result.professionalStyle,
      styleScores: [],
      missingOptionIds: [],
    },
  };

  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    submittedAt: record.submittedAt,
    completionStatus: record.completionStatus,
    assessmentVersion: record.assessmentVersion,
    scoringVersion: record.scoringVersion,
    durationMinutes: record.durationMinutes,
    answers: record.answers,
    contact: record.answers.contact,
    feedback: record.feedback,
    result: sanitizedResult,
    consultationSummary: {
      preference: record.consultation.preference,
      status: record.consultation.status,
      requestedAt: record.consultation.requestedAt,
    },
  };
}

function parseAdminFiltersFromQuery(
  query: express.Request['query']
): AdminSubmissionFilters {
  const str = (key: string, maxLen = 120) =>
    typeof query[key] === 'string'
      ? sanitizeSingleLine(query[key], maxLen)
      : undefined;

  return {
    q: str('q', 140),
    dateFrom: str('dateFrom', 20),
    dateTo: str('dateTo', 20),
    source: str('source', 120),
    audience: str('audience', 96),
    location: str('location', 100),
    urgency: str('urgency', 96),
    financialReadiness: str('financialReadiness', 96),
    januaryCohort: str('januaryCohort', 96),
    consultationStatus: str('consultationStatus', 64) ?? str('status', 64),
    reviewCategory: str('reviewCategory', 64),
    includeDrafts: query.includeDrafts === 'true',
  };
}

async function dispatchOptionalWebhook(
  repository: SqliteAssessmentRepository,
  record: SubmissionRecord
): Promise<void> {
  const webhookUrl = process.env.KWS_REPORT_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'kws.assessment.submitted',
        submissionId: record.id,
        submittedAt: record.submittedAt,
        assessmentVersion: record.assessmentVersion,
        scoringVersion: record.scoringVersion,
        contact: record.answers.contact,
        professionalStyleTitle: record.result.professionalStyle.leadTitle,
        growthStage: record.result.growthJourney.indicativeStage.name,
        consultationIntent: record.result.nextStep.consultationIntent,
      }),
    });

    await repository.recordDeliveryAttempt(
      record.id,
      'email',
      response.ok ? 'sent' : 'failed',
      record.answers.contact.email,
      'webhook',
      response.ok
        ? `Webhook accepted (${response.status}).`
        : `Webhook returned HTTP ${response.status}.`
    );
  } catch (err) {
    await repository.recordDeliveryAttempt(
      record.id,
      'email',
      'failed',
      record.answers.contact.email,
      'webhook',
      err instanceof Error ? err.message : 'Webhook request failed.'
    );
  }
}

async function triggerPostSubmissionEmails(
  repository: SqliteAssessmentRepository,
  record: SubmissionRecord
): Promise<void> {
  try {
    const confirmation = await dispatchEmailMessage(
      record,
      'submission_confirmation'
    );
    repository.recordCommunicationMessage({
      submissionId: record.id,
      channel: 'email',
      messageType: 'submission_confirmation',
      recipient: confirmation.recipient,
      subject: confirmation.subject,
      bodyPreview: confirmation.bodyPreview,
      provider: confirmation.provider,
      status: confirmation.status,
      externalMessageId: confirmation.externalMessageId,
      errorDetail: confirmation.errorDetail,
      sentBy: 'system',
    });

    const emailConfig = getEmailProviderConfig();
    if (emailConfig.resultsEmailEnabled) {
      const resultsDelivery = await dispatchEmailMessage(
        record,
        'results_delivery'
      );
      repository.recordCommunicationMessage({
        submissionId: record.id,
        channel: 'email',
        messageType: 'results_delivery',
        recipient: resultsDelivery.recipient,
        subject: resultsDelivery.subject,
        bodyPreview: resultsDelivery.bodyPreview,
        provider: resultsDelivery.provider,
        status: resultsDelivery.status,
        externalMessageId: resultsDelivery.externalMessageId,
        errorDetail: resultsDelivery.errorDetail,
        sentBy: 'system',
      });
    }
  } catch (err) {
    console.error('Non-blocking post-submission email workflow error:', err);
  }
}

export async function createApp(options?: {
  repository?: SqliteAssessmentRepository;
  enableFrontend?: boolean;
}) {
  const app = express();
  const repository = options?.repository ?? new SqliteAssessmentRepository();
  const loginLimiter = new LoginRateLimiter(10, 15 * 60 * 1000);
  const enableFrontend = options?.enableFrontend ?? true;

  app.set('trust proxy', 1);
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '1mb' }));

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({
          error: 'INVALID_JSON',
          message: 'Request body must be valid JSON.',
        });
        return;
      }
      next(err);
    }
  );

  // 1. Health & Persistence Boundary Status
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      assessmentVersion: ASSESSMENT_VERSION,
      scoringVersion: SCORING_ENGINE_VERSION,
      partAConfigVersion: PART_A_CONFIG_VERSION,
      storage: repository.getBoundaryStatus(),
      staffAuthConfigured: isStaffAuthConfigured(),
    });
  });

  // 2. Public Assessment Configuration (No secret answer keys or Part A matrix)
  app.get('/api/assessment/config', (_req, res) => {
    const activeVersion = repository.getActiveAssessmentVersion();
    const allQuestions = activeVersion.questions ?? ASSESSMENT_QUESTIONS;
    const activeQuestions = allQuestions.filter((q) => q.active !== false);
    const capabilityCards = buildCapabilityCards(activeQuestions);
    const steps = buildAssessmentSteps(activeQuestions);
    const partAConfig = repository.getPartAScoringConfig();

    res.json({
      assessmentVersion: activeVersion.versionId,
      scoringVersion: SCORING_ENGINE_VERSION,
      partAConfigVersion: partAConfig.approved
        ? 'approved-v1'
        : activeVersion.partAConfigVersion || PART_A_CONFIG_VERSION,
      partAConfigApproved: partAConfig.approved,
      sections: activeVersion.sections ?? ASSESSMENT_SECTIONS,
      questions: activeQuestions,
      capabilityCards,
      stepsCount: steps.length,
      professionalStyles: PROFESSIONAL_STYLES,
      growthStages: GROWTH_STAGES,
    });
  });

  const VALID_PILLAR_IDS = new Set<AssessmentSectionId>([
    'professional_style',
    'growth_journey',
    'strengths_growth',
    'profile_next_steps',
  ]);

  // 2b. Personalized Pillar Discovery Insight Evaluation (No secret keys exposed)
  app.post('/api/assessment/pillar-insight', (req, res) => {
    const body = req.body as {
      pillarId?: unknown;
      answers?: Partial<RespondentAnswers>;
    };
    const pillarId =
      typeof body?.pillarId === 'string' ? body.pillarId.trim() : '';

    if (!VALID_PILLAR_IDS.has(pillarId as AssessmentSectionId)) {
      res.status(400).json({
        error: 'INVALID_PILLAR_ID',
        message:
          'pillarId must be one of professional_style, growth_journey, strengths_growth, or profile_next_steps.',
      });
      return;
    }

    const rawAnswers = body?.answers ?? {};
    const safeSelections: Record<string, string> = {};
    if (rawAnswers.selections && typeof rawAnswers.selections === 'object') {
      for (const [k, v] of Object.entries(rawAnswers.selections)) {
        if (typeof v === 'string' && k.length <= 64 && v.length <= 96) {
          safeSelections[k] = v;
        }
      }
    }

    const safeOtherText: Record<string, string> = {};
    if (rawAnswers.otherText && typeof rawAnswers.otherText === 'object') {
      for (const [k, v] of Object.entries(rawAnswers.otherText)) {
        if (typeof v === 'string' && k.length <= 64) {
          safeOtherText[k] = sanitizeSingleLine(v, 300);
        }
      }
    }

    const rawContact = (rawAnswers.contact ?? {}) as Partial<
      RespondentAnswers['contact']
    >;
    const safeAnswers: RespondentAnswers = {
      selections: safeSelections,
      otherText: safeOtherText,
      contact: {
        fullName:
          typeof rawContact.fullName === 'string'
            ? sanitizeSingleLine(rawContact.fullName, 140)
            : '',
        whatsappNumber:
          typeof rawContact.whatsappNumber === 'string'
            ? sanitizeSingleLine(rawContact.whatsappNumber, 40)
            : '',
        email:
          typeof rawContact.email === 'string'
            ? sanitizeSingleLine(rawContact.email, 160)
            : '',
        city:
          typeof rawContact.city === 'string'
            ? sanitizeSingleLine(rawContact.city, 100)
            : '',
        state:
          typeof rawContact.state === 'string'
            ? sanitizeSingleLine(rawContact.state, 100)
            : '',
        institution:
          typeof rawContact.institution === 'string'
            ? sanitizeSingleLine(rawContact.institution, 160)
            : '',
        whatsappConsent: Boolean(rawContact.whatsappConsent),
      },
    };

    const activeVersion = repository.getActiveAssessmentVersion();
    const activeQuestions = (
      activeVersion.questions ?? ASSESSMENT_QUESTIONS
    ).filter((q) => q.active !== false);
    const partAConfig = repository.getPartAScoringConfig();

    const evaluated = getInsightForPillar(
      pillarId as AssessmentSectionId,
      safeAnswers,
      {
        partAConfig,
        questions: activeQuestions,
      }
    );

    res.json({
      insight: evaluated.insight,
      partAConfigApproved: partAConfig.approved,
    });
  });

  // 3. Create Draft OR Atomic Create + Submit
  app.post('/api/submissions', async (req, res) => {
    try {
      const body = req.body as {
        mode?: 'draft' | 'submit';
        idempotencyKey?: string;
        submitNonce?: string;
        durationMinutes?: number;
        answers?: unknown;
        attribution?: unknown;
      };

      const idempotencyKey = sanitizeIdToken(body?.idempotencyKey ?? '', 128);
      const submitNonce = sanitizeIdToken(body?.submitNonce ?? '', 128);

      if (body?.mode === 'draft') {
        const draftResult = await repository.createDraftSubmission({
          idempotencyKey,
          durationMinutes: body.durationMinutes,
          answers: body.answers,
          attribution: body.attribution,
        });

        res.status(draftResult.deduplicated ? 200 : 201).json({
          record: toPublicRespondentRecord(draftResult.record),
          accessToken: draftResult.accessToken,
          deduplicated: draftResult.deduplicated,
        });
        return;
      }

      if (!body?.answers) {
        res.status(400).json({
          error: 'INVALID_PAYLOAD',
          message: 'Assessment answers and contact details are required.',
        });
        return;
      }

      const atomic = await repository.createAndSubmitAtomic({
        idempotencyKey,
        submitNonce,
        durationMinutes: body.durationMinutes ?? 1,
        answers: body.answers,
        attribution: body.attribution,
      });

      if (!atomic.deduplicated) {
        await repository.recordTelemetryBatch(atomic.record.id, [
          {
            eventType: 'assessment_submitted',
            clientTimestamp: new Date().toISOString(),
          },
        ]);
        void dispatchOptionalWebhook(repository, atomic.record);
        void triggerPostSubmissionEmails(repository, atomic.record);
      }

      res.status(atomic.deduplicated ? 200 : 201).json({
        record: toPublicRespondentRecord(atomic.record),
        accessToken: atomic.accessToken,
        deduplicated: atomic.deduplicated,
      });
    } catch (err) {
      if (err instanceof DomainValidationError) {
        res.status(400).json({
          error: err.code,
          message: err.message,
          missingQuestionIds: err.missingQuestionIds ?? [],
        });
        return;
      }
      if (err instanceof DomainConflictError) {
        res.status(409).json({ error: err.code, message: err.message });
        return;
      }
      console.error('Failed to process submission:', err);
      res.status(500).json({
        error: 'SUBMISSION_STORAGE_ERROR',
        message: 'Could not save your assessment submission. Please retry.',
      });
    }
  });

  // 4. Progressive Answer Saving (Draft only)
  const handleSaveAnswers = async (
    req: express.Request,
    res: express.Response
  ) => {
    try {
      const id = sanitizeIdToken(req.params.id, 96);
      const token = extractSubmissionToken(req);
      if (!token) {
        res.status(401).json({
          error: 'ACCESS_TOKEN_REQUIRED',
          message: 'Private submission token is required to save draft answers.',
        });
        return;
      }

      const body = req.body as {
        answers?: unknown;
        attribution?: unknown;
        durationMinutes?: number;
      };

      const updated = await repository.saveDraftAnswers(id, token, {
        answers: body?.answers,
        attribution: body?.attribution,
        durationMinutes: body?.durationMinutes,
      });

      if (!updated) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Assessment draft was not found.',
        });
        return;
      }

      res.json({ record: toPublicRespondentRecord(updated) });
    } catch (err) {
      if (err instanceof DomainForbiddenError) {
        res.status(403).json({ error: err.code, message: err.message });
        return;
      }
      if (err instanceof DomainConflictError) {
        res.status(409).json({ error: err.code, message: err.message });
        return;
      }
      console.error('Failed to save draft answers:', err);
      res.status(500).json({
        error: 'SAVE_DRAFT_ERROR',
        message: 'Unable to save assessment progress right now.',
      });
    }
  };

  app.put('/api/submissions/:id/answers', handleSaveAnswers);
  app.patch('/api/submissions/:id/answers', handleSaveAnswers);

  // 5. Final Submission Execution & Scoring
  app.post('/api/submissions/:id/submit', async (req, res) => {
    try {
      const id = sanitizeIdToken(req.params.id, 96);
      const token = extractSubmissionToken(req);
      if (!token) {
        res.status(401).json({
          error: 'ACCESS_TOKEN_REQUIRED',
          message: 'Private submission token is required to finalize submission.',
        });
        return;
      }

      const body = req.body as {
        submitNonce?: string;
        answers?: unknown;
        attribution?: unknown;
        durationMinutes?: number;
      };

      const finalized = await repository.finalizeSubmission(id, token, {
        submitNonce: sanitizeIdToken(body?.submitNonce ?? '', 128),
        answers: body?.answers,
        attribution: body?.attribution,
        durationMinutes: body?.durationMinutes,
      });

      if (!finalized) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Assessment submission was not found.',
        });
        return;
      }

      if (!finalized.deduplicated) {
        await repository.recordTelemetryBatch(finalized.record.id, [
          {
            eventType: 'assessment_submitted',
            clientTimestamp: new Date().toISOString(),
          },
        ]);
        void dispatchOptionalWebhook(repository, finalized.record);
        void triggerPostSubmissionEmails(repository, finalized.record);
      }

      res.json({
        record: toPublicRespondentRecord(finalized.record),
        deduplicated: finalized.deduplicated,
      });
    } catch (err) {
      if (err instanceof DomainForbiddenError) {
        res.status(403).json({ error: err.code, message: err.message });
        return;
      }
      if (err instanceof DomainConflictError) {
        res.status(409).json({ error: err.code, message: err.message });
        return;
      }
      if (err instanceof DomainValidationError) {
        res.status(400).json({
          error: err.code,
          message: err.message,
          missingQuestionIds: err.missingQuestionIds ?? [],
        });
        return;
      }
      console.error('Failed to finalize assessment submission:', err);
      res.status(500).json({
        error: 'FINALIZE_SUBMISSION_ERROR',
        message: 'Could not finalize your assessment submission. Please retry.',
      });
    }
  });

  async function authorizeSubmissionAccess(
    req: express.Request,
    res: express.Response
  ): Promise<string | null> {
    const id = sanitizeIdToken(req.params.id, 96);
    const staffSession = getRequestStaffSession(req);
    if (staffSession.authenticated) {
      return id;
    }

    const token = extractSubmissionToken(req);
    const access = await repository.verifySubmissionAccess(id, token);
    if (!access.exists) {
      if (!token) {
        res.status(401).json({
          error: 'ACCESS_TOKEN_REQUIRED',
          message:
            'A private access token is required to view these assessment results.',
        });
        return null;
      }
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Assessment submission was not found.',
      });
      return null;
    }

    if (!token) {
      res.status(401).json({
        error: 'ACCESS_TOKEN_REQUIRED',
        message:
          'A private access token is required to view these assessment results.',
      });
      return null;
    }

    if (!access.authorized) {
      res.status(403).json({
        error: 'INVALID_ACCESS_TOKEN',
        message: 'You are not authorized to access this assessment record.',
      });
      return null;
    }

    return id;
  }

  // 6. Private Result Retrieval (Requires private accessToken OR staff session)
  app.get('/api/submissions/:id', async (req, res) => {
    const id = await authorizeSubmissionAccess(req, res);
    if (!id) return;

    const isStaff = getRequestStaffSession(req).authenticated;
    const record = await repository.getSubmissionById(id, {
      recordViewActor: !isStaff,
    });
    if (!record) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Assessment submission was not found.',
      });
      return;
    }

    if (!isStaff) {
      await repository.recordTelemetryBatch(id, [
        {
          eventType: 'results_viewed',
          clientTimestamp: new Date().toISOString(),
        },
      ]);
    }

    res.json({ record: toPublicRespondentRecord(record) });
  });

  // 6b. Respondent Question-Level Telemetry & Journey Instrumentation
  app.post('/api/submissions/:id/events', async (req, res) => {
    const id = await authorizeSubmissionAccess(req, res);
    if (!id) return;

    const eventsPayload = Array.isArray(req.body)
      ? req.body
      : (req.body as { events?: unknown })?.events;

    const result = await repository.recordTelemetryBatch(id, eventsPayload);
    res.json({ ok: true, inserted: result.inserted });
  });

  // 7. Respondent Feedback
  app.patch('/api/submissions/:id/feedback', async (req, res) => {
    const id = await authorizeSubmissionAccess(req, res);
    if (!id) return;

    const sanitized = sanitizeFeedbackPayload(req.body);
    if (!sanitized) {
      res.status(400).json({
        error: 'INVALID_FEEDBACK',
        message: 'Invalid feedback selection.',
      });
      return;
    }

    const updated = await repository.updateFeedback(id, sanitized);
    if (!updated) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Assessment submission was not found.',
      });
      return;
    }

    res.json({ record: toPublicRespondentRecord(updated) });
  });

  // 8. Respondent Consultation Request
  app.post('/api/submissions/:id/consultation', async (req, res) => {
    const id = await authorizeSubmissionAccess(req, res);
    if (!id) return;

    const pref = (req.body as { preference?: unknown })?.preference;
    if (pref !== 'book' && pref !== 'more_info') {
      res.status(400).json({
        error: 'INVALID_PREFERENCE',
        message: 'Consultation preference must be "book" or "more_info".',
      });
      return;
    }

    const updated = await repository.requestConsultation(id, pref);
    if (!updated) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Assessment submission was not found.',
      });
      return;
    }

    res.json({ record: toPublicRespondentRecord(updated) });
  });

  // 9. Staff Admin Auth & RBAC Status
  app.get('/api/admin/status', (req, res) => {
    const session = getRequestStaffSession(req);
    const configInfo = getAuthConfigurationInfo();
    res.json({
      authConfigured: configInfo.authConfigured,
      accountSignInEnabled: configInfo.accountSignInEnabled,
      allowlistEnabled: configInfo.allowlistEnabled,
      authenticated: session.authenticated,
      role: session.role ?? null,
      actorLabel: session.actorLabel ?? null,
      storage: repository.getBoundaryStatus(),
    });
  });

  app.post('/api/admin/login', (req, res) => {
    if (!isStaffAuthConfigured()) {
      res.status(503).json({
        error: 'STAFF_AUTH_NOT_CONFIGURED',
        message:
          'Staff portal access requires KWS_ADMIN_PASSCODE or KWS_STAFF_ACCOUNTS in the server environment.',
      });
      return;
    }

    const clientIp = req.ip || 'unknown';
    if (loginLimiter.isLimited(clientIp)) {
      res.status(429).json({
        error: 'TOO_MANY_ATTEMPTS',
        message:
          'Too many failed sign-in attempts. Please wait 15 minutes before trying again.',
      });
      return;
    }

    const passcode =
      typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    const email =
      typeof req.body?.email === 'string' ? req.body.email : '';
    const authResult = authenticateStaffCredentials(passcode, email);

    if (!authResult.valid || !authResult.role) {
      loginLimiter.recordFailure(clientIp);
      res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'The staff credentials entered are incorrect or not allowlisted.',
      });
      return;
    }

    loginLimiter.reset(clientIp);
    const token = createSessionToken(
      authResult.role,
      authResult.actorLabel,
      authResult.email
    );
    setSessionCookie(res, token, req);
    res.json({
      authenticated: true,
      role: authResult.role,
      actorLabel: authResult.actorLabel,
    });
  });

  app.post('/api/admin/logout', (req, res) => {
    clearSessionCookie(res, req);
    res.json({ authenticated: false });
  });

  // 10. Protected Staff Endpoints (Admin, Advisor, Viewer for read)
  app.get(
    '/api/admin/submissions',
    requireStaffRole('admin', 'advisor', 'viewer'),
    async (req, res) => {
      const filters = parseAdminFiltersFromQuery(req.query);
      const { records, totalCount } =
        await repository.listFilteredSubmissions(filters);
      res.json({ records, totalCount });
    }
  );

  app.get(
    '/api/admin/submissions/:id',
    requireStaffRole('admin', 'advisor', 'viewer'),
    async (req, res) => {
      const id = sanitizeIdToken(req.params.id, 96);
      const record = await repository.getSubmissionById(id, {
        includeEvents: true,
      });
      if (!record) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Respondent record not found.',
        });
        return;
      }
      res.json({ record });
    }
  );

  const handleUpdateConsultation = async (
    req: express.Request,
    res: express.Response
  ) => {
    const body = req.body as {
      consultationStatus?: ConsultationStatus;
      status?: ConsultationStatus;
      reviewCategory?: HumanReviewCategory;
      staffNotes?: string;
      outcomeNotes?: string;
      assignedStaffMember?: string;
      incrementAttempt?: boolean;
      scheduledAt?: string | null;
    };

    const nextStatus = body.consultationStatus ?? body.status;
    if (nextStatus && !ALL_CONSULTATION_STATUSES.includes(nextStatus)) {
      res.status(400).json({
        error: 'INVALID_STATUS',
        message: 'Invalid consultation follow-up status.',
      });
      return;
    }

    if (
      body.reviewCategory &&
      !ALL_REVIEW_CATEGORIES.includes(body.reviewCategory)
    ) {
      res.status(400).json({
        error: 'INVALID_REVIEW_CATEGORY',
        message: 'Invalid human review category.',
      });
      return;
    }

    const session = getRequestStaffSession(req);
    const id = sanitizeIdToken(req.params.id, 96);
    const updated = await repository.updateConsultation(
      id,
      {
        consultationStatus: nextStatus,
        reviewCategory: body.reviewCategory,
        staffNotes: body.outcomeNotes ?? body.staffNotes,
        assignedStaffMember: body.assignedStaffMember,
        incrementAttempt: Boolean(body.incrementAttempt),
        scheduledAt: body.scheduledAt,
      },
      session.actorLabel || session.role || 'KWS Staff'
    );

    if (!updated) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Respondent record not found.',
      });
      return;
    }

    res.json({ record: updated });
  };

  app.patch(
    '/api/admin/submissions/:id',
    requireStaffRole('admin', 'advisor'),
    handleUpdateConsultation
  );
  app.patch(
    '/api/admin/consultations/:id',
    requireStaffRole('admin', 'advisor'),
    handleUpdateConsultation
  );

  app.get(
    '/api/admin/analytics',
    requireStaffRole('admin', 'advisor', 'viewer'),
    async (req, res) => {
      const filters = parseAdminFiltersFromQuery(req.query);
      const summary = await repository.computeAnalytics(filters);
      res.json({ summary });
    }
  );

  // 10b. Campaign Costs & Attribution Spend
  app.get(
    '/api/admin/campaign-costs',
    requireStaffRole('admin', 'advisor', 'viewer'),
    (_req, res) => {
      res.json({ costs: repository.listCampaignCosts() });
    }
  );

  app.put(
    '/api/admin/campaign-costs',
    requireStaffRole('admin', 'advisor'),
    (req, res) => {
      const body = req.body as {
        utmSource?: string;
        utmCampaign?: string;
        currency?: string;
        amountSpent?: number;
        periodLabel?: string;
        notes?: string;
      };
      const amount = Number(body?.amountSpent);
      if (!Number.isFinite(amount) || amount < 0) {
        res.status(400).json({
          error: 'INVALID_AMOUNT',
          message: 'Campaign spend must be a non-negative number.',
        });
        return;
      }
      const cost = repository.upsertCampaignCost({
        utmSource: body.utmSource ?? 'unknown/direct',
        utmCampaign: body.utmCampaign ?? 'unknown/direct',
        currency: body.currency ?? 'NGN',
        amountSpent: amount,
        periodLabel: body.periodLabel,
        notes: body.notes,
      });
      res.json({ cost });
    }
  );

  // 10c. Immutable Assessment Question Management & Versioning
  app.get(
    '/api/admin/versions',
    requireStaffRole('admin', 'advisor', 'viewer'),
    (_req, res) => {
      const versions = repository.listAssessmentVersions();
      const activeVersion = repository.getActiveAssessmentVersion();
      res.json({ versions, activeVersionId: activeVersion.versionId });
    }
  );

  app.post(
    '/api/admin/versions',
    requireStaffRole('admin'),
    (req, res) => {
      try {
        const session = getRequestStaffSession(req);
        const body = req.body as {
          versionId?: string;
          label?: string;
          changeSummary?: string;
          questions?: AssessmentQuestion[];
          sections?: AssessmentSectionMeta[];
          activateImmediately?: boolean;
        };

        const version = repository.createAssessmentVersion({
          versionId: body?.versionId ?? '',
          label: body?.label ?? '',
          changeSummary: body?.changeSummary ?? '',
          questions: Array.isArray(body?.questions) ? body.questions : [],
          sections: Array.isArray(body?.sections) ? body.sections : undefined,
          createdBy: session.actorLabel || session.role || 'Admin',
          activateImmediately: Boolean(body?.activateImmediately),
        });
        res.status(201).json({ version });
      } catch (err) {
        if (err instanceof DomainValidationError) {
          res.status(400).json({ error: err.code, message: err.message });
          return;
        }
        if (err instanceof DomainConflictError) {
          res.status(409).json({ error: err.code, message: err.message });
          return;
        }
        console.error('Failed to create assessment version:', err);
        res.status(500).json({
          error: 'VERSION_CREATE_ERROR',
          message: 'Could not create assessment version.',
        });
      }
    }
  );

  app.post(
    '/api/admin/versions/:versionId/activate',
    requireStaffRole('admin'),
    (req, res) => {
      const version = repository.activateAssessmentVersion(req.params.versionId);
      if (!version) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Assessment version not found.',
        });
        return;
      }
      res.json({ version });
    }
  );

  // 10c2. Admin Part A Scoring Matrix & Lead Segmentation Rules (Staff Only)
  app.get(
    '/api/admin/configs/scoring',
    requireStaffRole('admin', 'advisor', 'viewer'),
    (_req, res) => {
      const config = repository.getPartAScoringConfig();
      const activeVersion = repository.getActiveAssessmentVersion();
      res.json({
        config,
        activeVersionId: activeVersion.versionId,
      });
    }
  );

  app.put(
    '/api/admin/configs/scoring',
    requireStaffRole('admin'),
    (req, res) => {
      try {
        const session = getRequestStaffSession(req);
        const body = req.body as PartAScoringConfig;
        const saved = repository.savePartAScoringConfig(
          body,
          session.actorLabel || session.role || 'Admin'
        );
        res.json({ config: saved });
      } catch (err) {
        if (err instanceof DomainValidationError) {
          res.status(400).json({
            error: err.code,
            message: err.message,
            missingOptionIds: err.missingQuestionIds ?? [],
          });
          return;
        }
        console.error('Failed to save Part A scoring config:', err);
        res.status(500).json({
          error: 'CONFIG_SAVE_ERROR',
          message: 'Could not save Part A scoring configuration.',
        });
      }
    }
  );

  app.get(
    '/api/admin/configs/segmentation',
    requireStaffRole('admin', 'advisor', 'viewer'),
    (_req, res) => {
      res.json({ config: repository.getLeadSegmentationConfig() });
    }
  );

  app.put(
    '/api/admin/configs/segmentation',
    requireStaffRole('admin'),
    (req, res) => {
      try {
        const session = getRequestStaffSession(req);
        const body = req.body as LeadSegmentationConfig;
        const saved = repository.saveLeadSegmentationConfig(
          body,
          session.actorLabel || session.role || 'Admin'
        );
        res.json({ config: saved });
      } catch (err) {
        if (err instanceof DomainValidationError) {
          res.status(400).json({ error: err.code, message: err.message });
          return;
        }
        console.error('Failed to save lead segmentation config:', err);
        res.status(500).json({
          error: 'CONFIG_SAVE_ERROR',
          message: 'Could not save lead segmentation configuration.',
        });
      }
    }
  );

  app.post(
    '/api/admin/segmentation/apply',
    requireStaffRole('admin'),
    (req, res) => {
      try {
        const session = getRequestStaffSession(req);
        const outcome = repository.applyLeadSegmentationToUnreviewed(
          session.actorLabel || session.role || 'Admin'
        );
        res.json(outcome);
      } catch (err) {
        if (err instanceof DomainValidationError) {
          res.status(400).json({ error: err.code, message: err.message });
          return;
        }
        console.error('Failed to apply lead segmentation:', err);
        res.status(500).json({
          error: 'SEGMENTATION_APPLY_ERROR',
          message: 'Could not apply lead segmentation rules.',
        });
      }
    }
  );

  // 10d. Email & WhatsApp Communication Workflows
  const VALID_COMM_TEMPLATES: CommunicationTemplateType[] = [
    'submission_confirmation',
    'results_delivery',
    'programme_info',
    'consultation_followup',
    'cohort_reminder',
    'marketing_update',
  ];

  const VALID_DELIVERY_STATUSES: CommunicationDeliveryStatus[] = [
    'sent',
    'delivered',
    'read',
    'replied',
    'failed',
  ];

  app.get(
    '/api/admin/communications',
    requireStaffRole('admin', 'advisor', 'viewer'),
    (req, res) => {
      const submissionId =
        typeof req.query.submissionId === 'string'
          ? sanitizeIdToken(req.query.submissionId, 96)
          : undefined;
      const channelParam =
        req.query.channel === 'email' || req.query.channel === 'whatsapp'
          ? (req.query.channel as CommunicationChannel)
          : undefined;
      const limit = Number(req.query.limit ?? 100) || 100;
      const messages = repository.listCommunicationMessages({
        submissionId: submissionId || undefined,
        channel: channelParam,
        limit,
      });
      res.json({ messages });
    }
  );

  app.post(
    '/api/admin/communications/email/send',
    requireStaffRole('admin', 'advisor'),
    async (req, res) => {
      const session = getRequestStaffSession(req);
      const body = req.body as {
        submissionIds?: string[];
        messageType?: CommunicationTemplateType;
        subject?: string;
        bodyText?: string;
      };
      const ids = Array.isArray(body?.submissionIds)
        ? body.submissionIds.slice(0, 100)
        : [];
      const messageType = body?.messageType;

      if (
        ids.length === 0 ||
        !messageType ||
        !VALID_COMM_TEMPLATES.includes(messageType)
      ) {
        res.status(400).json({
          error: 'INVALID_EMAIL_REQUEST',
          message:
            'Provide one or more submissionIds and a valid email messageType.',
        });
        return;
      }

      const actor = session.actorLabel || session.role || 'KWS Staff';
      const records = await Promise.all(
        ids.map((id) => repository.getSubmissionById(sanitizeIdToken(id, 96)))
      );

      const savedMessages = [];
      for (const rec of records) {
        if (!rec) continue;
        const dispatch = await dispatchEmailMessage(rec, messageType, {
          subject: body.subject,
          bodyText: body.bodyText,
        });
        const msg = repository.recordCommunicationMessage({
          submissionId: rec.id,
          channel: 'email',
          messageType,
          recipient: dispatch.recipient,
          subject: dispatch.subject,
          bodyPreview: dispatch.bodyPreview,
          provider: dispatch.provider,
          status: dispatch.status,
          externalMessageId: dispatch.externalMessageId,
          errorDetail: dispatch.errorDetail,
          sentBy: actor,
        });
        savedMessages.push(msg);
      }

      res.json({ messages: savedMessages });
    }
  );

  app.post(
    '/api/admin/communications/whatsapp/preview',
    requireStaffRole('admin', 'advisor'),
    async (req, res) => {
      const body = req.body as {
        submissionIds?: string[];
        templateType?: CommunicationTemplateType;
        customMessage?: string;
      };
      const ids = Array.isArray(body?.submissionIds)
        ? body.submissionIds.slice(0, 100)
        : [];
      const templateType = body?.templateType ?? 'consultation_followup';

      if (ids.length === 0 || !VALID_COMM_TEMPLATES.includes(templateType)) {
        res.status(400).json({
          error: 'INVALID_WHATSAPP_PREVIEW',
          message:
            'Select at least one respondent and a valid WhatsApp templateType.',
        });
        return;
      }

      const records = await Promise.all(
        ids.map((id) => repository.getSubmissionById(sanitizeIdToken(id, 96)))
      );
      const previews = records
        .filter((r): r is SubmissionRecord => Boolean(r))
        .map((rec) =>
          evaluateWhatsAppRecipient(rec, templateType, body.customMessage ?? '')
        );

      const eligibleCount = previews.filter((p) => p.eligible).length;
      res.json({
        previews,
        summary: {
          total: previews.length,
          eligible: eligibleCount,
          blocked: previews.length - eligibleCount,
        },
      });
    }
  );

  app.post(
    '/api/admin/communications/whatsapp/send',
    requireStaffRole('admin', 'advisor'),
    async (req, res) => {
      const session = getRequestStaffSession(req);
      const body = req.body as {
        submissionIds?: string[];
        templateType?: CommunicationTemplateType;
        customMessage?: string;
        confirmedReview?: boolean;
      };

      if (body?.confirmedReview !== true) {
        res.status(400).json({
          error: 'REVIEW_CONFIRMATION_REQUIRED',
          message:
            'Staff must preview and confirm recipients and resolved WhatsApp messages before sending.',
        });
        return;
      }

      const ids = Array.isArray(body?.submissionIds)
        ? body.submissionIds.slice(0, 100)
        : [];
      const templateType = body?.templateType ?? 'consultation_followup';

      if (ids.length === 0 || !VALID_COMM_TEMPLATES.includes(templateType)) {
        res.status(400).json({
          error: 'INVALID_WHATSAPP_SEND',
          message:
            'Select at least one respondent and a valid WhatsApp templateType.',
        });
        return;
      }

      const actor = session.actorLabel || session.role || 'KWS Staff';
      const records = await Promise.all(
        ids.map((id) => repository.getSubmissionById(sanitizeIdToken(id, 96)))
      );

      const messages = [];
      let sentCount = 0;
      let blockedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const rec of records) {
        if (!rec) continue;
        const dispatch = await dispatchWhatsAppMessage(
          rec,
          templateType,
          body.customMessage ?? ''
        );

        if (dispatch.status === 'sent') sentCount += 1;
        else if (
          dispatch.status === 'blocked_preference' ||
          dispatch.status === 'skipped_no_consent'
        ) {
          blockedCount += 1;
        } else if (dispatch.status === 'skipped_no_provider') {
          skippedCount += 1;
        } else {
          failedCount += 1;
        }

        const msg = repository.recordCommunicationMessage({
          submissionId: rec.id,
          channel: 'whatsapp',
          messageType: templateType,
          recipient: dispatch.preview.whatsappNumber || rec.answers.contact.fullName,
          subject: `WhatsApp: ${templateType}`,
          bodyPreview: dispatch.preview.resolvedMessage,
          provider: dispatch.provider,
          status: dispatch.status,
          externalMessageId: dispatch.externalMessageId,
          errorDetail: dispatch.errorDetail,
          sentBy: actor,
        });
        messages.push(msg);
      }

      res.json({
        sentCount,
        blockedCount,
        skippedCount,
        failedCount,
        messages,
      });
    }
  );

  app.patch(
    '/api/admin/communications/:messageId/status',
    requireStaffRole('admin', 'advisor'),
    (req, res) => {
      const status = (req.body as { status?: CommunicationDeliveryStatus })?.status;
      const errorDetail = (req.body as { errorDetail?: string })?.errorDetail;
      if (!status || !VALID_DELIVERY_STATUSES.includes(status)) {
        res.status(400).json({
          error: 'INVALID_DELIVERY_STATUS',
          message:
            'Status must be one of: sent, delivered, read, replied, failed.',
        });
        return;
      }

      const updated = repository.updateCommunicationMessageStatus(
        sanitizeIdToken(req.params.messageId, 96),
        status,
        errorDetail
      );
      if (!updated) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Communication log record not found.',
        });
        return;
      }
      res.json({ message: updated });
    }
  );

  // 10e. CRM & Communication Integration Readiness
  app.get(
    '/api/admin/integrations',
    requireStaffRole('admin', 'advisor', 'viewer'),
    (_req, res) => {
      res.json({
        integrations: getIntegrationStatuses(),
        syncEvents: repository.listCrmSyncEvents(50),
      });
    }
  );

  app.post(
    '/api/admin/integrations/:provider/sync',
    requireStaffRole('admin'),
    async (req, res) => {
      const provider = req.params.provider;
      if (provider !== 'mailchimp' && provider !== 'crm_webhook') {
        res.status(400).json({
          error: 'INVALID_INTEGRATION_PROVIDER',
          message: 'Provider must be "mailchimp" or "crm_webhook".',
        });
        return;
      }

      const submissionId = sanitizeIdToken(
        (req.body as { submissionId?: string })?.submissionId ?? '',
        96
      );
      if (!submissionId) {
        res.status(400).json({
          error: 'MISSING_SUBMISSION_ID',
          message: 'A valid submissionId is required to attempt CRM sync.',
        });
        return;
      }

      const record = await repository.getSubmissionById(submissionId);
      if (!record) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Respondent record not found.',
        });
        return;
      }

      const session = getRequestStaffSession(req);
      const outcome = await syncRecordToCrm(record, provider);
      const syncEvent = repository.recordCrmSyncEvent({
        submissionId: record.id,
        provider,
        status: outcome.status,
        detail: outcome.detail,
        triggeredBy: session.actorLabel || session.role || 'Admin',
      });

      res.json({ syncEvent });
    }
  );

  // 11. Filtered CSV, Excel (.xlsx), JSON Exports & Hot SQLite Backup (Admin role only)
  app.get(
    '/api/admin/export',
    requireStaffRole('admin'),
    async (req, res) => {
      const formatParam = String(req.query.format ?? 'csv').toLowerCase();
      const filters = parseAdminFiltersFromQuery(req.query);
      const { records } = await repository.listFilteredSubmissions({
        ...filters,
        includeDrafts: false,
      });
      const stamp = new Date().toISOString().slice(0, 10);

      if (formatParam === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="kws-academy-submissions-${stamp}.json"`
        );
        res.send(JSON.stringify(records, null, 2));
        return;
      }

      if (formatParam === 'xlsx' || formatParam === 'excel') {
        const buffer = submissionsToXlsx(records);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="kws-academy-submissions-${stamp}.xlsx"`
        );
        res.send(buffer);
        return;
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="kws-academy-submissions-${stamp}.csv"`
      );
      res.send(submissionsToCsv(records));
    }
  );

  app.post(
    '/api/admin/backup',
    requireStaffRole('admin'),
    (_req, res) => {
      try {
        const snapshot = repository.createBackupSnapshot();
        res.json({
          ok: true,
          filename: path.basename(snapshot.path),
          sizeBytes: snapshot.sizeBytes,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Database backup error:', err);
        res.status(500).json({
          error: 'BACKUP_ERROR',
          message: 'Could not create database backup snapshot.',
        });
      }
    }
  );

  app.get(
    '/api/admin/backup/download',
    requireStaffRole('admin'),
    (_req, res) => {
      try {
        const snapshot = repository.createBackupSnapshot();
        res.download(snapshot.path, path.basename(snapshot.path));
      } catch (err) {
        console.error('Database backup download error:', err);
        res.status(500).json({
          error: 'BACKUP_ERROR',
          message: 'Could not generate database backup download.',
        });
      }
    }
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'API endpoint not found.',
    });
  });

  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({
          error: 'INVALID_JSON',
          message: 'Malformed JSON request body.',
        });
        return;
      }
      if (res.headersSent) {
        next(err);
        return;
      }
      if (req.path.startsWith('/api')) {
        console.error('Unhandled API error:', err);
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'An unexpected server error occurred.',
        });
        return;
      }
      next(err);
    }
  );

  // Frontend Hosting
  if (enableFrontend) {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        const indexHtml = path.join(distDir, 'index.html');
        if (fs.existsSync(indexHtml)) {
          res.sendFile(indexHtml);
        } else {
          res.status(404).send('Build output not found. Run npm run build.');
        }
      });
    }
  }

  return { app, repository };
}
