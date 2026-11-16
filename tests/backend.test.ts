import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createApp } from '../server/app.ts';
import { SqliteAssessmentRepository } from '../server/storage.ts';
import type { RespondentAnswers } from '../src/domain/types.ts';

function buildCompleteAnswers(overrides?: Partial<RespondentAnswers>): RespondentAnswers {
  return {
    selections: {
      style_q01: 'style_q01_opt_1',
      style_q02: 'style_q02_opt_2',
      style_q03: 'style_q03_opt_3',
      style_q04: 'style_q04_opt_4',
      style_q05: 'style_q05_opt_5',
      style_q06: 'style_q06_opt_6',
      style_q07: 'style_q07_opt_1',
      style_q08: 'style_q08_opt_2',
      style_q09: 'style_q09_opt_3',
      growth_q01: 'growth_q01_stage_2',
      growth_q02: 'growth_q02_stage_3',
      growth_q03: 'growth_q03_stage_3',
      growth_q04: 'growth_q04_stage_4',
      growth_q05: 'growth_q05_application',
      growth_q06: 'growth_q06_projects',
      cap_p1_knowledge: 'cap_p1_k_examine',
      cap_p1_experience: 'cap_p1_e_3',
      cap_p2_knowledge: 'cap_p2_k_define',
      cap_p2_experience: 'cap_p2_e_2',
      cap_p3_knowledge: 'cap_p3_k_revisit',
      cap_p3_experience: 'cap_p3_e_2',
      cap_p4_knowledge: 'cap_p4_k_clarify',
      cap_p4_experience: 'cap_p4_e_4',
      cap_p5_knowledge: 'cap_p5_k_coordinate',
      cap_p5_experience: 'cap_p5_e_1',
      cap_p6_knowledge: 'cap_p6_k_value_model',
      cap_p6_experience: 'cap_p6_e_2',
      profile_q01: 'profile_q01_employed',
      profile_q02: 'profile_q02_experience',
      profile_q03: 'profile_q03_very_important',
      profile_q04: 'profile_q04_yes',
      profile_q05: 'profile_q05_consider',
      profile_q06: 'profile_q06_considering',
      profile_q07: 'profile_q07_no',
      profile_q08: 'profile_q08_referral',
      ...(overrides?.selections ?? {}),
    },
    otherText: overrides?.otherText ?? {},
    contact: {
      fullName: 'Chidi Nwosu',
      whatsappNumber: '+2348099990000',
      email: 'Chidi@Example.com',
      city: 'Ikeja',
      state: 'Lagos',
      institution: '',
      whatsappConsent: true,
      ...(overrides?.contact ?? {}),
    },
  };
}

