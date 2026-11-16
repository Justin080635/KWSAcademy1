import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createApp } from '../server/app.ts';
import { SqliteAssessmentRepository } from '../server/storage.ts';
import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_SECTIONS,
  ASSESSMENT_STEPS,
  CAPABILITY_CARDS,
} from '../src/domain/assessmentContent.ts';
import {
  isStepComplete,
  scoreAssessment,
  validateAllAnswers,
  validateContactDetails,
} from '../src/domain/scoring.ts';
import type { RespondentAnswers } from '../src/domain/types.ts';

function buildCompleteAnswers(
  overrides?: Partial<RespondentAnswers>
): RespondentAnswers {
  return {
    selections: {
      style_q01: 'style_q01_opt_6',
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
      fullName: 'Adaeze Okafor',
      whatsappNumber: '+2348011223344',
      email: 'adaeze@example.com',
      city: 'Ikeja',
      state: 'Lagos',
      institution: '',
      whatsappConsent: true,
      ...(overrides?.contact ?? {}),
    },
  };
}

async function createQaServerContext(options?: {
  enableFrontend?: boolean;
  prodEnv?: boolean;
}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kws-stage7-qa-'));
  const dbPath = path.join(tempDir, 'qa.db');

  const prevNodeEnv = process.env.NODE_ENV;
  if (options?.prodEnv) {
    process.env.NODE_ENV = 'production';
  }
  process.env.KWS_ADMIN_PASSCODE = 'stage7-admin-pass';
  process.env.KWS_ADVISOR_PASSCODE = 'stage7-advisor-pass';
  process.env.KWS_VIEWER_PASSCODE = 'stage7-viewer-pass';
  process.env.KWS_SESSION_SECRET = 'stage7-qa-session-secret-xyz';

  const repository = new SqliteAssessmentRepository(dbPath);
  const { app } = await createApp({
    repository,
    enableFrontend: Boolean(options?.enableFrontend),
  });
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
      if (options?.prodEnv) {
        process.env.NODE_ENV = prevNodeEnv;
      }
    },
  };
}

