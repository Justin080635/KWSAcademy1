import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../server/app.ts';
import { SqliteAssessmentRepository } from '../server/storage.ts';
import { ASSESSMENT_QUESTIONS } from '../src/domain/assessmentContent.ts';
import type { RespondentAnswers } from '../src/domain/types.ts';

function buildCompleteAnswers(overrides?: {
  selections?: Record<string, string>;
  contact?: Partial<RespondentAnswers['contact']>;
}): RespondentAnswers {
  return {
    selections: {
      A1: 'A1-A',
      A2: 'A2-C',
      A3: 'A3-A',
      A4: 'A4-D',
      A5: 'A5-A',
      A6: 'A6-C',
      A7: 'A7-C',
      A8: 'A8-B',
      A9: 'A9-B',
      B1: 'B1-B',
      B2: 'B2-C',
      B3: 'B3-C',
      B4: 'B4-D',
      B5: 'B5-C',
      B6: 'B6-C',
      'C1-U': 'C1-U-C',
      'C1-E': 'C1-E-D',
      'C2-U': 'C2-U-D',
      'C2-E': 'C2-E-C',
      'C3-U': 'C3-U-B',
      'C3-E': 'C3-E-C',
      'C4-U': 'C4-U-D',
      'C4-E': 'C4-E-E',
      'C5-U': 'C5-U-A',
      'C5-E': 'C5-E-B',
      'C6-U': 'C6-U-C',
      'C6-E': 'C6-E-A',
      D1: 'D1-D',
      D2: 'D2-C',
      D3: 'D3-D',
      D4: 'D4-A',
      D5: 'D5-C',
      D6: 'D6-B',
      D7: 'D7-A',
      D8: 'D8-F',
      ...(overrides?.selections ?? {}),
    },
    otherText: {},
    contact: {
      fullName: 'Kemi Adeyemi',
      whatsappNumber: '+2348099988877',
      email: 'kemi@example.com',
      city: 'Ikeja',
      state: 'Lagos',
      institution: '',
      whatsappConsent: true,
      ...(overrides?.contact ?? {}),
    },
  };
}

async function createStage6Context() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kws-stage6-test-'));
  const dbPath = path.join(tempDir, 'stage6.db');

  process.env.KWS_ADMIN_PASSCODE = 'admin-stage6-pass';
  process.env.KWS_ADVISOR_PASSCODE = 'advisor-stage6-pass';
  process.env.KWS_VIEWER_PASSCODE = 'viewer-stage6-pass';
  process.env.KWS_SESSION_SECRET = 'stage6-test-secret';

  delete process.env.KWS_EMAIL_PROVIDER;
  delete process.env.KWS_EMAIL_WEBHOOK_URL;
  delete process.env.KWS_EMAIL_RESULTS_ENABLED;
  delete process.env.KWS_WHATSAPP_PROVIDER;
  delete process.env.KWS_WHATSAPP_WEBHOOK_URL;
  delete process.env.KWS_MAILCHIMP_API_KEY;
  delete process.env.KWS_MAILCHIMP_AUDIENCE_ID;
  delete process.env.KWS_CRM_WEBHOOK_URL;
  delete process.env.KWS_CRM_WEBHOOK_SECRET;

  const repository = new SqliteAssessmentRepository(dbPath);
  const { app } = await createApp({ repository, enableFrontend: false });
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    repository,
    close: async () => {
      delete process.env.KWS_EMAIL_PROVIDER;
      delete process.env.KWS_EMAIL_WEBHOOK_URL;
      delete process.env.KWS_EMAIL_RESULTS_ENABLED;
      delete process.env.KWS_WHATSAPP_PROVIDER;
      delete process.env.KWS_WHATSAPP_WEBHOOK_URL;
      delete process.env.KWS_CRM_WEBHOOK_URL;
      delete process.env.KWS_CRM_WEBHOOK_SECRET;
      await new Promise<void>((resolve) => server.close(() => resolve()));
      repository.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

async function loginAs(baseUrl: string, passcode: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode }),
  });
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie');
  assert.ok(cookie);
  return cookie.split(';')[0];
}

