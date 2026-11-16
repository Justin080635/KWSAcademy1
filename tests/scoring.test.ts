import assert from 'node:assert/strict';
import test from 'node:test';
import { ASSESSMENT_QUESTIONS, CAPABILITY_PILLARS } from '../src/domain/assessmentContent.ts';
import {
  roundGrowthMean,
  scoreAssessment,
  scorePartAProfessionalStyle,
  scorePartBGrowthJourney,
  scorePartCCapabilities,
} from '../src/domain/scoring.ts';
import {
  DEFAULT_PART_A_SCORING_CONFIG,
  PART_C_UNDERSTANDING_CORRECT_OPTIONS,
  validatePartAScoringConfig,
  type PartAScoringConfig,
} from '../src/domain/scoringConfig.ts';
import type { RespondentAnswers, StyleId } from '../src/domain/types.ts';

function buildBaseAnswers(): RespondentAnswers {
  return {
    selections: {
      style_q01: 'style_q01_opt_1',
      style_q02: 'style_q02_opt_1',
      style_q03: 'style_q03_opt_1',
      style_q04: 'style_q04_opt_1',
      style_q05: 'style_q05_opt_1',
      style_q06: 'style_q06_opt_1',
      style_q07: 'style_q07_opt_1',
      style_q08: 'style_q08_opt_1',
      style_q09: 'style_q09_opt_1',
      growth_q01: 'growth_q01_stage_2',
      growth_q02: 'growth_q02_stage_2',
      growth_q03: 'growth_q03_stage_2',
      growth_q04: 'growth_q04_stage_2',
      growth_q05: 'growth_q05_foundations',
      growth_q06: 'growth_q06_foundations',
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
      profile_q01: 'profile_q01_employed',
      profile_q02: 'profile_q02_experience',
      profile_q03: 'profile_q03_important',
      profile_q04: 'profile_q04_yes',
      profile_q05: 'profile_q05_consider',
      profile_q06: 'profile_q06_considering',
      profile_q07: 'profile_q07_no',
      profile_q08: 'profile_q08_referral',
    },
    otherText: {},
    contact: {
      fullName: 'Adaeze Okafor',
      whatsappNumber: '+2348012345678',
      email: 'adaeze@example.com',
      city: 'Lagos',
      state: 'Lagos',
      institution: '',
      whatsappConsent: true,
    },
  };
}

function buildApprovedTestPartAConfig(): PartAScoringConfig {
  const optionStyles: StyleId[] = [
    'STORYTELLER',
    'STRATEGIST',
    'CREATOR',
    'CONNECTOR',
    'EXECUTOR',
    'OPPORTUNITY_BUILDER',
  ];

  const optionToStyle: Record<string, StyleId | null> = {};
  for (const q of ASSESSMENT_QUESTIONS.filter((item) => item.kind === 'orientation')) {
    q.options.forEach((opt, index) => {
      optionToStyle[opt.id] = optionStyles[index] ?? null;
    });
  }

  return {
    approved: true,
    notes: 'Explicitly approved synthetic test fixture matrix',
    optionToStyle,
  };
}

test('Part A configuration defaults to incomplete and never fabricates style results', () => {
  const validation = validatePartAScoringConfig(DEFAULT_PART_A_SCORING_CONFIG);
  assert.equal(validation.valid, false);
  assert.equal(validation.approved, false);
  assert.ok(validation.missingOptionIds.length > 0);

  const answers = buildBaseAnswers();
  const result = scorePartAProfessionalStyle(answers);
  assert.equal(result.status, 'incomplete_configuration');
  assert.equal(result.pattern, null);
  assert.deepEqual(result.leadingStyles, []);
  assert.equal(result.secondaryStyle, null);
  assert.deepEqual(result.styleScores, []);
  assert.ok(result.missingOptionIds.length > 0);
});

test('Part A configuration rejects partial mapping missing even a single option', () => {
  const partial = buildApprovedTestPartAConfig();
  const firstKey = Object.keys(partial.optionToStyle)[0];
  partial.optionToStyle[firstKey] = null;

  const validation = validatePartAScoringConfig(partial);
  assert.equal(validation.valid, false);
  assert.deepEqual(validation.missingOptionIds, [firstKey]);

  const result = scorePartAProfessionalStyle(buildBaseAnswers(), partial);
  assert.equal(result.status, 'incomplete_configuration');
  assert.deepEqual(result.styleScores, []);
});