async function createTestServerContext() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kws-stage4-test-'));
  const dbPath = path.join(tempDir, 'test.db');

  process.env.KWS_ADMIN_PASSCODE = 'admin-pass-1234';
  process.env.KWS_ADVISOR_PASSCODE = 'advisor-pass-1234';
  process.env.KWS_SESSION_SECRET = 'stage4-test-session-secret-xyz';

  const repository = new SqliteAssessmentRepository(dbPath);
  const { app } = await createApp({ repository, enableFrontend: false });
  const server = await new Promise<import('http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    tempDir,
    dbPath,
    repository,
    baseUrl,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      repository.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

test('Stage 4 Backend Acceptance Suite', async (t) => {
  const ctx = await createTestServerContext();
  t.after(async () => {
    await ctx.close();
  });

  let draftId = '';
  let draftToken = '';
  const submitNonce = 'nonce_stage4_acceptance_001';

  await t.test('1. Assessment config endpoint exposes structure without answer keys', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/assessment/config`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.assessmentVersion, 'kws-assessment-v2.0');
    assert.equal(body.scoringVersion, 'kws-scoring-v3.0');
    assert.equal(body.sections.length, 4);
    assert.equal(body.questions.length, 36);
    assert.equal(body.stepsCount, 30);
    const serialized = JSON.stringify(body);
    assert.ok(!serialized.includes('PART_C_UNDERSTANDING_CORRECT_OPTIONS'));
    assert.ok(!serialized.includes('optionToStyle'));
  });

  await t.test('2. Full progressive workflow persists raw answers & calculated results across all 10 relational tables', async () => {
    const draftRes = await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'draft',
        idempotencyKey: 'idem_progress_flow_001',
        answers: {
          selections: { style_q01: 'style_q01_opt_1' },
          otherText: {},
          contact: { fullName: 'Draft User <script>alert(1)</script>' },
        },
        attribution: {
          utmSource: 'instagram',
          utmMedium: 'paid_social',
          utmCampaign: 'lagos_2027',
          referrer: 'https://instagram.com',
          landingPath: '/',
        },
        durationMinutes: 2,
      }),
    });
    assert.equal(draftRes.status, 201);
    const draftJson = await draftRes.json();
    draftId = draftJson.record.id;
    draftToken = draftJson.accessToken;
    assert.match(draftId, /^kws_[0-9a-f]{24}$/);
    assert.match(draftToken, /^kws_tok_[0-9a-f]{48}$/);
    assert.equal(draftJson.record.completionStatus, 'in_progress');
    // Sanitized HTML angle brackets
    assert.equal(draftJson.record.contact.fullName, 'Draft User scriptalert(1)/script');

    // Save full answers via PUT
    const fullAnswers = buildCompleteAnswers({
      contact: {
        fullName: '=HYPERLINK("http://evil.com","Ada")',
        whatsappNumber: '+2348011112222',
        email: 'Ada@KWS.example',
        city: 'Ikeja',
        state: 'Lagos',
        institution: '',
        whatsappConsent: true,
      },
    });
    const saveRes = await fetch(`${ctx.baseUrl}/api/submissions/${draftId}/answers`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Submission-Token': draftToken,
      },
      body: JSON.stringify({
        answers: fullAnswers,
        durationMinutes: 5,
      }),
    });
    assert.equal(saveRes.status, 200);

    // Finalize submission
    const finalRes = await fetch(`${ctx.baseUrl}/api/submissions/${draftId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Submission-Token': draftToken,
      },
      body: JSON.stringify({
        submitNonce,
        answers: fullAnswers,
        durationMinutes: 6,
      }),
    });
    assert.equal(finalRes.status, 200);
    const finalJson = await finalRes.json();
    assert.equal(finalJson.deduplicated, false);
    assert.equal(finalJson.record.completionStatus, 'submitted');
    assert.ok(finalJson.record.submittedAt);
    assert.equal(finalJson.record.growthJourney ? undefined : finalJson.record.result.growthJourney.roundedStageLevel, 3);

    // Inspect raw SQLite tables directly to verify all 10 entities
    const inspectDb = new DatabaseSync(ctx.dbPath);
    const countTable = (table: string) =>
      (inspectDb.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

    assert.equal(countTable('assessment_submissions'), 1);
    assert.equal(countTable('respondent_contacts'), 1);
    assert.equal(countTable('part_a_responses'), 1);
    assert.equal(countTable('part_b_responses'), 1);
    assert.equal(countTable('part_c_responses'), 6);
    assert.equal(countTable('part_d_responses'), 1);
    assert.equal(countTable('consultation_requests'), 1);
    assert.equal(countTable('campaign_attributions'), 1);
    assert.ok(countTable('assessment_events') >= 3);
    assert.ok(countTable('report_delivery_events') >= 3);
    inspectDb.close();
  });

  await t.test('3. Safe retry returns same result while duplicate/replay mutations are blocked with 409', async () => {
    // Safe network retry with identical submitNonce -> 200 deduplicated
    const retryRes = await fetch(`${ctx.baseUrl}/api/submissions/${draftId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Submission-Token': draftToken,
      },
      body: JSON.stringify({ submitNonce }),
    });
    assert.equal(retryRes.status, 200);
    const retryJson = await retryRes.json();
    assert.equal(retryJson.deduplicated, true);
    assert.equal(retryJson.record.id, draftId);

    // Conflicting replay with different submitNonce -> 409 Conflict
    const replayRes = await fetch(`${ctx.baseUrl}/api/submissions/${draftId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Submission-Token': draftToken,
      },
      body: JSON.stringify({ submitNonce: 'different_replay_nonce' }),
    });
    assert.equal(replayRes.status, 409);

    // Mutating draft answers after submit -> 409 Conflict
    const mutateRes = await fetch(`${ctx.baseUrl}/api/submissions/${draftId}/answers`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Submission-Token': draftToken,
      },
      body: JSON.stringify({ answers: buildCompleteAnswers() }),
    });
    assert.equal(mutateRes.status, 409);

    // Confirm row count is still 1
    const inspectDb = new DatabaseSync(ctx.dbPath);
    const cnt = (
      inspectDb.prepare('SELECT COUNT(*) AS c FROM assessment_submissions').get() as {
        c: number;
      }
    ).c;
    assert.equal(cnt, 1);
    inspectDb.close();
  });

  await t.test('4. Private results cannot be accessed without private accessToken', async () => {
    const noTokenRes = await fetch(`${ctx.baseUrl}/api/submissions/${draftId}`);
    assert.equal(noTokenRes.status, 401);

    const wrongTokenRes = await fetch(`${ctx.baseUrl}/api/submissions/${draftId}`, {
      headers: { 'X-Submission-Token': 'kws_tok_wrong_000000000' },
    });
    assert.equal(wrongTokenRes.status, 403);

    const validRes = await fetch(`${ctx.baseUrl}/api/submissions/${draftId}`, {
      headers: { 'X-Submission-Token': draftToken },
    });
    assert.equal(validRes.status, 200);
    const validJson = await validRes.json();
    assert.equal(validJson.record.id, draftId);
    assert.equal('staffNotes' in validJson.record, false);
    assert.equal(validJson.record.result.professionalStyle.styleScores.length, 0);

    // Respondent can request a consultation post-results using their private token
    const consRes = await fetch(
      `${ctx.baseUrl}/api/submissions/${draftId}/consultation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Submission-Token': draftToken,
        },
        body: JSON.stringify({ preference: 'book' }),
      }
    );
    assert.equal(consRes.status, 200);
    const consJson = await consRes.json();
    assert.equal(consJson.record.result.nextStep.wantsConsultation, true);
    assert.equal(consJson.record.consultationSummary.status, 'requested');
  });

  await t.test('5. Administrative endpoints enforce authentication and Admin vs Advisor RBAC', async () => {
    const unauthSubs = await fetch(`${ctx.baseUrl}/api/admin/submissions`);
    assert.equal(unauthSubs.status, 401);

    // Login as Advisor
    const advisorLogin = await fetch(`${ctx.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'advisor-pass-1234' }),
    });
    assert.equal(advisorLogin.status, 200);
    const advisorCookie = advisorLogin.headers.get('set-cookie')?.split(';')[0] ?? '';
    assert.ok(advisorCookie);

    // Advisor can list & update consultation
    const advisorList = await fetch(`${ctx.baseUrl}/api/admin/submissions`, {
      headers: { Cookie: advisorCookie },
    });
    assert.equal(advisorList.status, 200);

    const advisorPatch = await fetch(
      `${ctx.baseUrl}/api/admin/consultations/${draftId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: advisorCookie,
        },
        body: JSON.stringify({
          status: 'contacted',
          assignedStaffMember: 'Tunde Advisor',
          incrementAttempt: true,
          outcomeNotes: 'Spoke on WhatsApp, interested in Jan cohort.',
        }),
      }
    );
    assert.equal(advisorPatch.status, 200);
    const patched = await advisorPatch.json();
    assert.equal(patched.record.consultation.contactAttempts, 1);
    assert.equal(patched.record.consultation.assignedStaffMember, 'Tunde Advisor');

    // Advisor CANNOT access bulk PII export or SQLite backup
    const advisorExport = await fetch(
      `${ctx.baseUrl}/api/admin/export?format=csv`,
      { headers: { Cookie: advisorCookie } }
    );
    assert.equal(advisorExport.status, 403);

    const advisorBackup = await fetch(`${ctx.baseUrl}/api/admin/backup`, {
      method: 'POST',
      headers: { Cookie: advisorCookie },
    });
    assert.equal(advisorBackup.status, 403);

    // Login as Admin
    const adminLogin = await fetch(`${ctx.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'admin-pass-1234' }),
    });
    assert.equal(adminLogin.status, 200);
    const adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0] ?? '';

    const csvRes = await fetch(`${ctx.baseUrl}/api/admin/export?format=csv`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(csvRes.status, 200);
    const csvText = await csvRes.text();
    // Neutralized leading '=' formula injection check
    assert.ok(csvText.includes(`'=HYPERLINK`));
    assert.ok(csvText.includes('Tunde Advisor'));

    const backupRes = await fetch(`${ctx.baseUrl}/api/admin/backup`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    assert.equal(backupRes.status, 200);
    const backupJson = await backupRes.json();
    assert.equal(backupJson.ok, true);
    assert.ok(backupJson.sizeBytes > 0);
  });

  await t.test('6. Historical assessment and scoring versions are preserved intact', async () => {
    const inspectDb = new DatabaseSync(ctx.dbPath);
    inspectDb
      .prepare(
        `INSERT INTO respondent_contacts
         (id, full_name, whatsapp_number, email, city, state, institution, whatsapp_consent, created_at, updated_at)
         VALUES ('resp_hist_1', 'Historical Tester', '+2348000000001', 'hist@example.com', 'Abuja', 'FCT', '', 0, '2025-01-10T10:00:00.000Z', '2025-01-10T10:00:00.000Z')`
      )
      .run();

    const historicalAnswers = buildCompleteAnswers();
    const snapshot = {
      assessmentVersion: 'kws-assessment-v1.0',
      scoringVersion: 'kws-scoring-v1.0',
      partAConfigVersion: 'legacy-v1',
      partAConfigApproved: false,
      questionIds: Object.keys(historicalAnswers.selections),
    };

    inspectDb
      .prepare(
        `INSERT INTO assessment_submissions
         (id, result_token_hash, idempotency_key, submit_nonce, completion_status,
          assessment_version, scoring_version, part_a_config_version, assessment_snapshot_json,
          respondent_id, duration_minutes, created_at, updated_at, submitted_at,
          raw_selections_json, raw_other_text_json, calculated_result_json, feedback_json)
         VALUES ('kws_hist_0001', 'legacyhash', 'idem_hist_1', 'nonce_hist_1', 'submitted',
          'kws-assessment-v1.0', 'kws-scoring-v1.0', 'legacy-v1', ?,
          'resp_hist_1', 9, '2025-01-10T10:00:00.000Z', '2025-01-10T10:09:00.000Z', '2025-01-10T10:09:00.000Z',
          ?, '{}', NULL, '{"archetypeFits":"Yes","stageFits":"Yes","notes":""}')`
      )
      .run(JSON.stringify(snapshot), JSON.stringify(historicalAnswers.selections));
    inspectDb.close();

    const adminLogin = await fetch(`${ctx.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'admin-pass-1234' }),
    });
    const adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0] ?? '';

    const detailRes = await fetch(
      `${ctx.baseUrl}/api/admin/submissions/kws_hist_0001`,
      { headers: { Cookie: adminCookie } }
    );
    assert.equal(detailRes.status, 200);
    const detailJson = await detailRes.json();
    assert.equal(detailJson.record.assessmentVersion, 'kws-assessment-v1.0');
    assert.equal(detailJson.record.scoringVersion, 'kws-scoring-v1.0');
    assert.equal(detailJson.record.partAConfigVersion, 'legacy-v1');
    assert.equal(
      detailJson.record.answers.selections.growth_q01,
      'growth_q01_stage_2'
    );
  });
});