test('Question-level telemetry distinguishes active vs inactive time, computes medians, and tracks section drop-offs', async () => {
  const ctx = await createStage6Context();
  try {
    const adminCookie = await loginAs(ctx.baseUrl, 'admin-stage6-pass');

    // Create two completed submissions and one abandoned draft
    const sub1Res = await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'submit',
        answers: buildCompleteAnswers(),
        durationMinutes: 6,
      }),
    });
    assert.equal(sub1Res.status, 201);
    const sub1Data = (await sub1Res.json()) as {
      record: { id: string };
      accessToken: string;
    };

    // Record telemetry for sub1 including active vs tab-inactive split
    const tel1Res = await fetch(
      `${ctx.baseUrl}/api/submissions/${sub1Data.record.id}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Submission-Token': sub1Data.accessToken,
        },
        body: JSON.stringify({
          events: [
            { eventType: 'assessment_started', sectionId: 'professional_style' },
            { eventType: 'section_entered', sectionId: 'professional_style' },
            {
              eventType: 'question_displayed',
              sectionId: 'professional_style',
              questionId: 'A1',
            },
            {
              eventType: 'answer_selected',
              sectionId: 'professional_style',
              questionId: 'A1',
              optionId: 'A1-A',
            },
            {
              eventType: 'answer_changed',
              sectionId: 'professional_style',
              questionId: 'A1',
              optionId: 'A1-B',
              previousOptionId: 'A1-A',
            },
            {
              eventType: 'continue_clicked',
              sectionId: 'professional_style',
              questionId: 'A1',
              activeTimeMs: 4000,
              inactiveTimeMs: 60000, // 60s tab inactive must NOT inflate active time
              wallTimeMs: 64000,
            },
            {
              eventType: 'question_displayed',
              sectionId: 'growth_journey',
              questionId: 'B1',
            },
            {
              eventType: 'continue_clicked',
              sectionId: 'growth_journey',
              questionId: 'B1',
              activeTimeMs: 12000,
              inactiveTimeMs: 0,
              wallTimeMs: 12000,
            },
            {
              eventType: 'back_clicked',
              sectionId: 'growth_journey',
              questionId: 'B2',
              activeTimeMs: 2000,
              inactiveTimeMs: 0,
              wallTimeMs: 2000,
            },
          ],
        }),
      }
    );
    assert.equal(tel1Res.status, 200);

    // Second submission + different active duration on A1 for median check
    const sub2Res = await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'submit',
        answers: buildCompleteAnswers({
          contact: { email: 'second@example.com', fullName: 'Tunde S.' },
        }),
        durationMinutes: 5,
      }),
    });
    const sub2Data = (await sub2Res.json()) as {
      record: { id: string };
      accessToken: string;
    };

    await fetch(`${ctx.baseUrl}/api/submissions/${sub2Data.record.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: sub2Data.accessToken, // Simulates sendBeacon body auth
        events: [
          {
            eventType: 'continue_clicked',
            sectionId: 'professional_style',
            questionId: 'A1',
            activeTimeMs: 8000,
            inactiveTimeMs: 0,
            wallTimeMs: 8000,
          },
        ],
      }),
    });

    // Abandoned draft in Section A at A2
    const draftRes = await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'draft',
        answers: {
          selections: { A1: 'A1-A' },
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
        },
        durationMinutes: 1,
      }),
    });
    const draftData = (await draftRes.json()) as {
      record: { id: string };
      accessToken: string;
    };

    // Simulate sendBeacon abandonment event
    await fetch(`${ctx.baseUrl}/api/submissions/${draftData.record.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: draftData.accessToken,
        events: [
          { eventType: 'section_entered', sectionId: 'professional_style' },
          {
            eventType: 'question_displayed',
            sectionId: 'professional_style',
            questionId: 'A2',
          },
          {
            eventType: 'assessment_abandoned',
            sectionId: 'professional_style',
            questionId: 'A2',
            activeTimeMs: 5000,
            inactiveTimeMs: 10000,
          },
        ],
      }),
    });

    const analyticsRes = await fetch(`${ctx.baseUrl}/api/admin/analytics`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(analyticsRes.status, 200);
    const { summary } = (await analyticsRes.json()) as {
      summary: {
        questionAnalytics: {
          questions: Array<{
            questionId: string;
            avgActiveTimeSeconds: number | null;
            medianActiveTimeSeconds: number | null;
            avgInactiveTimeSeconds: number | null;
            changesCount: number;
            backClicksCount: number;
            abandonmentsCount: number;
          }>;
          longestActiveQuestions: Array<{ questionId: string }>;
          shortestActiveQuestions: Array<{ questionId: string }>;
          sectionDropOff: Array<{
            sectionId: string;
            enteredCount: number;
            completedCount: number;
            dropOffCount: number;
          }>;
          totalAbandonedSessions: number;
          timingNote: string;
        };
      };
    };

    const q1 = summary.questionAnalytics.questions.find(
      (q) => q.questionId === 'A1'
    );
    assert.ok(q1);
    // Samples: 4s and 8s -> avg = 6s, median = 6s; tab inactive avg = 60s kept separate
    assert.equal(q1.avgActiveTimeSeconds, 6);
    assert.equal(q1.medianActiveTimeSeconds, 6);
    assert.equal(q1.avgInactiveTimeSeconds, 60);
    assert.equal(q1.changesCount, 1);

    const q2 = summary.questionAnalytics.questions.find(
      (q) => q.questionId === 'A2'
    );
    assert.ok(q2);
    assert.equal(q2.abandonmentsCount, 1);

    const b2 = summary.questionAnalytics.questions.find(
      (q) => q.questionId === 'B2'
    );
    assert.ok(b2);
    assert.equal(b2.backClicksCount, 1);

    // B1 had 12s active vs B2 had 2s active
    assert.equal(
      summary.questionAnalytics.longestActiveQuestions[0].questionId,
      'B1'
    );
    assert.equal(
      summary.questionAnalytics.shortestActiveQuestions[0].questionId,
      'B2'
    );
    assert.match(summary.questionAnalytics.timingNote, /difficulty/i);
    assert.equal(summary.questionAnalytics.totalAbandonedSessions, 1);

    const secA = summary.questionAnalytics.sectionDropOff.find(
      (s) => s.sectionId === 'professional_style'
    );
    assert.ok(secA);
    assert.equal(secA.enteredCount, 3);
    assert.equal(secA.completedCount, 2);
    assert.equal(secA.dropOffCount, 1);
  } finally {
    await ctx.close();
  }
});

test('Full attribution, unknown/direct fallback, and real campaign cost per completion', async () => {
  const ctx = await createStage6Context();
  try {
    const adminCookie = await loginAs(ctx.baseUrl, 'admin-stage6-pass');

    // Submit 2 records for a meta campaign with adSet/creative/placement, and 1 with empty attribution
    const s1 = await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'submit',
        answers: buildCompleteAnswers(),
        attribution: {
          utmSource: 'meta',
          utmMedium: 'paid_social',
          utmCampaign: 'jan2027_launch',
          adSet: 'lagos_creatives_22_30',
          creative: 'reel_storyteller_v2',
          placement: 'instagram_reels',
          referrer: 'https://l.instagram.com/',
        },
        durationMinutes: 4,
      }),
    });
    const d1 = (await s1.json()) as { record: { id: string } };

    await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'submit',
        answers: buildCompleteAnswers({
          selections: { D7: 'D7-C' },
          contact: { email: 'two@example.com' },
        }),
        attribution: {
          utmSource: 'meta',
          utmMedium: 'paid_social',
          utmCampaign: 'jan2027_launch',
          adSet: 'lagos_creatives_22_30',
          creative: 'reel_storyteller_v2',
          placement: 'instagram_reels',
        },
        durationMinutes: 5,
      }),
    });

    await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'submit',
        answers: buildCompleteAnswers({
          contact: { email: 'direct@example.com' },
        }),
        attribution: {},
        durationMinutes: 5,
      }),
    });

    // Mark first submission as scheduled consultation conversion
    await fetch(`${ctx.baseUrl}/api/admin/consultations/${d1.record.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ consultationStatus: 'scheduled' }),
    });

    // Before recording spend, costPerCompletion must be null (no fabricated cost data)
    const beforeRes = await fetch(`${ctx.baseUrl}/api/admin/analytics`, {
      headers: { Cookie: adminCookie },
    });
    const beforeData = (await beforeRes.json()) as {
      summary: {
        consultationRequestRatePct: number | null;
        consultationConversionOutcomes: {
          scheduledCount: number;
          completedCount: number;
        };
        campaignPerformance: Array<{
          utmSource: string;
          utmCampaign: string;
          adSet: string;
          creative: string;
          placement: string;
          completionsCount: number;
          costPerCompletion: number | null;
          conversionOutcomesCount: number;
        }>;
      };
    };

    const metaRowBefore = beforeData.summary.campaignPerformance.find(
      (c) => c.utmSource === 'meta'
    );
    assert.ok(metaRowBefore);
    assert.equal(metaRowBefore.adSet, 'lagos_creatives_22_30');
    assert.equal(metaRowBefore.creative, 'reel_storyteller_v2');
    assert.equal(metaRowBefore.placement, 'instagram_reels');
    assert.equal(metaRowBefore.costPerCompletion, null);
    assert.equal(metaRowBefore.conversionOutcomesCount, 1);

    const directRow = beforeData.summary.campaignPerformance.find(
      (c) => c.utmSource === 'unknown/direct'
    );
    assert.ok(directRow);
    assert.equal(directRow.utmCampaign, 'unknown/direct');

    // Now log real campaign spend: 50000 NGN -> 2 completions => 25000 NGN per completion
    const costPutRes = await fetch(`${ctx.baseUrl}/api/admin/campaign-costs`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        utmSource: 'meta',
        utmCampaign: 'jan2027_launch',
        currency: 'NGN',
        amountSpent: 50000,
      }),
    });
    assert.equal(costPutRes.status, 200);

    const afterRes = await fetch(`${ctx.baseUrl}/api/admin/analytics`, {
      headers: { Cookie: adminCookie },
    });
    const afterData = (await afterRes.json()) as typeof beforeData;
    const metaRowAfter = afterData.summary.campaignPerformance.find(
      (c) => c.utmSource === 'meta'
    );
    assert.ok(metaRowAfter);
    assert.equal(metaRowAfter.costPerCompletion, 25000);
    assert.equal(
      afterData.summary.consultationConversionOutcomes.scheduledCount,
      1
    );
    assert.equal(afterData.summary.consultationRequestRatePct, 67);
  } finally {
    await ctx.close();
  }
});