test('Part A handles ties (co-leading 2-way tie and 3-way broad tie)', () => {
  const config = buildApprovedTestPartAConfig();

  // 2-way tie across 9 questions: 4 Storyteller (q01-q04 opt_1), 4 Strategist (q05-q08 opt_2), 1 Creator (q09 opt_3)
  const twoWayTie = buildBaseAnswers();
  for (let i = 5; i <= 8; i += 1) {
    const qId = `style_q${String(i).padStart(2, '0')}`;
    twoWayTie.selections[qId] = `${qId}_opt_2`;
  }
  twoWayTie.selections.style_q09 = 'style_q09_opt_3';
  const tieResult = scorePartAProfessionalStyle(twoWayTie, config);
  assert.equal(tieResult.status, 'complete');
  assert.equal(tieResult.pattern, 'co_leading');
  assert.equal(tieResult.leadingStyles.length, 2);
  assert.deepEqual(
    tieResult.leadingStyles.map((s) => s.styleId),
    ['STORYTELLER', 'STRATEGIST']
  );

  // 3-way tie across 9 questions: 3 Storyteller, 3 Strategist, 3 Creator
  const threeWayTie = buildBaseAnswers();
  for (let i = 4; i <= 6; i += 1) {
    const qId = `style_q${String(i).padStart(2, '0')}`;
    threeWayTie.selections[qId] = `${qId}_opt_2`;
  }
  for (let i = 7; i <= 9; i += 1) {
    const qId = `style_q${String(i).padStart(2, '0')}`;
    threeWayTie.selections[qId] = `${qId}_opt_3`;
  }
  const broadResult = scorePartAProfessionalStyle(threeWayTie, config);
  assert.equal(broadResult.status, 'complete');
  assert.equal(broadResult.pattern, 'broad');
  assert.equal(broadResult.leadingStyles.length, 3);
  assert.equal(broadResult.secondaryStyle, null);
});

test('Part A handles dominant, blend, and closely clustered profiles', () => {
  const config = buildApprovedTestPartAConfig();

  // Dominant across 9 questions: 7 Storyteller, 2 Strategist
  const dominant = buildBaseAnswers();
  dominant.selections.style_q08 = 'style_q08_opt_2';
  dominant.selections.style_q09 = 'style_q09_opt_2';
  const dominantResult = scorePartAProfessionalStyle(dominant, config);
  assert.equal(dominantResult.pattern, 'dominant');
  assert.equal(dominantResult.leadingStyles[0]?.styleId, 'STORYTELLER');
  assert.equal(dominantResult.secondaryStyle?.styleId, 'STRATEGIST');

  // Blend across 9 questions: 5 Storyteller, 4 Strategist
  const blend = buildBaseAnswers();
  for (let i = 6; i <= 9; i += 1) {
    const qId = `style_q${String(i).padStart(2, '0')}`;
    blend.selections[qId] = `${qId}_opt_2`;
  }
  const blendResult = scorePartAProfessionalStyle(blend, config);
  assert.equal(blendResult.pattern, 'blend');
  assert.equal(blendResult.leadingStyles[0]?.styleId, 'STORYTELLER');
  assert.equal(blendResult.secondaryStyle?.styleId, 'STRATEGIST');

  // Clustered across 9 questions: 3 Storyteller, 2 Strategist, 2 Creator, 2 Connector (4 styles within 1 point of top)
  const clustered = buildBaseAnswers();
  for (let i = 4; i <= 5; i += 1) {
    const qId = `style_q${String(i).padStart(2, '0')}`;
    clustered.selections[qId] = `${qId}_opt_2`;
  }
  for (let i = 6; i <= 7; i += 1) {
    const qId = `style_q${String(i).padStart(2, '0')}`;
    clustered.selections[qId] = `${qId}_opt_3`;
  }
  clustered.selections.style_q08 = 'style_q08_opt_4';
  clustered.selections.style_q09 = 'style_q09_opt_4';
  const clusteredResult = scorePartAProfessionalStyle(clustered, config);
  assert.equal(clusteredResult.pattern, 'clustered');
  assert.equal(clusteredResult.leadingStyles[0]?.styleId, 'STORYTELLER');
});

