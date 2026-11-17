import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../server/app.ts';
import { SqliteAssessmentRepository } from '../server/storage.ts';
import { formatPublicShareSummary } from '../src/components/respondent/ResultsView.tsx';
import { getInsightForPillar } from '../src/domain/pillarInsightEngine.ts';
import {
  MIXED_STAGE_OBSERVATION,
  selectBestInsight,
} from '../src/domain/pillarInsights.ts';
import { scoreAssessment } from '../src/domain/scoring.ts';
import {
  DEFAULT_PART_A_SCORING_CONFIG,
  type PartAScoringConfig,
} from '../src/domain/scoringConfig.ts';
import type { RespondentAnswers } from '../src/domain/types.ts';

const STAGE_LETTERS = ['', 'A', 'B', 'C', 'D', 'E'] as const;

function buildApprovedPartAConfig(): PartAScoringConfig {
  return {
    ...DEFAULT_PART_A_SCORING_CONFIG,
    approved: true,
    closeScoreThreshold: 1,
    notes: 'Approved Part A config for pillar insight tests',
    optionToStyle: { ...DEFAULT_PART_A_SCORING_CONFIG.optionToStyle },
  };
}

function buildBaseAnswers(
  overrides?: Partial<RespondentAnswers>
): RespondentAnswers {
  return {
    selections: {
      // 5 Storyteller (A4-B, A5-B, A6-D, A7-C, A8-B), 2 Strategist (A2-C, A3-D), 1 Opportunity Builder (A1-A), 1 Creator (A9-B)
      A1: 'A1-A',
      A2: 'A2-C',
      A3: 'A3-D',
      A4: 'A4-B',
      A5: 'A5-B',
      A6: 'A6-D',
      A7: 'A7-C',
      A8: 'A8-B',
      A9: 'A9-B',
      B1: 'B1-B',
      B2: 'B2-B',
      B3: 'B3-B',
      B4: 'B4-B',
      B5: 'B5-B',
      B6: 'B6-B',
      'C1-U': 'C1-U-C',
      'C1-E': 'C1-E-D',
      'C2-U': 'C2-U-D',
      'C2-E': 'C2-E-C',
      'C3-U': 'C3-U-B',
      'C3-E': 'C3-E-C',
      'C4-U': 'C4-U-D',
      'C4-E': 'C4-E-C',
      'C5-U': 'C5-U-A',
      'C5-E': 'C5-E-B',
      'C6-U': 'C6-U-C',
      'C6-E': 'C6-E-B',
      D1: 'D1-D',
      D2: 'D2-C',
      D3: 'D3-C',
      D4: 'D4-A',
      D5: 'D5-C',
      D6: 'D6-B',
      D7: 'D7-C',
      D8: 'D8-F',
      ...(overrides?.selections ?? {}),
    },
    otherText: overrides?.otherText ?? {},
    contact: {
      fullName: 'Tolu Adeyemi',
      whatsappNumber: '+2348011122233',
      email: 'tolu.private@example.com',
      city: 'Lagos',
      state: 'Lagos',
      institution: '',
      whatsappConsent: true,
      ...(overrides?.contact ?? {}),
    },
  };
}

test('Pillar 1: unapproved Part A mapping produces neutral insight with zero fabricated style claims', () => {
  const answers = buildBaseAnswers();
  const out = getInsightForPillar('professional_style', answers, {
    partAConfig: { ...DEFAULT_PART_A_SCORING_CONFIG, approved: false },
  });
  assert.equal(out.insight.insightId, 'part_a_unapproved_neutral');
  assert.equal(out.insight.previewSummary.partAConfigApproved, false);
  assert.equal(out.insight.primaryMetric.isPending, true);
  assert.equal(out.insight.primaryMetric.displayValue, '9 / 9');
  assert.ok(!out.insight.headline.includes('Storyteller'));
  assert.ok(!out.insight.message.includes('Storyteller'));
});