test('Immutable assessment versioning preserves historical submission snapshots and versions', async () => {
  const ctx = await createStage6Context();
  try {
    const adminCookie = await loginAs(ctx.baseUrl, 'admin-stage6-pass');
    const advisorCookie = await loginAs(ctx.baseUrl, 'advisor-stage6-pass');

    // Historical submission under baseline version
    const histRes = await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'submit',
        answers: buildCompleteAnswers(),
        durationMinutes: 5,
      }),
    });
    const histData = (await histRes.json()) as { record: { id: string } };

    // Advisor cannot create a new assessment version (admin only)
    const advisorDeny = await fetch(`${ctx.baseUrl}/api/admin/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: advisorCookie,
      },
      body: JSON.stringify({
        versionId: 'kws-v3.1',
        label: 'Test',
        changeSummary: 'Test',
        questions: ASSESSMENT_QUESTIONS,
      }),
    });
    assert.equal(advisorDeny.status, 403);

    // Admin creates & activates new immutable version
    const editedQuestions = ASSESSMENT_QUESTIONS.map((q) =>
      q.id === 'D8'
        ? { ...q, prompt: 'Updated: Where did you discover KWS Academy?' }
        : q
    );
    const verCreate = await fetch(`${ctx.baseUrl}/api/admin/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        versionId: 'kws-assessment-v3.1',
        label: 'Revised Prompt v3.1',
        changeSummary: 'Clarified discovery question wording.',
        questions: editedQuestions,
        activateImmediately: true,
      }),
    });
    assert.equal(verCreate.status, 201);

    // Duplicate version ID rejected so existing versions stay immutable
    const dupRes = await fetch(`${ctx.baseUrl}/api/admin/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        versionId: 'kws-assessment-v3.1',
        label: 'Overwrite Attempt',
        changeSummary: 'Should fail',
        questions: editedQuestions,
      }),
    });
    assert.equal(dupRes.status, 409);

    // Public config now serves kws-assessment-v3.1
    const cfgRes = await fetch(`${ctx.baseUrl}/api/assessment/config`);
    const cfgData = (await cfgRes.json()) as {
      assessmentVersion: string;
      questions: Array<{ id: string; prompt: string }>;
    };
    assert.equal(cfgData.assessmentVersion, 'kws-assessment-v3.1');
    assert.equal(
      cfgData.questions.find((q) => q.id === 'D8')?.prompt,
      'Updated: Where did you discover KWS Academy?'
    );

    // Historical submission still retains its baseline version
    const detailRes = await fetch(
      `${ctx.baseUrl}/api/admin/submissions/${histData.record.id}`,
      { headers: { Cookie: adminCookie } }
    );
    const { record: histRecord } = (await detailRes.json()) as {
      record: {
        assessmentVersion: string;
        assessmentSnapshot: { assessmentVersion: string };
      };
    };
    assert.equal(histRecord.assessmentVersion, 'kws-assessment-v3.0');
    assert.equal(
      histRecord.assessmentSnapshot.assessmentVersion,
      'kws-assessment-v3.0'
    );
  } finally {
    await ctx.close();
  }
});

test('Email workflow, Official WhatsApp permission rules + mandatory review gate, and CRM readiness', async () => {
  const ctx = await createStage6Context();
  const capturedCalls: Array<{
    path: string;
    headers: http.IncomingHttpHeaders;
    rawBody: string;
  }> = [];

  const mockWebhookServer = http.createServer((req, res) => {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
    });
    req.on('end', () => {
      capturedCalls.push({
        path: req.url || '/',
        headers: req.headers,
        rawBody,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise<void>((resolve) =>
    mockWebhookServer.listen(0, '127.0.0.1', () => resolve())
  );
  const webhookPort = (mockWebhookServer.address() as AddressInfo).port;
  const webhookBase = `http://127.0.0.1:${webhookPort}`;

  try {
    const adminCookie = await loginAs(ctx.baseUrl, 'admin-stage6-pass');

    // 1. Create 3 submissions covering: book+consent, more_info+consent, none+consent
    const createSub = async (
      name: string,
      prefOpt: 'D7-A' | 'D7-B' | 'D7-C',
      whatsappConsent = true
    ) => {
      const r = await fetch(`${ctx.baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'submit',
          answers: buildCompleteAnswers({
            selections: { D7: prefOpt },
            contact: {
              fullName: name,
              email: `${name.toLowerCase().replace(/\s+/g, '')}@example.com`,
              whatsappConsent,
            },
          }),
          durationMinutes: 4,
        }),
      });
      const d = (await r.json()) as {
        record: {
          id: string;
          result: { growthJourney: { indicativeStage: { name: string } } };
        };
      };
      assert.equal(r.status, 201);
      assert.ok(d.record.result.growthJourney.indicativeStage.name);
      return d.record.id;
    };

    const bookId = await createSub('Book User', 'D7-A', true);
    const infoId = await createSub('Info User', 'D7-B', true);
    const noneId = await createSub('None User', 'D7-C', true);

    // Wait briefly for non-blocking post-submission skipped email record
    await new Promise((r) => setTimeout(r, 40));

    // When unconfigured, post-submission confirmation email records skipped_no_provider without blocking on-screen results
    const logsUnconfRes = await fetch(
      `${ctx.baseUrl}/api/admin/communications?submissionId=${bookId}`,
      { headers: { Cookie: adminCookie } }
    );
    const logsUnconf = (await logsUnconfRes.json()) as {
      messages: Array<{ messageType: string; status: string }>;
    };
    assert.ok(
      logsUnconf.messages.some(
        (m) =>
          m.messageType === 'submission_confirmation' &&
          m.status === 'skipped_no_provider'
      )
    );

    // 2. Sending WhatsApp WITHOUT confirmedReview=true MUST be rejected (400)
    const unreviewedRes = await fetch(
      `${ctx.baseUrl}/api/admin/communications/whatsapp/send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          submissionIds: [bookId, infoId, noneId],
          templateType: 'programme_info',
          confirmedReview: false,
        }),
      }
    );
    assert.equal(unreviewedRes.status, 400);

    // 3. Preview WhatsApp for cohort_reminder -> ONLY 'book' is eligible; 'more_info' and 'none' are blocked!
    const previewRes = await fetch(
      `${ctx.baseUrl}/api/admin/communications/whatsapp/preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          submissionIds: [bookId, infoId, noneId],
          templateType: 'cohort_reminder',
          customMessage: 'Hi {{name}}, following up for {{stage}}.',
        }),
      }
    );
    assert.equal(previewRes.status, 200);
    const previewData = (await previewRes.json()) as {
      previews: Array<{
        submissionId: string;
        eligible: boolean;
        blockedReason: string | null;
        resolvedMessage: string;
      }>;
      summary: { total: number; eligible: number; blocked: number };
    };
    assert.equal(previewData.summary.total, 3);
    assert.equal(previewData.summary.eligible, 1);
    assert.equal(previewData.summary.blocked, 2);

    const bookPreview = previewData.previews.find(
      (p) => p.submissionId === bookId
    );
    const infoPreview = previewData.previews.find(
      (p) => p.submissionId === infoId
    );
    const nonePreview = previewData.previews.find(
      (p) => p.submissionId === noneId
    );
    assert.equal(bookPreview?.eligible, true);
    assert.match(bookPreview?.resolvedMessage ?? '', /Hi Book,/);
    assert.equal(infoPreview?.eligible, false);
    assert.match(infoPreview?.blockedReason ?? '', /information only/i);
    assert.equal(nonePreview?.eligible, false);

    // 4. Configure email, WhatsApp, and signed CRM webhook providers pointing to local mock server
    process.env.KWS_EMAIL_PROVIDER = 'webhook';
    process.env.KWS_EMAIL_WEBHOOK_URL = `${webhookBase}/email`;
    process.env.KWS_EMAIL_RESULTS_ENABLED = 'true';
    process.env.KWS_WHATSAPP_PROVIDER = 'webhook';
    process.env.KWS_WHATSAPP_WEBHOOK_URL = `${webhookBase}/whatsapp`;
    process.env.KWS_CRM_WEBHOOK_URL = `${webhookBase}/crm`;
    process.env.KWS_CRM_WEBHOOK_SECRET = 'crm-hmac-secret';

    // Confirmed WhatsApp send: dispatches ONLY eligible lead (bookId), blocks infoId & noneId
    const sendWaRes = await fetch(
      `${ctx.baseUrl}/api/admin/communications/whatsapp/send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          submissionIds: [bookId, infoId, noneId],
          templateType: 'cohort_reminder',
          confirmedReview: true,
        }),
      }
    );
    assert.equal(sendWaRes.status, 200);
    const sendWaData = (await sendWaRes.json()) as {
      sentCount: number;
      blockedCount: number;
      messages: Array<{ id: string; submissionId: string; status: string }>;
    };
    assert.equal(sendWaData.sentCount, 1);
    assert.equal(sendWaData.blockedCount, 2);

    const sentMsg = sendWaData.messages.find((m) => m.submissionId === bookId);
    assert.ok(sentMsg);
    assert.equal(sentMsg.status, 'sent');

    // Update delivery status to 'replied'
    const statusRes = await fetch(
      `${ctx.baseUrl}/api/admin/communications/${sentMsg.id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ status: 'replied' }),
      }
    );
    assert.equal(statusRes.status, 200);
    const updatedMsg = (await statusRes.json()) as {
      message: { status: string };
    };
    assert.equal(updatedMsg.message.status, 'replied');

    // 5. Integrations readiness & CRM sync checks
    const intRes = await fetch(`${ctx.baseUrl}/api/admin/integrations`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(intRes.status, 200);
    const intData = (await intRes.json()) as {
      integrations: Array<{ id: string; configured: boolean }>;
    };
    assert.equal(
      intData.integrations.find((i) => i.id === 'email')?.configured,
      true
    );
    assert.equal(
      intData.integrations.find((i) => i.id === 'whatsapp')?.configured,
      true
    );
    assert.equal(
      intData.integrations.find((i) => i.id === 'mailchimp')?.configured,
      false
    );
    assert.equal(
      intData.integrations.find((i) => i.id === 'crm_webhook')?.configured,
      true
    );

    // Mailchimp MUST block 'more_info' respondent even before checking Mailchimp API keys
    const mcBlockedRes = await fetch(
      `${ctx.baseUrl}/api/admin/integrations/mailchimp/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ submissionId: infoId }),
      }
    );
    assert.equal(mcBlockedRes.status, 200);
    const mcBlocked = (await mcBlockedRes.json()) as {
      syncEvent: { status: string };
    };
    assert.equal(mcBlocked.syncEvent.status, 'blocked_permission');

    // Mailchimp reports not_configured honestly for 'book' lead when API key missing
    const mcUnconfRes = await fetch(
      `${ctx.baseUrl}/api/admin/integrations/mailchimp/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ submissionId: bookId }),
      }
    );
    const mcUnconf = (await mcUnconfRes.json()) as {
      syncEvent: { status: string };
    };
    assert.equal(mcUnconf.syncEvent.status, 'not_configured');

    // CRM Webhook signs payload with HMAC-SHA256 and dispatches cleanly
    const crmSyncRes = await fetch(
      `${ctx.baseUrl}/api/admin/integrations/crm_webhook/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ submissionId: bookId }),
      }
    );
    const crmSync = (await crmSyncRes.json()) as {
      syncEvent: { status: string };
    };
    assert.equal(crmSync.syncEvent.status, 'synced');

    const crmCall = capturedCalls.find((c) => c.path === '/crm');
    assert.ok(crmCall);
    const expectedSig = crypto
      .createHmac('sha256', 'crm-hmac-secret')
      .update(crmCall.rawBody)
      .digest('hex');
    assert.equal(crmCall.headers['x-kws-signature'], expectedSig);
  } finally {
    await new Promise<void>((resolve) =>
      mockWebhookServer.close(() => resolve())
    );
    await ctx.close();
  }
});

