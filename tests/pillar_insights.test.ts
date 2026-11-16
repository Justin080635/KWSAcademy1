import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../server/app.ts';
import { SqliteAssessmentRepository } from '../server/storage.ts';
import { ASSESSMENT_QUESTIONS } from '../src/domain/assessmentContent.ts';
import {
  MIXED_STAGE_OBSERVATION,
  selectBestInsight,
} from '../src/domain/pillarInsights.ts';
import { getInsightForPillar } from '../src/domain/pillarInsightEngine.ts';
import { scoreAssessment } from '../src/domain/scoring.ts';
import type { PartAScoringConfig } from '../src/domain/scoringConfig.ts';
import type { RespondentAnswers, StyleId } from '../src/domain/types.ts';
import { formatPublicShareSummary } from '../src/components/respondent/ResultsView.tsx';

function buildApprovedPartAConfig(): PartAScoringConfig {
  const styles: StyleId[] = [
    'STORYTELLER',
    'STRATEGIST',
    'CREATOR',
    'CONNECTOR',
    'EXECUTOR',
    'OPPORTUNITY_BUILDER',
  ];
  const optionToStyle: Record<string, StyleId | null> = {};
  for (const q of ASSESSMENT_QUESTIONS.filter((item) => item.kind === 'orientation')) {
    q.options.forEach((opt, idx) => {
      optionToStyle[opt.id] = styles[idx] ?? null;
    });
  }
  return {
    approved: true,
    notes: 'Synthetic approved Part A config for pillar insight tests',
    optionToStyle,
  };
}