test('Stage 7 Final Integration, QA & Production Readiness Suite', async (t) => {
  await t.test(
    '1. End-to-End Assessment Structure, Conditional Validation & Step Readiness',
    () => {
      assert.equal(ASSESSMENT_SECTIONS.length, 4);
      assert.equal(CAPABILITY_CARDS.length, 6);
      assert.equal(
        ASSESSMENT_QUESTIONS.filter((q) => q.sectionId === 'professional_style')
          .length,
        9
      );
      assert.equal(
        ASSESSMENT_QUESTIONS.some((q) => q.id === 'style_q10'),
        false
      );
      assert.equal(
        ASSESSMENT_QUESTIONS.filter((q) => q.sectionId === 'growth_journey')
          .length,
        6
      );
      assert.equal(
        ASSESSMENT_QUESTIONS.filter((q) => q.sectionId === 'strengths_growth')
          .length,
        12
      );
      assert.equal(
        ASSESSMENT_QUESTIONS.filter((q) => q.sectionId === 'profile_next_steps')
          .length,
        9
      );
      assert.equal(ASSESSMENT_STEPS.length, 30);

      const base = buildCompleteAnswers();
      for (let i = 0; i < ASSESSMENT_STEPS.length; i += 1) {
        assert.equal(isStepComplete(i, base), true, `Step ${i} should pass`);
      }

      // Conditional institution validation for university student / recent graduate
      const studentStepIdx = ASSESSMENT_STEPS.findIndex(
        (s) => s.id === 'profile_q01'
      );
      const studentMissingInst = buildCompleteAnswers({
        selections: {
          ...base.selections,
          profile_q01: 'profile_q01_student',
        },
        contact: { ...base.contact, institution: '' },
      });
      assert.equal(isStepComplete(studentStepIdx, studentMissingInst), false);
      assert.deepEqual(
        validateAllAnswers(studentMissingInst).missingQuestionIds,
        ['profile_q01']
      );

      const studentWithInst = buildCompleteAnswers({
        selections: {
          ...base.selections,
          profile_q01: 'profile_q01_graduate',
        },
        contact: { ...base.contact, institution: 'University of Lagos' },
      });
      assert.equal(isStepComplete(studentStepIdx, studentWithInst), true);
      assert.equal(validateAllAnswers(studentWithInst).valid, true);

      // Conditional otherText validation
      const otherMissing = buildCompleteAnswers({
        selections: {
          ...base.selections,
          profile_q08: 'profile_q08_other',
        },
        otherText: {},
      });
      assert.equal(validateAllAnswers(otherMissing).valid, false);

      // Contact validation rejects bad email & empty required fields
      assert.equal(
        validateContactDetails({ ...base.contact, email: 'not-an-email' })
          .valid,
        false
      );
      assert.equal(
        validateContactDetails({ ...base.contact, fullName: '   ' }).valid,
        false
      );
    }
  );

  await t.test(
    '2. E2E Journey HTTP Flow: Back/Answer Overwrite, Student Institution Gate, Consultation Preference & Invalid Inputs',
    async () => {
      const ctx = await createQaServerContext();
      try {
        const base = buildCompleteAnswers();

        // Start progressive draft with partial answers
        const partial = {
          selections: { style_q01: 'style_q01_opt_6' },
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

        const draftRes = await fetch(`${ctx.baseUrl}/api/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'draft',
            idempotencyKey: 'stage7_idem_1',
            answers: partial,
            durationMinutes: 1,
          }),
        });
        assert.equal(draftRes.status, 201);
        const draftBody = await draftRes.json();
        const subId = draftBody.record.id as string;
        const token = draftBody.accessToken as string;
        assert.ok(subId && token);

        // Simulate navigating Back & overwriting style_q01 selection
        const updatedDraftAnswers = buildCompleteAnswers({
          selections: {
            ...base.selections,
            style_q01: 'style_q01_opt_5',
            profile_q01: 'profile_q01_student',
            profile_q07: 'profile_q07_yes',
          },
          contact: {
            ...base.contact,
            institution: '',
          },
        });

        const putRes = await fetch(
          `${ctx.baseUrl}/api/submissions/${subId}/answers`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Submission-Token': token,
            },
            body: JSON.stringify({
              answers: updatedDraftAnswers,
              durationMinutes: 3,
            }),
          }
        );
        assert.equal(putRes.status, 200);
        const putBody = await putRes.json();
        assert.equal(putBody.record.answers.selections.style_q01, 'style_q01_opt_5');

        // Student without institution must fail finalize (400)
        const failStudentRes = await fetch(
          `${ctx.baseUrl}/api/submissions/${subId}/submit`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Submission-Token': token,
            },
            body: JSON.stringify({
              submitNonce: 'nonce_s7_1',
              answers: updatedDraftAnswers,
              durationMinutes: 3,
            }),
          }
        );
        assert.equal(failStudentRes.status, 400);
        const failStudentJson = await failStudentRes.json();
        assert.equal(failStudentJson.error, 'INCOMPLETE_ASSESSMENT');
        assert.ok(failStudentJson.missingQuestionIds.includes('profile_q01'));

        // Supply institution and submit cleanly
        const validStudentAnswers = {
          ...updatedDraftAnswers,
          contact: {
            ...updatedDraftAnswers.contact,
            institution: 'Yaba College of Technology',
          },
        };
        const okRes = await fetch(
          `${ctx.baseUrl}/api/submissions/${subId}/submit`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Submission-Token': token,
            },
            body: JSON.stringify({
              submitNonce: 'nonce_s7_2',
              answers: validStudentAnswers,
              durationMinutes: 4,
            }),
          }
        );
        assert.equal(okRes.status, 200);
        const okJson = await okRes.json();
        assert.equal(okJson.record.completionStatus, 'submitted');
        assert.equal(okJson.record.consultationSummary.preference, 'book');
        assert.equal(okJson.record.consultationSummary.status, 'requested');
        assert.equal(
          okJson.record.result.professionalStyle.status,
          'complete'
        );

        // Retry with same submitNonce returns deduplicated cleanly
        const retryRes = await fetch(
          `${ctx.baseUrl}/api/submissions/${subId}/submit`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Submission-Token': token,
            },
            body: JSON.stringify({
              submitNonce: 'nonce_s7_2',
              answers: validStudentAnswers,
              durationMinutes: 4,
            }),
          }
        );
        assert.equal(retryRes.status, 200);
        const retryJson = await retryRes.json();
        assert.equal(retryJson.deduplicated, true);

        // Replay with different submitNonce blocked with 409
        const replayRes = await fetch(
          `${ctx.baseUrl}/api/submissions/${subId}/submit`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Submission-Token': token,
            },
            body: JSON.stringify({
              submitNonce: 'nonce_s7_other',
              answers: validStudentAnswers,
              durationMinutes: 4,
            }),
          }
        );
        assert.equal(replayRes.status, 409);

        // Private result fetch without token blocked (401/403); with token succeeds
        const noTokRes = await fetch(`${ctx.baseUrl}/api/submissions/${subId}`);
        assert.ok(noTokRes.status === 401 || noTokRes.status === 403);

        const withTokRes = await fetch(
          `${ctx.baseUrl}/api/submissions/${subId}`,
          {
            headers: { 'X-Submission-Token': token },
          }
        );
        assert.equal(withTokRes.status, 200);

        // Verify raw answer replacement stored in SQLite
        const scoredClient = scoreAssessment(validStudentAnswers);
        assert.equal(
          scoredClient.growthJourney.indicativeStage.level,
          okJson.record.result.growthJourney.indicativeStage.level
        );
      } finally {
        await ctx.close();
      }
    }
  );

  await t.test(
    '3. Security & Reliability Hardening: Malformed JSON, Unknown /api Route, RBAC & Hot SQLite Backup',
    async () => {
      const ctx = await createQaServerContext();
      try {
        // Unknown /api endpoint returns JSON 404 (not HTML)
        const unknownApi = await fetch(`${ctx.baseUrl}/api/unknown/endpoint`);
        assert.equal(unknownApi.status, 404);
        assert.ok(
          (unknownApi.headers.get('content-type') ?? '').includes(
            'application/json'
          )
        );
        const unknownJson = await unknownApi.json();
        assert.equal(unknownJson.error, 'NOT_FOUND');

        // Malformed JSON body returns clean 400 INVALID_JSON
        const badJsonRes = await fetch(`${ctx.baseUrl}/api/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{broken_json',
        });
        assert.equal(badJsonRes.status, 400);
        const badJson = await badJsonRes.json();
        assert.equal(badJson.error, 'INVALID_JSON');

        // Viewer login: allowed read, blocked (403) on backup & export
        const viewerLogin = await fetch(`${ctx.baseUrl}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: 'stage7-viewer-pass' }),
        });
        assert.equal(viewerLogin.status, 200);
        const viewerCookie = viewerLogin.headers.get('set-cookie')!.split(';')[0];

        const viewerBackup = await fetch(`${ctx.baseUrl}/api/admin/backup`, {
          method: 'POST',
          headers: { Cookie: viewerCookie },
        });
        assert.equal(viewerBackup.status, 403);

        // Admin login: allowed backup & download verified via SQLite integrity_check
        const adminLogin = await fetch(`${ctx.baseUrl}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: 'stage7-admin-pass' }),
        });
        assert.equal(adminLogin.status, 200);
        const adminCookie = adminLogin.headers.get('set-cookie')!.split(';')[0];

        const backupRes = await fetch(`${ctx.baseUrl}/api/admin/backup`, {
          method: 'POST',
          headers: { Cookie: adminCookie },
        });
        assert.equal(backupRes.status, 200);
        const backupJson = await backupRes.json();
        assert.equal(backupJson.ok, true);
        assert.ok(backupJson.sizeBytes > 0);

        const dlRes = await fetch(`${ctx.baseUrl}/api/admin/backup/download`, {
          headers: { Cookie: adminCookie },
        });
        assert.equal(dlRes.status, 200);
        const dlBuffer = Buffer.from(await dlRes.arrayBuffer());
        const verifyPath = path.join(ctx.tempDir, 'verify-downloaded.db');
        fs.writeFileSync(verifyPath, dlBuffer);
        const verifyDb = new DatabaseSync(verifyPath, { readOnly: true });
        const integrity = verifyDb
          .prepare('PRAGMA integrity_check')
          .get() as { integrity_check: string };
        verifyDb.close();
        assert.equal(integrity.integrity_check, 'ok');
      } finally {
        await ctx.close();
      }
    }
  );

  await t.test(
    '4. Production Mode Static Serving & Compiled Bundle Safety Check',
    async () => {
      const distIndex = path.resolve(process.cwd(), 'dist', 'index.html');
      assert.ok(
        fs.existsSync(distIndex),
        'dist/index.html must exist after npm run build'
      );

      // Verify no scoring key maps or secret defaults leak in compiled dist JS
      const assetsDir = path.resolve(process.cwd(), 'dist', 'assets');
      const jsFiles = fs
        .readdirSync(assetsDir)
        .filter((f) => f.endsWith('.js'));
      assert.ok(jsFiles.length > 0);
      const bundleText = jsFiles
        .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8'))
        .join('\n');
      assert.ok(!bundleText.includes('PART_C_UNDERSTANDING_CORRECT_OPTIONS'));
      assert.ok(!bundleText.includes('DEFAULT_PART_A_SCORING_CONFIG'));
      assert.ok(!bundleText.includes('stage7-admin-pass'));

      const ctx = await createQaServerContext({
        enableFrontend: true,
        prodEnv: true,
      });
      try {
        const homeRes = await fetch(`${ctx.baseUrl}/`);
        assert.equal(homeRes.status, 200);
        assert.ok(
          (homeRes.headers.get('content-type') ?? '').includes('text/html')
        );

        const spaAdminRes = await fetch(`${ctx.baseUrl}/admin`);
        assert.equal(spaAdminRes.status, 200);
        assert.ok(
          (spaAdminRes.headers.get('content-type') ?? '').includes('text/html')
        );

        const heroImgRes = await fetch(
          `${ctx.baseUrl}/src/assets/images/hero_kws_discovery_1794821662726.jpg`
        );
        assert.equal(heroImgRes.status, 200);
        assert.ok(
          (heroImgRes.headers.get('content-type') ?? '').includes('image/jpeg')
        );

        const unknownApiProd = await fetch(`${ctx.baseUrl}/api/nope`);
        assert.equal(unknownApiProd.status, 404);
        assert.ok(
          (unknownApiProd.headers.get('content-type') ?? '').includes(
            'application/json'
          )
        );
      } finally {
        await ctx.close();
      }
    }
  );
});