test('Pillar 1: approved Part A mapping selects concentrated, paired, emerging, and broad patterns', () => {
  const partAConfig = buildApprovedPartAConfig();

  // 1. Concentrated lead: 5 Storyteller, 2 Strategist, 1 Opportunity Builder, 1 Creator
  const concentrated = getInsightForPillar(
    'professional_style',
    buildBaseAnswers(),
    { partAConfig }
  );
  assert.equal(concentrated.insight.insightId, 'part_a_concentrated_lead');
  assert.ok(concentrated.insight.message.includes('Storyteller'));
  assert.equal(concentrated.insight.previewSummary.partAConfigApproved, true);
  assert.equal(concentrated.insight.primaryMetric.label, 'Storyteller');

  // 2. Two closely matched / tied: 3 Storyteller, 3 Strategist, 2 Creator, 1 Opportunity Builder
  const paired = getInsightForPillar(
    'professional_style',
    buildBaseAnswers({
      selections: {
        A1: 'A1-A', // Opportunity Builder
        A2: 'A2-C', // Strategist
        A3: 'A3-D', // Strategist
        A4: 'A4-B', // Storyteller
        A5: 'A5-B', // Storyteller
        A6: 'A6-D', // Storyteller
        A7: 'A7-A', // Strategist
        A8: 'A8-A', // Creator
        A9: 'A9-B', // Creator
      },
    }),
    { partAConfig }
  );
  assert.equal(paired.insight.insightId, 'part_a_two_closely_matched');
  assert.ok(paired.insight.message.includes('Storyteller'));
  assert.ok(paired.insight.message.includes('Strategist'));
  assert.ok(paired.insight.secondaryMetric);

  // 3. Broadly distributed: 3-way tie at top (3 Storyteller, 3 Strategist, 3 Creator)
  const broad = getInsightForPillar(
    'professional_style',
    buildBaseAnswers({
      selections: {
        A1: 'A1-B', // Creator
        A2: 'A2-C', // Strategist
        A3: 'A3-D', // Strategist
        A4: 'A4-B', // Storyteller
        A5: 'A5-B', // Storyteller
        A6: 'A6-D', // Storyteller
        A7: 'A7-A', // Strategist
        A8: 'A8-A', // Creator
        A9: 'A9-B', // Creator
      },
    }),
    { partAConfig }
  );
  assert.equal(broad.insight.insightId, 'part_a_broadly_distributed');
  assert.ok(broad.insight.message.includes('not boxed into one lane'));

  // 4. Emerging style: single leader ahead across clustered mid-tier (3 Storyteller, 2 Strategist, 2 Creator, 1 Opportunity Builder, 1 Executor)
  const emerging = getInsightForPillar(
    'professional_style',
    buildBaseAnswers({
      selections: {
        A1: 'A1-A', // Opportunity Builder
        A2: 'A2-C', // Strategist
        A3: 'A3-D', // Strategist
        A4: 'A4-B', // Storyteller
        A5: 'A5-B', // Storyteller
        A6: 'A6-D', // Storyteller
        A7: 'A7-B', // Executor
        A8: 'A8-A', // Creator
        A9: 'A9-B', // Creator
      },
    }),
    { partAConfig }
  );
  assert.equal(emerging.insight.insightId, 'part_a_emerging_style');
  assert.ok(
    emerging.insight.message.includes('Storyteller came through again and again')
  );
});

test('Pillar 2: evaluates all 5 growth stages, boundaries, and mixed-stage observation', () => {
  const stageExpectations: Array<{
    level: 1 | 2 | 3 | 4 | 5;
    phrase: string;
  }> = [
    { level: 1, phrase: 'starts with curiosity' },
    { level: 2, phrase: 'building your footing' },
    { level: 3, phrase: 'moving from learning into doing' },
    { level: 4, phrase: 'building real proof' },
    { level: 5, phrase: 'pushing past the basics' },
  ];

  for (const spec of stageExpectations) {
    const letter = STAGE_LETTERS[spec.level];
    const out = getInsightForPillar(
      'growth_journey',
      buildBaseAnswers({
        selections: {
          B1: `B1-${letter}`,
          B2: `B2-${letter}`,
          B3: `B3-${letter}`,
          B4: `B4-${letter}`,
        },
      })
    );
    assert.equal(out.insight.insightId, `part_b_stage_${spec.level}`);
    assert.ok(out.insight.headline.includes(spec.phrase));
    assert.equal(out.insight.secondaryObservation, undefined);
    assert.equal(out.insight.primaryMetric.segments, 5);
  }

  // Boundary: [1, 2, 3, 4] -> mean 2.5 -> Stage 3 + spread 3 (>= 2) triggers mixed_stage
  const mixed = getInsightForPillar(
    'growth_journey',
    buildBaseAnswers({
      selections: {
        B1: 'B1-A',
        B2: 'B2-B',
        B3: 'B3-C',
        B4: 'B4-D',
      },
    })
  );
  assert.equal(mixed.insight.insightId, 'part_b_mixed_stage');
  assert.equal(mixed.insight.primaryMetric.value, 3);
  assert.ok(
    mixed.insight.headline.includes('moving from learning into doing')
  );
  assert.equal(mixed.insight.secondaryObservation, MIXED_STAGE_OBSERVATION);
});