test('Part B scores all 5 growth stages, half-up rounding, raw responses, and ignores Q5/Q6', () => {
  assert.equal(roundGrowthMean(1.49), 1);
  assert.equal(roundGrowthMean(1.5), 2);
  assert.equal(roundGrowthMean(2.5), 3);
  assert.equal(roundGrowthMean(3.5), 4);
  assert.equal(roundGrowthMean(4.5), 5);

  for (const stage of [1, 2, 3, 4, 5] as const) {
    const answers = buildBaseAnswers();
    answers.selections.growth_q01 = `growth_q01_stage_${stage}`;
    answers.selections.growth_q02 = `growth_q02_stage_${stage}`;
    answers.selections.growth_q03 = `growth_q03_stage_${stage}`;
    answers.selections.growth_q04 = `growth_q04_stage_${stage}`;
    // Diagnostic Q5 & Q6 deliberately point to stage 5 / stage 1 extremes
    answers.selections.growth_q05 =
      stage === 5 ? 'growth_q05_direction' : 'growth_q05_advancement';
    answers.selections.growth_q06 =
      stage === 5 ? 'growth_q06_clarity' : 'growth_q06_advancement';

    const result = scorePartBGrowthJourney(answers);
    assert.equal(result.roundedStageLevel, stage);
    assert.equal(result.indicativeStage.level, stage);
    assert.equal(result.unroundedAverage, stage);
    assert.equal(result.spread, 0);
    assert.equal(result.mixedStageFlag, false);
    assert.equal(result.rawResponses.length, 4);
    assert.deepEqual(
      result.rawResponses.map((r) => r.value),
      [stage, stage, stage, stage]
    );
  }
});

test('Part B enforces mixed-stage flag boundary (spread < 2 vs spread >= 2)', () => {
  // Spread = 1 -> false ([2, 2, 3, 3], mean = 2.5 -> rounds to stage 3)
  const spreadOne = buildBaseAnswers();
  spreadOne.selections.growth_q01 = 'growth_q01_stage_2';
  spreadOne.selections.growth_q02 = 'growth_q02_stage_2';
  spreadOne.selections.growth_q03 = 'growth_q03_stage_3';
  spreadOne.selections.growth_q04 = 'growth_q04_stage_3';
  const res1 = scorePartBGrowthJourney(spreadOne);
  assert.equal(res1.spread, 1);
  assert.equal(res1.mixedStageFlag, false);
  assert.equal(res1.unroundedAverage, 2.5);
  assert.equal(res1.roundedStageLevel, 3);

  // Spread = 2 -> true ([1, 2, 3, 3], mean = 2.25 -> rounds to stage 2)
  const spreadTwo = buildBaseAnswers();
  spreadTwo.selections.growth_q01 = 'growth_q01_stage_1';
  spreadTwo.selections.growth_q02 = 'growth_q02_stage_2';
  spreadTwo.selections.growth_q03 = 'growth_q03_stage_3';
  spreadTwo.selections.growth_q04 = 'growth_q04_stage_3';
  const res2 = scorePartBGrowthJourney(spreadTwo);
  assert.equal(res2.spread, 2);
  assert.equal(res2.mixedStageFlag, true);
  assert.equal(res2.unroundedAverage, 2.25);
  assert.equal(res2.roundedStageLevel, 2);

  // Spread = 4 -> true ([1, 1, 5, 5], mean = 3.0 -> rounds to stage 3)
  const spreadFour = buildBaseAnswers();
  spreadFour.selections.growth_q01 = 'growth_q01_stage_1';
  spreadFour.selections.growth_q02 = 'growth_q02_stage_1';
  spreadFour.selections.growth_q03 = 'growth_q03_stage_5';
  spreadFour.selections.growth_q04 = 'growth_q04_stage_5';
  const res4 = scorePartBGrowthJourney(spreadFour);
  assert.equal(res4.spread, 4);
  assert.equal(res4.mixedStageFlag, true);
  assert.equal(res4.unroundedAverage, 3);
  assert.equal(res4.roundedStageLevel, 3);
});

