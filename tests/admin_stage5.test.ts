import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../server/app.ts';
import {
  ALL_CONSULTATION_STATUSES,
  ALL_REVIEW_CATEGORIES,
  SqliteAssessmentRepository,
} from '../server/storage.ts';
import type { RespondentAnswers } from '../src/domain/types.ts';

function buildCompleteAnswers(overrides?: {
  selections?: Record<string, string>;
  contact?: Partial<RespondentAnswers['contact']>;
}): RespondentAnswers {
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
      cap_p6_experience: 'cap_p6_e_0',
      profile_q01: 'profile_q01_employed',
      profile_q02: 'profile_q02_experience',
      profile_q03: 'profile_q03_very_important',
      profile_q04: 'profile_q04_yes',
      profile_q05: 'profile_q05_consider',
      profile_q06: 'profile_q06_considering',
      profile_q07: 'profile_q07_yes',
      profile_q08: 'profile_q08_referral',
      ...(overrides?.selections ?? {}),
    },
    otherText: {},
    contact: {
      fullName: 'Amina Bello',
      whatsappNumber: '+2348012345678',
      email: 'amina@example.com',
      city: 'Ikeja',
      state: 'Lagos',
      institution: '',
      whatsappConsent: true,
      ...(overrides?.contact ?? {}),
    },
  };
}