test('Pillar 3: capability pattern priority & strict separation of Understanding vs Practical Experience', () => {
  // 1. Strong both (1 aligned & experience >= 3)
  const strong = getInsightForPillar('strengths_growth', buildBaseAnswers());
  assert.equal(strong.insight.insightId, 'part_c_strong_both');
  assert.ok(strong.insight.message.includes('MEDIA & INDUSTRY INTELLIGENCE'));
  assert.equal(strong.insight.primaryMetric.label, 'What you know');
  assert.equal(strong.insight.secondaryMetric?.label, 'What you’ve done');
  assert.equal(strong.insight.primaryMetric.max, 6);
  assert.equal(strong.insight.secondaryMetric?.max, 24);

  // 2. Understanding ahead of Practical Experience (understanding === 1, experience <= 1, no pillar >= 3)
  const uAhead = getInsightForPillar(
    'strengths_growth',
    buildBaseAnswers({
      selections: {
        'C1-U': 'C1-U-C',
        'C1-E': 'C1-E-A',
        'C2-U': 'C2-U-A',
        'C2-E': 'C2-E-C',
        'C3-U': 'C3-U-A',
        'C3-E': 'C3-E-C',
        'C4-U': 'C4-U-A',
        'C4-E': 'C4-E-B',
        'C5-U': 'C5-U-B',
        'C5-E': 'C5-E-B',
        'C6-U': 'C6-U-A',
        'C6-E': 'C6-E-B',
      },
    })
  );
  assert.equal(uAhead.insight.insightId, 'part_c_understanding_ahead');
  assert.ok(uAhead.insight.message.includes('MEDIA & INDUSTRY INTELLIGENCE'));

  // 3. Experience ahead of Understanding (understanding === 0, experience >= 2, no aligned pillar)
  const expAhead = getInsightForPillar(
    'strengths_growth',
    buildBaseAnswers({
      selections: {
        'C1-U': 'C1-U-A',
        'C1-E': 'C1-E-E',
        'C2-U': 'C2-U-A',
        'C2-E': 'C2-E-B',
        'C3-U': 'C3-U-A',
        'C3-E': 'C3-E-B',
        'C4-U': 'C4-U-A',
        'C4-E': 'C4-E-B',
        'C5-U': 'C5-U-B',
        'C5-E': 'C5-E-B',
        'C6-U': 'C6-U-A',
        'C6-E': 'C6-E-B',
      },
    })
  );
  assert.equal(expAhead.insight.insightId, 'part_c_experience_ahead');
  assert.ok(expAhead.insight.message.includes('MEDIA & INDUSTRY INTELLIGENCE'));

  // 4. Balanced spread (understanding === 1 with exp === 2 across all pillars, spread 0 <= 1, total 12 >= 6)
  const balanced = getInsightForPillar(
    'strengths_growth',
    buildBaseAnswers({
      selections: {
        'C1-U': 'C1-U-C',
        'C1-E': 'C1-E-C',
        'C2-U': 'C2-U-D',
        'C2-E': 'C2-E-C',
        'C3-U': 'C3-U-B',
        'C3-E': 'C3-E-C',
        'C4-U': 'C4-U-D',
        'C4-E': 'C4-E-C',
        'C5-U': 'C5-U-A',
        'C5-E': 'C5-E-C',
        'C6-U': 'C6-U-C',
        'C6-E': 'C6-E-C',
      },
    })
  );
  assert.equal(balanced.insight.insightId, 'part_c_balanced_spread');

  // 5. Development opportunity (understanding === 0, experience <= 1)
  const devOpp = getInsightForPillar(
    'strengths_growth',
    buildBaseAnswers({
      selections: {
        'C1-U': 'C1-U-A',
        'C1-E': 'C1-E-A',
        'C2-U': 'C2-U-A',
        'C2-E': 'C2-E-A',
        'C3-U': 'C3-U-A',
        'C3-E': 'C3-E-B',
        'C4-U': 'C4-U-A',
        'C4-E': 'C4-E-B',
        'C5-U': 'C5-U-B',
        'C5-E': 'C5-E-B',
        'C6-U': 'C6-U-A',
        'C6-E': 'C6-E-B',
      },
    })
  );
  assert.equal(devOpp.insight.insightId, 'part_c_development_opportunity');
});