function buildBaseAnswers(overrides?: Partial<RespondentAnswers>): RespondentAnswers {
  return {
    selections: {
      style_q01: 'style_q01_opt_1',
      style_q02: 'style_q02_opt_1',
      style_q03: 'style_q03_opt_1',
      style_q04: 'style_q04_opt_1',
      style_q05: 'style_q05_opt_1',
      style_q06: 'style_q06_opt_2',
      style_q07: 'style_q07_opt_2',
      style_q08: 'style_q08_opt_3',
      style_q09: 'style_q09_opt_4',
      growth_q01: 'growth_q01_stage_2',
      growth_q02: 'growth_q02_stage_2',
      growth_q03: 'growth_q03_stage_2',
      growth_q04: 'growth_q04_stage_2',
      growth_q05: 'growth_q05_foundations',
      growth_q06: 'growth_q06_foundations',
      cap_p1_knowledge: 'cap_p1_k_examine',
      cap_p1_experience: 'cap_p1_e_3',
      cap_p2_knowledge: 'cap_p2_k_define',
      cap_p2_experience: 'cap_p2_e_2',
      cap_p3_knowledge: 'cap_p3_k_revisit',
      cap_p3_experience: 'cap_p3_e_2',
      cap_p4_knowledge: 'cap_p4_k_clarify',
      cap_p4_experience: 'cap_p4_e_2',
      cap_p5_knowledge: 'cap_p5_k_coordinate',
      cap_p5_experience: 'cap_p5_e_1',
      cap_p6_knowledge: 'cap_p6_k_value_model',
      cap_p6_experience: 'cap_p6_e_1',
      profile_q01: 'profile_q01_employed',
      profile_q02: 'profile_q02_experience',
      profile_q03: 'profile_q03_important',
      profile_q04: 'profile_q04_yes',
      profile_q05: 'profile_q05_consider',
      profile_q06: 'profile_q06_considering',
      profile_q07: 'profile_q07_no',
      profile_q08: 'profile_q08_referral',
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
  const out = getInsightForPillar('professional_style', answers);
  assert.equal(out.insight.insightId, 'part_a_unapproved_neutral');
  assert.equal(out.insight.previewSummary.partAConfigApproved, false);
  assert.equal(out.insight.primaryMetric.isPending, true);
  assert.equal(out.insight.primaryMetric.displayValue, '9 / 9');
  assert.ok(!out.insight.headline.includes('Storyteller'));
  assert.ok(!out.insight.message.includes('Storyteller'));
});

test('Pillar 1: approved Part A mapping selects concentrated, paired, emerging, and broad patterns', () => {
  const partAConfig = buildApprovedPartAConfig();

  // 1. Concentrated lead: 5 Storyteller, 2 Strategist, 1 Creator, 1 Connector
  const concentrated = getInsightForPillar(
    'professional_style',
    buildBaseAnswers(),
    { partAConfig }
  );
  assert.equal(concentrated.insight.insightId, 'part_a_concentrated_lead');
  assert.ok(concentrated.insight.message.includes('Storyteller'));
  assert.equal(concentrated.insight.previewSummary.partAConfigApproved, true);
  assert.equal(concentrated.insight.primaryMetric.label, 'Storyteller');

  // 2. Two closely matched / tied: 3 Storyteller, 3 Strategist, 2 Creator, 1 Connector
  const paired = getInsightForPillar(
    'professional_style',
    buildBaseAnswers({
      selections: {
        style_q01: 'style_q01_opt_1',
        style_q02: 'style_q02_opt_1',
        style_q03: 'style_q03_opt_1',
        style_q04: 'style_q04_opt_2',
        style_q05: 'style_q05_opt_2',
        style_q06: 'style_q06_opt_2',
        style_q07: 'style_q07_opt_3',
        style_q08: 'style_q08_opt_3',
        style_q09: 'style_q09_opt_4',
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
        style_q01: 'style_q01_opt_1',
        style_q02: 'style_q02_opt_1',
        style_q03: 'style_q03_opt_1',
        style_q04: 'style_q04_opt_2',
        style_q05: 'style_q05_opt_2',
        style_q06: 'style_q06_opt_2',
        style_q07: 'style_q07_opt_3',
        style_q08: 'style_q08_opt_3',
        style_q09: 'style_q09_opt_3',
      },
    }),
    { partAConfig }
  );
  assert.equal(broad.insight.insightId, 'part_a_broadly_distributed');
  assert.ok(broad.insight.message.includes('not easily boxed into one approach'));

  // 4. Emerging style: single leader ahead across clustered mid-tier (3 Storyteller, 2 Strategist, 2 Creator, 1 Connector, 1 Executor)
  const emerging = getInsightForPillar(
    'professional_style',
    buildBaseAnswers({
      selections: {
        style_q01: 'style_q01_opt_1',
        style_q02: 'style_q02_opt_1',
        style_q03: 'style_q03_opt_1',
        style_q04: 'style_q04_opt_2',
        style_q05: 'style_q05_opt_2',
        style_q06: 'style_q06_opt_3',
        style_q07: 'style_q07_opt_3',
        style_q08: 'style_q08_opt_4',
        style_q09: 'style_q09_opt_5',
      },
    }),
    { partAConfig }
  );
  assert.equal(emerging.insight.insightId, 'part_a_emerging_style');
  assert.ok(emerging.insight.message.includes('emerging around Storyteller'));
});

test('Pillar 2: evaluates all 5 growth stages, boundaries, and mixed-stage observation', () => {
  const stageExpectations: Array<{ level: 1 | 2 | 3 | 4 | 5; phrase: string }> = [
    { level: 1, phrase: 'starts with discovery' },
    { level: 2, phrase: 'building your professional foundation' },
    { level: 3, phrase: 'moving beyond learning' },
    { level: 4, phrase: 'building evidence of what you can do' },
    { level: 5, phrase: 'thinking beyond the basics' },
  ];

  for (const spec of stageExpectations) {
    const out = getInsightForPillar(
      'growth_journey',
      buildBaseAnswers({
        selections: {
          growth_q01: `growth_q01_stage_${spec.level}`,
          growth_q02: `growth_q02_stage_${spec.level}`,
          growth_q03: `growth_q03_stage_${spec.level}`,
          growth_q04: `growth_q04_stage_${spec.level}`,
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
        growth_q01: 'growth_q01_stage_1',
        growth_q02: 'growth_q02_stage_2',
        growth_q03: 'growth_q03_stage_3',
        growth_q04: 'growth_q04_stage_4',
      },
    })
  );
  assert.equal(mixed.insight.insightId, 'part_b_mixed_stage');
  assert.equal(mixed.insight.primaryMetric.value, 3);
  assert.ok(mixed.insight.headline.includes('moving beyond learning'));
  assert.equal(mixed.insight.secondaryObservation, MIXED_STAGE_OBSERVATION);
});

test('Pillar 3: capability pattern priority & strict separation of Understanding vs Practical Experience', () => {
  // 1. Strong both (1 aligned & experience >= 3)
  const strong = getInsightForPillar('strengths_growth', buildBaseAnswers());
  assert.equal(strong.insight.insightId, 'part_c_strong_both');
  assert.ok(strong.insight.message.includes('Media & Industry Intelligence'));
  assert.equal(strong.insight.primaryMetric.label, 'Understanding');
  assert.equal(strong.insight.secondaryMetric?.label, 'Practical experience');
  assert.equal(strong.insight.primaryMetric.max, 6);
  assert.equal(strong.insight.secondaryMetric?.max, 24);

  // 2. Understanding ahead of Practical Experience (understanding === 1, experience <= 1, no pillar >= 3)
  const uAhead = getInsightForPillar(
    'strengths_growth',
    buildBaseAnswers({
      selections: {
        cap_p1_knowledge: 'cap_p1_k_examine',
        cap_p1_experience: 'cap_p1_e_0',
        cap_p2_knowledge: 'cap_p2_k_ask',
        cap_p2_experience: 'cap_p2_e_2',
        cap_p3_knowledge: 'cap_p3_k_ignore',
        cap_p3_experience: 'cap_p3_e_2',
        cap_p4_knowledge: 'cap_p4_k_post',
        cap_p4_experience: 'cap_p4_e_1',
        cap_p5_knowledge: 'cap_p5_k_start',
        cap_p5_experience: 'cap_p5_e_1',
        cap_p6_knowledge: 'cap_p6_k_charge',
        cap_p6_experience: 'cap_p6_e_1',
      },
    })
  );
  assert.equal(uAhead.insight.insightId, 'part_c_understanding_ahead');
  assert.ok(uAhead.insight.message.includes('Media & Industry Intelligence'));

  // 3. Experience ahead of Understanding (understanding === 0, experience >= 2, no aligned pillar)
  const expAhead = getInsightForPillar(
    'strengths_growth',
    buildBaseAnswers({
      selections: {
        cap_p1_knowledge: 'cap_p1_k_avoid',
        cap_p1_experience: 'cap_p1_e_4',
        cap_p2_knowledge: 'cap_p2_k_ask',
        cap_p2_experience: 'cap_p2_e_1',
        cap_p3_knowledge: 'cap_p3_k_ignore',
        cap_p3_experience: 'cap_p3_e_1',
        cap_p4_knowledge: 'cap_p4_k_post',
        cap_p4_experience: 'cap_p4_e_1',
        cap_p5_knowledge: 'cap_p5_k_start',
        cap_p5_experience: 'cap_p5_e_1',
        cap_p6_knowledge: 'cap_p6_k_charge',
        cap_p6_experience: 'cap_p6_e_1',
      },
    })
  );
  assert.equal(expAhead.insight.insightId, 'part_c_experience_ahead');
  assert.ok(expAhead.insight.message.includes('Media & Industry Intelligence'));

  // 4. Balanced spread (understanding === 1 with exp === 2 across all pillars, spread 0 <= 1, total 12 >= 6)
  const balanced = getInsightForPillar(
    'strengths_growth',
    buildBaseAnswers({
      selections: {
        cap_p1_knowledge: 'cap_p1_k_examine',
        cap_p1_experience: 'cap_p1_e_2',
        cap_p2_knowledge: 'cap_p2_k_define',
        cap_p2_experience: 'cap_p2_e_2',
        cap_p3_knowledge: 'cap_p3_k_revisit',
        cap_p3_experience: 'cap_p3_e_2',
        cap_p4_knowledge: 'cap_p4_k_clarify',
        cap_p4_experience: 'cap_p4_e_2',
        cap_p5_knowledge: 'cap_p5_k_coordinate',
        cap_p5_experience: 'cap_p5_e_2',
        cap_p6_knowledge: 'cap_p6_k_value_model',
        cap_p6_experience: 'cap_p6_e_2',
      },
    })
  );
  assert.equal(balanced.insight.insightId, 'part_c_balanced_spread');

  // 5. Development opportunity (understanding === 0, experience <= 1)
  const devOpp = getInsightForPillar(
    'strengths_growth',
    buildBaseAnswers({
      selections: {
        cap_p1_knowledge: 'cap_p1_k_avoid',
        cap_p1_experience: 'cap_p1_e_0',
        cap_p2_knowledge: 'cap_p2_k_ask',
        cap_p2_experience: 'cap_p2_e_0',
        cap_p3_knowledge: 'cap_p3_k_ignore',
        cap_p3_experience: 'cap_p3_e_1',
        cap_p4_knowledge: 'cap_p4_k_post',
        cap_p4_experience: 'cap_p4_e_1',
        cap_p5_knowledge: 'cap_p5_k_start',
        cap_p5_experience: 'cap_p5_e_1',
        cap_p6_knowledge: 'cap_p6_k_charge',
        cap_p6_experience: 'cap_p6_e_1',
      },
    })
  );
  assert.equal(devOpp.insight.insightId, 'part_c_development_opportunity');
});

test('Pillar 4 & Fallbacks: consultation vs self-directed and missing metrics resilience', () => {
  const book = getInsightForPillar(
    'profile_next_steps',
    buildBaseAnswers({ selections: { profile_q07: 'profile_q07_yes' } })
  );
  assert.equal(book.insight.insightId, 'part_d_consultation_requested');
  assert.equal(book.insight.headline, 'Your discovery is ready.');
  assert.equal(book.insight.ctaLabel, 'Reveal My Professional Discovery Report');

  const moreInfo = getInsightForPillar(
    'profile_next_steps',
    buildBaseAnswers({ selections: { profile_q07: 'profile_q07_more_info' } })
  );
  assert.equal(moreInfo.insight.insightId, 'part_d_consultation_requested');

  const selfDir = getInsightForPillar(
    'profile_next_steps',
    buildBaseAnswers({ selections: { profile_q07: 'profile_q07_no' } })
  );
  assert.equal(selfDir.insight.insightId, 'part_d_self_directed');
  assert.equal(selfDir.insight.headline, 'Your discovery is ready.');

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

    // 1. Before Part A approval: endpoint returns unapproved neutral insight without style leak
    const preApprovalRes = await fetch(`${baseUrl}/api/assessment/pillar-insight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pillarId: 'professional_style', answers }),
    });
    assert.equal(preApprovalRes.status, 200);
    const preApprovalJson = (await preApprovalRes.json()) as {
      insight: { insightId: string; headline: string };
      partAConfigApproved: boolean;
    };
    assert.equal(preApprovalJson.partAConfigApproved, false);
    assert.equal(preApprovalJson.insight.insightId, 'part_a_unapproved_neutral');

    // 2. Admin approves Part A scoring config
    const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'pillar-admin-pass-123' }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];

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
    assert.equal(postApprovalJson.insight.insightId, 'part_a_concentrated_lead');
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
    assert.equal(insights.professionalStyle.insightId, postApprovalJson.insight.insightId);
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