test('Part C verifies approved understanding keys (1:C, 2:D, 3:B, 4:D, 5:A, 6:C)', () => {
  const expectedKeyLetters = ['C', 'D', 'B', 'D', 'A', 'C'] as const;
  const letterToIndex: Record<(typeof expectedKeyLetters)[number], number> = {
    A: 0,
    B: 1,
    C: 2,
    D: 3,
  };

  CAPABILITY_PILLARS.forEach((pillar, idx) => {
    const knowledgeQ = ASSESSMENT_QUESTIONS.find(
      (q) => q.kind === 'capability_knowledge' && q.pillarId === pillar.id
    );
    assert.ok(knowledgeQ, `Missing knowledge question for ${pillar.id}`);
    const expectedLetter = expectedKeyLetters[idx];
    const expectedOpt = knowledgeQ.options[letterToIndex[expectedLetter]];
    assert.equal(
      PART_C_UNDERSTANDING_CORRECT_OPTIONS[pillar.id],
      expectedOpt.id,
      `Key mismatch on Capability ${idx + 1} (${pillar.name})`
    );
  });

  // All correct -> all understandingScore = 1
  const allCorrect = buildBaseAnswers();
  const correctResults = scorePartCCapabilities(allCorrect);
  assert.equal(correctResults.length, 6);
  for (const item of correctResults) {
    assert.equal(item.understandingScore, 1);
  }

  // All wrong -> all understandingScore = 0
  const allWrong = buildBaseAnswers();
  allWrong.selections.cap_p1_knowledge = 'cap_p1_k_copy';
  allWrong.selections.cap_p2_knowledge = 'cap_p2_k_every';
  allWrong.selections.cap_p3_knowledge = 'cap_p3_k_repeat';
  allWrong.selections.cap_p4_knowledge = 'cap_p4_k_equipment';
  allWrong.selections.cap_p5_knowledge = 'cap_p5_k_independent';
  allWrong.selections.cap_p6_knowledge = 'cap_p6_k_followers';
  const wrongResults = scorePartCCapabilities(allWrong);
  for (const item of wrongResults) {
    assert.equal(item.understandingScore, 0);
  }
});

test('Part C scores experience values A=0 through E=4 separately from understanding', () => {
  for (const level of [0, 1, 2, 3, 4] as const) {
    const answers = buildBaseAnswers();
    answers.selections.cap_p1_experience = `cap_p1_e_${level}`;
    answers.selections.cap_p2_experience = `cap_p2_e_${level}`;
    answers.selections.cap_p3_experience = `cap_p3_e_${level}`;
    answers.selections.cap_p4_experience = `cap_p4_e_${level}`;
    answers.selections.cap_p5_experience = `cap_p5_e_${level}`;
    answers.selections.cap_p6_experience = `cap_p6_e_${level}`;
    // Understanding intentionally incorrect to verify zero coupling between the two scores
    answers.selections.cap_p1_knowledge = 'cap_p1_k_copy';

    const capabilities = scorePartCCapabilities(answers);
    assert.equal(capabilities[0].understandingScore, 0);
    assert.equal(capabilities[0].experienceScore, level);
    for (const cap of capabilities) {
      assert.equal(cap.experienceScore, level);
      assert.ok(!('combinedScore' in cap));
    }
  }
});

test('Full scoreAssessment returns complete backend-ready structure with disclaimer and no fabricated Part A styles', () => {
  const full = scoreAssessment(buildBaseAnswers());
  assert.ok(full.scoringVersion);
  assert.ok(full.generatedAt);
  assert.ok(full.disclaimer.includes('reflective indicators'));
  assert.equal(full.professionalStyle.status, 'incomplete_configuration');
  assert.equal(full.growthJourney.roundedStageLevel, 2);
  assert.equal(full.capabilities.length, 6);
  assert.equal(full.developmentPriorities.length, 3);
  assert.equal(full.nextStep.wantsConsultation, false);
});