test('Dynamic question deactivation, Part A scoring matrix API, and Lead Segmentation rules engine', async () => {
  const ctx = await createStage6Context();
  try {
    const adminCookie = await loginAs(ctx.baseUrl, 'admin-stage6-pass');

    // 1. Deactivate A9 in a new active version -> public config hides it cleanly
    const deactivatedQuestions = ASSESSMENT_QUESTIONS.map((q) =>
      q.id === 'A9' ? { ...q, active: false } : q
    );
    const vRes = await fetch(`${ctx.baseUrl}/api/admin/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        versionId: 'kws-v3-deactivated-a9',
        label: 'Test Deactivation',
        changeSummary: 'Deactivated A9',
        questions: deactivatedQuestions,
        activateImmediately: true,
      }),
    });
    assert.equal(vRes.status, 201);

    const cfgAfterDeact = await fetch(`${ctx.baseUrl}/api/assessment/config`);
    const cfgAfterJson = (await cfgAfterDeact.json()) as {
      questions: Array<{ id: string }>;
      stepsCount: number;
    };
    assert.equal(cfgAfterJson.questions.length, 34);
    assert.equal(cfgAfterJson.stepsCount, 28);
    assert.equal(
      cfgAfterJson.questions.some((q) => q.id === 'A9'),
      false
    );

    // Submitting without deactivated A9 succeeds cleanly under active version validation
    const baseWithoutA9 = buildCompleteAnswers({
      selections: {
        D3: 'D3-D',
        D5: 'D5-A',
        D7: 'D7-A',
      },
      contact: { email: 'deact-ok@example.com', fullName: 'Seyi Deact' },
    });
    delete baseWithoutA9.selections.A9;
    const subNoA9 = await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'submit',
        answers: baseWithoutA9,
        durationMinutes: 4,
      }),
    });
    assert.equal(subNoA9.status, 201);
    const subNoA9Data = (await subNoA9.json()) as {
      record: { id: string; result: { professionalStyle: { status: string } } };
      accessToken: string;
    };
    // Because segmentation is still unapproved, reviewCategory stays 'unreviewed'
    const adminSub1 = await fetch(
      `${ctx.baseUrl}/api/admin/submissions/${subNoA9Data.record.id}`,
      { headers: { Cookie: adminCookie } }
    );
    const adminSub1Json = (await adminSub1.json()) as {
      record: {
        consultation: { reviewCategory: string; autoCategorized?: boolean };
      };
    };
    assert.equal(adminSub1Json.record.consultation.reviewCategory, 'unreviewed');
    assert.equal(
      Boolean(adminSub1Json.record.consultation.autoCategorized),
      false
    );

    // 2. Part A Scoring Config API rejects approving incomplete mapping (400)
    const scoringGet = await fetch(`${ctx.baseUrl}/api/admin/configs/scoring`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(scoringGet.status, 200);
    const { config: currentScoring } = (await scoringGet.json()) as {
      config: {
        approved: boolean;
        notes: string;
        optionToStyle: Record<string, string | null>;
      };
    };
    const badApprove = await fetch(`${ctx.baseUrl}/api/admin/configs/scoring`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        ...currentScoring,
        approved: true,
        optionToStyle: {
          ...currentScoring.optionToStyle,
          'A1-A': null,
        },
      }),
    });
    assert.equal(badApprove.status, 400);

    // Populate all active orientation options & approve Part A scoring
    const styleCycle = [
      'STORYTELLER',
      'STRATEGIST',
      'CREATOR',
      'CONNECTOR',
      'EXECUTOR',
      'OPPORTUNITY_BUILDER',
    ];
    const mapped: Record<string, string> = {};
    for (const q of deactivatedQuestions.filter(
      (item) => item.kind === 'orientation' && item.active !== false
    )) {
      q.options.forEach((opt, idx) => {
        mapped[opt.id] = styleCycle[idx % styleCycle.length];
      });
    }
    const goodApprove = await fetch(`${ctx.baseUrl}/api/admin/configs/scoring`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        approved: true,
        notes: 'Approved in test',
        optionToStyle: mapped,
      }),
    });
    assert.equal(goodApprove.status, 200);

    // 3. Lead Segmentation Rules API: configure & approve rule + preserve manual staff override
    // Create a manually reviewed record first
    const manualSubRes = await fetch(`${ctx.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'submit',
        answers: baseWithoutA9,
        durationMinutes: 5,
      }),
    });
    const manualSubData = (await manualSubRes.json()) as {
      record: {
        id: string;
        result: {
          professionalStyle: { status: string; styleScores: unknown[] };
        };
      };
    };
    // Part A matrix is now approved -> complete style calculated with 6 aggregate style counts
    assert.equal(manualSubData.record.result.professionalStyle.status, 'complete');
    assert.equal(
      manualSubData.record.result.professionalStyle.styleScores.length,
      6
    );

    await fetch(
      `${ctx.baseUrl}/api/admin/consultations/${manualSubData.record.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ reviewCategory: 'future_opportunity' }),
      }
    );

    // Approve segmentation rule: High Priority (D3-D) + Financially Ready (D5-A) + Yes Consultation (D7-A) -> priority_consultation
    const segSaveRes = await fetch(
      `${ctx.baseUrl}/api/admin/configs/segmentation`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          approved: true,
          version: 'seg-v1',
          notes: 'Approved test segmentation policy',
          defaultCategory: 'market_insight',
          rules: [
            {
              id: 'rule_priority',
              label: 'High Intent Priority Lead',
              enabled: true,
              targetCategory: 'priority_consultation',
              priorityRank: 1,
              conditions: {
                D3: ['D3-D'],
                D5: ['D5-A'],
                D7: ['D7-A'],
              },
            },
          ],
        }),
      }
    );
    assert.equal(segSaveRes.status, 200);

    // Re-apply segmentation to unreviewed records -> updates subNoA9Data, skips manually reviewed manualSubData
    const applyRes = await fetch(
      `${ctx.baseUrl}/api/admin/segmentation/apply`,
      {
        method: 'POST',
        headers: { Cookie: adminCookie },
      }
    );
    assert.equal(applyRes.status, 200);
    const applyJson = (await applyRes.json()) as {
      updatedCount: number;
      skippedManualCount: number;
    };
    assert.equal(applyJson.updatedCount, 1);
    assert.equal(applyJson.skippedManualCount, 1);

    const autoChecked = await fetch(
      `${ctx.baseUrl}/api/admin/submissions/${subNoA9Data.record.id}`,
      { headers: { Cookie: adminCookie } }
    );
    const autoJson = (await autoChecked.json()) as {
      record: {
        consultation: {
          reviewCategory: string;
          autoCategorized?: boolean;
          matchedRuleLabel?: string;
        };
      };
    };
    assert.equal(
      autoJson.record.consultation.reviewCategory,
      'priority_consultation'
    );
    assert.equal(autoJson.record.consultation.autoCategorized, true);
    assert.equal(
      autoJson.record.consultation.matchedRuleLabel,
      'High Intent Priority Lead'
    );

    // Manual override remained untouched!
    const manualChecked = await fetch(
      `${ctx.baseUrl}/api/admin/submissions/${manualSubData.record.id}`,
      { headers: { Cookie: adminCookie } }
    );
    const manualJson = (await manualChecked.json()) as {
      record: {
        consultation: { reviewCategory: string; autoCategorized?: boolean };
      };
    };
    assert.equal(
      manualJson.record.consultation.reviewCategory,
      'future_opportunity'
    );
    assert.equal(
      Boolean(manualJson.record.consultation.autoCategorized),
      false
    );

    // Public respondent view MUST NEVER leak segmentation or review category
    const publicCheck = await fetch(
      `${ctx.baseUrl}/api/submissions/${subNoA9Data.record.id}`,
      { headers: { 'X-Submission-Token': subNoA9Data.accessToken } }
    );
    const publicText = await publicCheck.text();
    assert.ok(!publicText.includes('priority_consultation'));
    assert.ok(!publicText.includes('High Intent Priority Lead'));
    assert.ok(!publicText.includes('autoCategorized'));
  } finally {
    await ctx.close();
  }
});