test('Pillar 4 & Fallbacks: consultation vs self-directed and missing metrics resilience', () => {
  const book = getInsightForPillar(
    'profile_next_steps',
    buildBaseAnswers({ selections: { D7: 'D7-A' } })
  );
  assert.equal(book.insight.insightId, 'part_d_consultation_requested');
  assert.equal(book.insight.headline, 'Your profile is in.');
  assert.equal(book.insight.ctaLabel, 'Reveal my profile');

  const moreInfo = getInsightForPillar(
    'profile_next_steps',
    buildBaseAnswers({ selections: { D7: 'D7-B' } })
  );
  assert.equal(moreInfo.insight.insightId, 'part_d_consultation_requested');

  const selfDir = getInsightForPillar(
    'profile_next_steps',
    buildBaseAnswers({ selections: { D7: 'D7-C' } })
  );
  assert.equal(selfDir.insight.insightId, 'part_d_self_directed');
  assert.equal(selfDir.insight.headline, 'Your profile is in.');

  // Missing metrics gracefully fall back for every pillar without throwing
  for (const pillarId of [
    'professional_style',
    'growth_journey',
    'strengths_growth',
  ] as const) {
    const fallback = selectBestInsight(pillarId, { pillarId });
    assert.equal(fallback.isFallback, true);
    assert.ok(fallback.headline.length > 0);
  }
});

test('HTTP & Report Consistency: /api/assessment/pillar-insight, admin Part A approval transition, stored result insights, and share privacy', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kws-pillar-test-'));
  const dbPath = path.join(tempDir, 'test.db');
  process.env.KWS_ADMIN_PASSCODE = 'pillar-admin-pass-123';
  process.env.KWS_SESSION_SECRET = 'pillar-test-secret-xyz';

  const repository = new SqliteAssessmentRepository(dbPath);
  const { app } = await createApp({ repository, enableFrontend: false });
  const server = await new Promise<import('http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const answers = buildBaseAnswers();

    const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'pillar-admin-pass-123' }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];

    // 1. Temporarily set Part A unapproved -> endpoint returns neutral insight without style leak
    const unapproveRes = await fetch(`${baseUrl}/api/admin/configs/scoring`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        approved: false,
        closeScoreThreshold: 1,
        notes: 'Paused for matrix edit',
        optionToStyle: {},
      }),
    });
    assert.equal(unapproveRes.status, 200);

    const preApprovalRes = await fetch(
      `${baseUrl}/api/assessment/pillar-insight`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pillarId: 'professional_style', answers }),
      }
    );
    assert.equal(preApprovalRes.status, 200);
    const preApprovalJson = (await preApprovalRes.json()) as {
      insight: { insightId: string; headline: string };
      partAConfigApproved: boolean;
    };
    assert.equal(preApprovalJson.partAConfigApproved, false);
    assert.equal(
      preApprovalJson.insight.insightId,
      'part_a_unapproved_neutral'
    );

    // 2. Admin approves Part A scoring config
    const approveRes = await fetch(`${baseUrl}/api/admin/configs/scoring`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(buildApprovedPartAConfig()),
    });
    assert.equal(approveRes.status, 200);

    // 3. Re-evaluating Pillar 1 now unlocks style insight cleanly
    const postApprovalRes = await fetch(
      `${baseUrl}/api/assessment/pillar-insight`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pillarId: 'professional_style', answers }),
      }
    );
    assert.equal(postApprovalRes.status, 200);
    const postApprovalJson = (await postApprovalRes.json()) as {
      insight: { insightId: string; message: string };
      partAConfigApproved: boolean;
    };
    assert.equal(postApprovalJson.partAConfigApproved, true);
    assert.equal(
      postApprovalJson.insight.insightId,
      'part_a_concentrated_lead'
    );
    assert.ok(postApprovalJson.insight.message.includes('Storyteller'));

    // 4. Full submission stores pillarInsights consistently with milestone insights
    const submitRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'submit', durationMinutes: 5, answers }),
    });
    assert.equal(submitRes.status, 201);
    const submitJson = (await submitRes.json()) as {
      record: {
        id: string;
        createdAt: string;
        updatedAt: string;
        submittedAt: string | null;
        completionStatus: 'submitted';
        assessmentVersion: string;
        scoringVersion: string;
        durationMinutes: number;
        contact: RespondentAnswers['contact'];
        feedback: { archetypeFits: ''; stageFits: ''; notes: '' };
        result: ReturnType<typeof scoreAssessment>;
        consultationSummary: {
          preference: 'none';
          status: 'awaiting_review';
          requestedAt: string;
        };
      };
    };

    const insights = submitJson.record.result.pillarInsights;
    assert.ok(insights);
    assert.equal(
      insights.professionalStyle.insightId,
      postApprovalJson.insight.insightId
    );
    assert.equal(insights.growthJourney.insightId, 'part_b_stage_2');
    assert.equal(insights.strengthsGrowth.insightId, 'part_c_strong_both');
    assert.equal(insights.profileNextSteps.insightId, 'part_d_self_directed');

    // 5. Public shareable summary excludes private email & WhatsApp number
    const shareText = formatPublicShareSummary(
      submitJson.record as never,
      submitJson.record.feedback
    );
    assert.ok(!shareText.includes(answers.contact.email));
    assert.ok(!shareText.includes(answers.contact.whatsappNumber));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    repository.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