async function createStage5TestContext() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kws-stage5-test-'));
  const dbPath = path.join(tempDir, 'stage5.db');

  process.env.KWS_ADMIN_PASSCODE = 'admin-stage5-pass';
  process.env.KWS_ADVISOR_PASSCODE = 'advisor-stage5-pass';
  process.env.KWS_VIEWER_PASSCODE = 'viewer-stage5-pass';
  process.env.KWS_SESSION_SECRET = 'stage5-test-session-secret';
  process.env.KWS_STAFF_ALLOWLIST =
    'director@kws.example,advisor@kws.example,observer@kws.example';
  process.env.KWS_STAFF_ACCOUNTS = JSON.stringify([
    {
      email: 'director@kws.example',
      name: 'KWS Director',
      passcode: 'director-pw-123',
      role: 'admin',
    },
    {
      email: 'advisor@kws.example',
      name: 'KWS Lead Advisor',
      passcode: 'advisor-pw-123',
      role: 'advisor',
    },
    {
      email: 'observer@kws.example',
      name: 'KWS Analyst Viewer',
      passcode: 'observer-pw-123',
      role: 'viewer',
    },
  ]);

  const repository = new SqliteAssessmentRepository(dbPath);
  const { app } = await createApp({ repository, enableFrontend: false });
  const server = await new Promise<import('http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    repository,
    close: async () => {
      delete process.env.KWS_STAFF_ALLOWLIST;
      delete process.env.KWS_STAFF_ACCOUNTS;
      delete process.env.KWS_VIEWER_PASSCODE;
      await new Promise<void>((resolve) => server.close(() => resolve()));
      repository.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

test('Stage 5 Administrative Dashboard Acceptance Suite', async (t) => {
  const ctx = await createStage5TestContext();
  t.after(async () => {
    await ctx.close();
  });

  let adminCookie = '';
  let advisorCookie = '';
  let viewerCookie = '';

  let subLagosId = '';
  let subLagosToken = '';
  let subAbujaId = '';

  await t.test('1. Staff account & allowlist authentication and RBAC sign-in', async () => {
    const statusRes = await fetch(`${ctx.baseUrl}/api/admin/status`);
    assert.equal(statusRes.status, 200);
    const statusJson = await statusRes.json();
    assert.equal(statusJson.authConfigured, true);
    assert.equal(statusJson.accountSignInEnabled, true);
    assert.equal(statusJson.allowlistEnabled, true);

    // Non-allowlisted email rejected even with passcode
    const outsiderRes = await fetch(`${ctx.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'outsider@example.com',
        passcode: 'admin-stage5-pass',
      }),
    });
    assert.equal(outsiderRes.status, 401);

    // Sign in Admin account
    const adminLogin = await fetch(`${ctx.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'director@kws.example',
        passcode: 'director-pw-123',
      }),
    });
    assert.equal(adminLogin.status, 200);
    const adminBody = await adminLogin.json();
    assert.equal(adminBody.role, 'admin');
    assert.equal(adminBody.actorLabel, 'KWS Director');
    adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0] ?? '';

    // Sign in Advisor account
    const advisorLogin = await fetch(`${ctx.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'advisor@kws.example',
        passcode: 'advisor-pw-123',
      }),
    });
    assert.equal(advisorLogin.status, 200);
    advisorCookie = advisorLogin.headers.get('set-cookie')?.split(';')[0] ?? '';

    // Sign in Viewer account
    const viewerLogin = await fetch(`${ctx.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'observer@kws.example',
        passcode: 'observer-pw-123',
      }),
    });
    assert.equal(viewerLogin.status, 200);
    const viewerBody = await viewerLogin.json();
    assert.equal(viewerBody.role, 'viewer');
    viewerCookie = viewerLogin.headers.get('set-cookie')?.split(';')[0] ?? '';
  });

  await t.test('2. Empty database returns clean null rates and zero fabricated figures', async () => {
    const emptyAnalyticsRes = await fetch(`${ctx.baseUrl}/api/admin/analytics`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(emptyAnalyticsRes.status, 200);
    const { summary } = await emptyAnalyticsRes.json();
    assert.equal(summary.totalStarts, 0);
    assert.equal(summary.totalSubmissions, 0);
    assert.equal(summary.completionRatePct, null);
    assert.equal(summary.averageDurationMinutes, null);
    assert.equal(summary.inProgressDrafts, 0);
    assert.equal(summary.consultationRequests, 0);
  });

  await t.test('3. Seed incomplete start + two completed submissions and verify all 14 analytics metrics', async () => {
    // 1 in-progress draft
    const draftRes = await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'draft',
        idempotencyKey: 'stage5_draft_001',
        answers: {
          selections: { style_q01: 'style_q01_opt_6' },
          otherText: {},
          contact: { fullName: 'Draft Starter', city: 'Ikeja', state: 'Lagos' },
        },
        durationMinutes: 1,
      }),
    });
    assert.equal(draftRes.status, 201);

    // Completed Submission 1: Lagos, Employed, Very Important urgency, Ready financially, Yes Jan 2027, Instagram
    const sub1Res = await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'submit',
        idempotencyKey: 'stage5_sub_lagos_001',
        submitNonce: 'stage5_nonce_lagos_001',
        durationMinutes: 6,
        attribution: { utmSource: 'instagram', utmMedium: 'social' },
        answers: buildCompleteAnswers({
          selections: {
            profile_q01: 'profile_q01_employed',
            profile_q03: 'profile_q03_very_important',
            profile_q05: 'profile_q05_ready',
            profile_q06: 'profile_q06_ready',
            profile_q07: 'profile_q07_yes',
          },
          contact: {
            fullName: 'Toluwanimi Lagos',
            email: 'tolu@lagos.example',
            city: 'Ikeja',
            state: 'Lagos',
          },
        }),
      }),
    });
    assert.equal(sub1Res.status, 201);
    const sub1Json = await sub1Res.json();
    subLagosId = sub1Json.record.id;
    subLagosToken = sub1Json.accessToken;

    // Completed Submission 2: Abuja, Student, Exploring urgency, Needs sponsorship, No Jan 2027, Referral
    const sub2Res = await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'submit',
        idempotencyKey: 'stage5_sub_abuja_001',
        submitNonce: 'stage5_nonce_abuja_001',
        durationMinutes: 10,
        attribution: { utmSource: 'linkedin', utmMedium: 'organic' },
        answers: buildCompleteAnswers({
          selections: {
            profile_q01: 'profile_q01_student',
            profile_q02: 'profile_q02_direction',
            profile_q03: 'profile_q03_later',
            profile_q04: 'profile_q04_possibly',
            profile_q05: 'profile_q05_support',
            profile_q06: 'profile_q06_not_ready',
            profile_q07: 'profile_q07_no',
            profile_q08: 'profile_q08_campus',
          },
          contact: {
            fullName: 'Ibrahim Abuja',
            email: 'ibrahim@abuja.example',
            city: 'Abuja',
            state: 'FCT',
            institution: 'University of Abuja',
            whatsappConsent: false,
          },
        }),
      }),
    });
    assert.equal(sub2Res.status, 201);
    subAbujaId = (await sub2Res.json()).record.id;

    const analyticsRes = await fetch(`${ctx.baseUrl}/api/admin/analytics`, {
      headers: { Cookie: viewerCookie },
    });
    assert.equal(analyticsRes.status, 200);
    const { summary } = await analyticsRes.json();

    assert.equal(summary.totalStarts, 3);
    assert.equal(summary.totalSubmissions, 2);
    assert.equal(summary.inProgressDrafts, 1);
    assert.equal(summary.completionRatePct, 67);
    assert.equal(summary.consultationRequests, 1);
    assert.equal(summary.averageDurationMinutes, 8);
    assert.equal(summary.partAConfigApproved, true);
    assert.equal(summary.incompleteStyleCount, 0);
    assert.equal(summary.stageDistribution.length, 5);
    assert.equal(summary.pillarAverages.length, 6);
    assert.equal(summary.pillarAverages[0].experienceDistribution.length, 5);
    assert.ok(summary.audienceSegments.some((a: { count: number }) => a.count > 0));
    assert.ok(summary.challengesBreakdown.some((c: { count: number }) => c.count > 0));
    assert.ok(summary.urgencyBreakdown.some((u: { count: number }) => u.count > 0));
    assert.equal(summary.geographicBreakdown.length, 2);
    assert.ok(
      summary.financialReadinessBreakdown.some((f: { count: number }) => f.count > 0)
    );
    assert.ok(summary.januaryCohortBreakdown.some((j: { count: number }) => j.count > 0));
  });

  await t.test('4. Human lead review categories & 10 follow-up statuses respect RBAC and remain hidden from respondents', async () => {
    // Viewer CANNOT update review categories or statuses -> 403
    const viewerPatch = await fetch(
      `${ctx.baseUrl}/api/admin/consultations/${subLagosId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: viewerCookie,
        },
        body: JSON.stringify({
          reviewCategory: 'priority_consultation',
          consultationStatus: 'approved_for_contact',
        }),
      }
    );
    assert.equal(viewerPatch.status, 403);

    // Advisor cycles through every review category and follow-up status cleanly
    for (const cat of ALL_REVIEW_CATEGORIES) {
      const res = await fetch(
        `${ctx.baseUrl}/api/admin/consultations/${subLagosId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: advisorCookie,
          },
          body: JSON.stringify({ reviewCategory: cat }),
        }
      );
      assert.equal(res.status, 200);
    }

    for (const status of ALL_CONSULTATION_STATUSES) {
      const res = await fetch(
        `${ctx.baseUrl}/api/admin/consultations/${subLagosId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: advisorCookie,
          },
          body: JSON.stringify({
            consultationStatus: status,
            reviewCategory: 'priority_consultation',
            assignedStaffMember: 'KWS Lead Advisor',
            outcomeNotes: 'Human review verified readiness for consultation.',
          }),
        }
      );
      assert.equal(res.status, 200);
    }

    const detailRes = await fetch(
      `${ctx.baseUrl}/api/admin/submissions/${subLagosId}`,
      { headers: { Cookie: adminCookie } }
    );
    assert.equal(detailRes.status, 200);
    const { record } = await detailRes.json();
    assert.equal(record.consultation.reviewCategory, 'priority_consultation');
    assert.equal(record.consultation.status, 'closed');
    assert.equal(record.consultation.reviewedBy, 'KWS Lead Advisor');
    assert.ok(record.consultation.reviewedAt);
    assert.ok(record.consultation.statusUpdatedAt);

    // Respondent endpoint MUST NEVER expose reviewCategory or staffNotes
    const respondentRes = await fetch(
      `${ctx.baseUrl}/api/submissions/${subLagosId}`,
      { headers: { 'X-Submission-Token': subLagosToken } }
    );
    assert.equal(respondentRes.status, 200);
    const respondentJson = await respondentRes.json();
    const serialized = JSON.stringify(respondentJson);
    assert.ok(!serialized.includes('priority_consultation'));
    assert.ok(!serialized.includes('reviewCategory'));
    assert.ok(!serialized.includes('outcomeNotes'));
    assert.ok(!serialized.includes('Human review verified'));
  });

  await t.test('5. Shared filtering works across analytics, directory, and CSV/XLSX exports', async () => {
    const query =
      'location=Abuja&audience=profile_q01_student&financialReadiness=profile_q05_support&januaryCohort=profile_q06_not_ready';

    const dirRes = await fetch(
      `${ctx.baseUrl}/api/admin/submissions?${query}`,
      { headers: { Cookie: adminCookie } }
    );
    assert.equal(dirRes.status, 200);
    const dirJson = await dirRes.json();
    assert.equal(dirJson.records.length, 1);
    assert.equal(dirJson.records[0].id, subAbujaId);

    const anaRes = await fetch(
      `${ctx.baseUrl}/api/admin/analytics?${query}`,
      { headers: { Cookie: adminCookie } }
    );
    assert.equal(anaRes.status, 200);
    const { summary } = await anaRes.json();
    assert.equal(summary.totalSubmissions, 1);
    assert.equal(summary.consultationRequests, 0);

    // Viewer & Advisor are blocked from exports -> 403
    const viewerExport = await fetch(
      `${ctx.baseUrl}/api/admin/export?format=xlsx&${query}`,
      { headers: { Cookie: viewerCookie } }
    );
    assert.equal(viewerExport.status, 403);

    // Filtered CSV contains Abuja record only, excludes Lagos record
    const csvRes = await fetch(
      `${ctx.baseUrl}/api/admin/export?format=csv&${query}`,
      { headers: { Cookie: adminCookie } }
    );
    assert.equal(csvRes.status, 200);
    const csvText = await csvRes.text();
    assert.ok(csvText.includes('Ibrahim Abuja'));
    assert.ok(!csvText.includes('Toluwanimi Lagos'));

    // Filtered Excel (.xlsx) returns valid ZIP OOXML container
    const xlsxRes = await fetch(
      `${ctx.baseUrl}/api/admin/export?format=xlsx&${query}`,
      { headers: { Cookie: adminCookie } }
    );
    assert.equal(xlsxRes.status, 200);
    assert.equal(
      xlsxRes.headers.get('content-type'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const xlsxBytes = new Uint8Array(await xlsxRes.arrayBuffer());
    assert.ok(xlsxBytes.length > 500);
    // ZIP local file header magic bytes: P K \x03 \x04
    assert.equal(xlsxBytes[0], 0x50);
    assert.equal(xlsxBytes[1], 0x4b);
    assert.equal(xlsxBytes[2], 0x03);
    assert.equal(xlsxBytes[3], 0x04);
  });
});
