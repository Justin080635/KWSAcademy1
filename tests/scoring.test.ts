import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSESSMENT_QUESTIONS,
  CAPABILITY_PILLARS,
} from '../src/domain/assessmentContent.ts';
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
import type { RespondentAnswers } from '../src/domain/types.ts';

const STAGE_LETTERS = ['', 'A', 'B', 'C', 'D', 'E'] as const;
const EXP_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

function buildBaseAnswers(): RespondentAnswers {
  return {
    selections: {
      // 6 Storyteller (A4-B, A5-B, A6-D, A7-C, A8-B, A9-C), 2 Strategist (A2-C, A3-D), 1 Opportunity Builder (A1-A)
      A1: 'A1-A',
      A2: 'A2-C',
      A3: 'A3-D',
      A4: 'A4-B',
      A5: 'A5-B',
      A6: 'A6-D',
      A7: 'A7-C',
      A8: 'A8-B',
      A9: 'A9-C',
      B1: 'B1-B',
      B2: 'B2-B',
      B3: 'B3-B',
      B4: 'B4-B',
      B5: 'B5-B',
      B6: 'B6-B',
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
      D1: 'D1-D',
      D2: 'D2-C',
      D3: 'D3-C',
      D4: 'D4-A',
      D5: 'D5-C',
      D6: 'D6-B',
      D7: 'D7-C',
      D8: 'D8-F',
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

function cloneApprovedConfig(
  overrides?: Partial<PartAScoringConfig>
): PartAScoringConfig {
  return {
    ...DEFAULT_PART_A_SCORING_CONFIG,
    ...overrides,
    optionToStyle: {
      ...DEFAULT_PART_A_SCORING_CONFIG.optionToStyle,
      ...(overrides?.optionToStyle ?? {}),
    },
  };
}

test('Default Part A config is complete, approved, and unapproved configs never fabricate style results', () => {
  const validation = validatePartAScoringConfig(DEFAULT_PART_A_SCORING_CONFIG);
  assert.equal(validation.valid, true);
  assert.equal(validation.approved, true);
  assert.equal(DEFAULT_PART_A_SCORING_CONFIG.closeScoreThreshold, 1);
  assert.deepEqual(validation.missingOptionIds, []);

  // Explicitly unapproved config stays neutral without fabricating scores
  const unapproved = cloneApprovedConfig({ approved: false });
  const unapprovedResult = scorePartAProfessionalStyle(
    buildBaseAnswers(),
    unapproved
  );
  assert.equal(unapprovedResult.status, 'incomplete_configuration');
  assert.equal(unapprovedResult.pattern, null);
  assert.deepEqual(unapprovedResult.leadingStyles, []);
  assert.equal(unapprovedResult.secondaryStyle, null);
  assert.deepEqual(unapprovedResult.styleScores, []);
});

test('Part A configuration rejects partial mapping missing even a single option', () => {
  const partial = cloneApprovedConfig();
  const firstKey = Object.keys(partial.optionToStyle)[0];
  partial.optionToStyle[firstKey] = null;

  const validation = validatePartAScoringConfig(partial);
  assert.equal(validation.valid, false);
  assert.deepEqual(validation.missingOptionIds, [firstKey]);

  const result = scorePartAProfessionalStyle(buildBaseAnswers(), partial);
  assert.equal(result.status, 'incomplete_configuration');
  assert.deepEqual(result.styleScores, []);
});

test('Part A handles dominant, co-leading 2-way tie, 3-way broad tie, and close-score broad profiles', () => {
  // 1. Dominant: 6 Storyteller, 2 Strategist, 1 Opportunity Builder
  const dominantResult = scorePartAProfessionalStyle(buildBaseAnswers());
  assert.equal(dominantResult.status, 'complete');
  assert.equal(dominantResult.pattern, 'dominant');
  assert.equal(dominantResult.leadingStyles[0]?.styleId, 'STORYTELLER');
  assert.equal(dominantResult.secondaryStyle?.styleId, 'STRATEGIST');

  // 2. Clear 2-way tie: 4 Storyteller, 4 Creator, 1 Connector -> co_leading
  const twoWayTie = buildBaseAnswers();
  twoWayTie.selections.A1 = 'A1-B'; // Creator
  twoWayTie.selections.A2 = 'A2-A'; // Connector
  twoWayTie.selections.A3 = 'A3-A'; // Creator
  twoWayTie.selections.A4 = 'A4-B'; // Storyteller
  twoWayTie.selections.A5 = 'A5-B'; // Storyteller
  twoWayTie.selections.A6 = 'A6-D'; // Storyteller
  twoWayTie.selections.A7 = 'A7-C'; // Storyteller
  twoWayTie.selections.A8 = 'A8-A'; // Creator
  twoWayTie.selections.A9 = 'A9-B'; // Creator
  const tieResult = scorePartAProfessionalStyle(twoWayTie);
  assert.equal(tieResult.pattern, 'co_leading');
  assert.deepEqual(
    tieResult.leadingStyles.map((s) => s.styleId),
    ['STORYTELLER', 'CREATOR']
  );
  assert.equal(tieResult.secondaryStyle?.styleId, 'CONNECTOR');

  // 3. Even 3-way tie: 3 Storyteller, 3 Strategist, 3 Creator -> broad
  const threeWayTie = buildBaseAnswers();
  threeWayTie.selections.A1 = 'A1-B'; // Creator
  threeWayTie.selections.A2 = 'A2-C'; // Strategist
  threeWayTie.selections.A3 = 'A3-D'; // Strategist
  threeWayTie.selections.A4 = 'A4-B'; // Storyteller
  threeWayTie.selections.A5 = 'A5-B'; // Storyteller
  threeWayTie.selections.A6 = 'A6-D'; // Storyteller
  threeWayTie.selections.A7 = 'A7-A'; // Strategist
  threeWayTie.selections.A8 = 'A8-A'; // Creator
  threeWayTie.selections.A9 = 'A9-B'; // Creator
  const threeWayResult = scorePartAProfessionalStyle(threeWayTie);
  assert.equal(threeWayResult.pattern, 'broad');
  assert.equal(threeWayResult.leadingStyles.length, 3);
  assert.equal(threeWayResult.secondaryStyle, null);

  // 4. Close cluster (top two within default closeScoreThreshold=1): 4 Opportunity Builder, 3 Strategist, 2 Executor -> broad
  const closeCluster = buildBaseAnswers();
  closeCluster.selections.A1 = 'A1-A'; // Opportunity Builder
  closeCluster.selections.A2 = 'A2-B'; // Opportunity Builder
  closeCluster.selections.A3 = 'A3-B'; // Opportunity Builder
  closeCluster.selections.A4 = 'A4-C'; // Opportunity Builder
  closeCluster.selections.A5 = 'A5-A'; // Executor
  closeCluster.selections.A6 = 'A6-B'; // Strategist
  closeCluster.selections.A7 = 'A7-A'; // Strategist
  closeCluster.selections.A8 = 'A8-D'; // Strategist
  closeCluster.selections.A9 = 'A9-A'; // Executor
  const closeResult = scorePartAProfessionalStyle(closeCluster);
  assert.equal(closeResult.pattern, 'broad');
  assert.equal(closeResult.leadTitle, 'A broad profile');
  assert.deepEqual(
    closeResult.leadingStyles.map((s) => s.styleId),
    ['OPPORTUNITY_BUILDER', 'STRATEGIST']
  );

  // Raising/lowering closeScoreThreshold to 0 treats 4 vs 3 as dominant
  const strictThresholdResult = scorePartAProfessionalStyle(
    closeCluster,
    cloneApprovedConfig({ closeScoreThreshold: 0 })
  );
  assert.equal(strictThresholdResult.pattern, 'dominant');
  assert.equal(
    strictThresholdResult.leadingStyles[0]?.styleId,
    'OPPORTUNITY_BUILDER'
  );
});

test('Part B scores all 5 growth stages, half-up rounding, raw responses, and ignores B5/B6', () => {
  assert.equal(roundGrowthMean(1.49), 1);
  assert.equal(roundGrowthMean(1.5), 2);
  assert.equal(roundGrowthMean(2.5), 3);
  assert.equal(roundGrowthMean(3.5), 4);
  assert.equal(roundGrowthMean(4.5), 5);

  for (const stage of [1, 2, 3, 4, 5] as const) {
    const letter = STAGE_LETTERS[stage];
    const answers = buildBaseAnswers();
    answers.selections.B1 = `B1-${letter}`;
    answers.selections.B2 = `B2-${letter}`;
    answers.selections.B3 = `B3-${letter}`;
    answers.selections.B4 = `B4-${letter}`;
    // Diagnostic B5 & B6 deliberately point to extremes
    answers.selections.B5 = stage === 5 ? 'B5-A' : 'B5-G';
    answers.selections.B6 = stage === 5 ? 'B6-A' : 'B6-F';

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
  spreadOne.selections.B1 = 'B1-B';
  spreadOne.selections.B2 = 'B2-B';
  spreadOne.selections.B3 = 'B3-C';
  spreadOne.selections.B4 = 'B4-C';
  const res1 = scorePartBGrowthJourney(spreadOne);
  assert.equal(res1.spread, 1);
  assert.equal(res1.mixedStageFlag, false);
  assert.equal(res1.unroundedAverage, 2.5);
  assert.equal(res1.roundedStageLevel, 3);

  // Spread = 2 -> true ([1, 2, 3, 3], mean = 2.25 -> rounds to stage 2)
  const spreadTwo = buildBaseAnswers();
  spreadTwo.selections.B1 = 'B1-A';
  spreadTwo.selections.B2 = 'B2-B';
  spreadTwo.selections.B3 = 'B3-C';
  spreadTwo.selections.B4 = 'B4-C';
  const res2 = scorePartBGrowthJourney(spreadTwo);
  assert.equal(res2.spread, 2);
  assert.equal(res2.mixedStageFlag, true);
  assert.equal(res2.unroundedAverage, 2.25);
  assert.equal(res2.roundedStageLevel, 2);

  // Spread = 4 -> true ([1, 1, 5, 5], mean = 3.0 -> rounds to stage 3)
  const spreadFour = buildBaseAnswers();
  spreadFour.selections.B1 = 'B1-A';
  spreadFour.selections.B2 = 'B2-A';
  spreadFour.selections.B3 = 'B3-E';
  spreadFour.selections.B4 = 'B4-E';
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
  allWrong.selections['C1-U'] = 'C1-U-A';
  allWrong.selections['C2-U'] = 'C2-U-A';
  allWrong.selections['C3-U'] = 'C3-U-A';
  allWrong.selections['C4-U'] = 'C4-U-A';
  allWrong.selections['C5-U'] = 'C5-U-B';
  allWrong.selections['C6-U'] = 'C6-U-A';
  const wrongResults = scorePartCCapabilities(allWrong);
  for (const item of wrongResults) {
    assert.equal(item.understandingScore, 0);
  }
});

test('Part C scores experience values A=0 through E=4 separately from understanding', () => {
  for (const level of [0, 1, 2, 3, 4] as const) {
    const expKey = EXP_LETTERS[level];
    const answers = buildBaseAnswers();
    answers.selections['C1-E'] = `C1-E-${expKey}`;
    answers.selections['C2-E'] = `C2-E-${expKey}`;
    answers.selections['C3-E'] = `C3-E-${expKey}`;
    answers.selections['C4-E'] = `C4-E-${expKey}`;
    answers.selections['C5-E'] = `C5-E-${expKey}`;
    answers.selections['C6-E'] = `C6-E-${expKey}`;
    // Understanding intentionally incorrect to verify zero coupling between the two scores
    answers.selections['C1-U'] = 'C1-U-A';

    const capabilities = scorePartCCapabilities(answers);
    assert.equal(capabilities[0].understandingScore, 0);
    assert.equal(capabilities[0].experienceScore, level);
    for (const cap of capabilities) {
      assert.equal(cap.experienceScore, level);
      assert.ok(!('combinedScore' in cap));
    }
  }
});

test('Full scoreAssessment returns instant style & stage profile and verifies 9 combinations', () => {
  const full = scoreAssessment(buildBaseAnswers());
  assert.ok(full.scoringVersion);
  assert.ok(full.generatedAt);
  assert.ok(full.disclaimer.includes('These results reflect your answers today'));
  assert.equal(full.professionalStyle.status, 'complete');
  assert.equal(full.professionalStyle.leadingStyles[0]?.styleId, 'STORYTELLER');
  assert.equal(full.growthJourney.roundedStageLevel, 2);
  assert.equal(full.capabilities.length, 6);
  assert.equal(full.developmentPriorities.length, 3);
  assert.equal(full.nextStep.wantsConsultation, false);

  const partAQuestions = ASSESSMENT_QUESTIONS.filter(
    (q) => q.kind === 'orientation'
  );

  // Combo 1: All A's (index 0 on A1-A9) -> Connector 3, Creator 2, Executor 2 -> broad (gap 1)
  const allA = buildBaseAnswers();
  for (const q of partAQuestions) {
    allA.selections[q.id] = q.options[0].id;
  }
  const allARes = scoreAssessment(allA);
  assert.equal(allARes.professionalStyle.pattern, 'broad');
  assert.equal(allARes.professionalStyle.styleScores[0]?.styleId, 'CONNECTOR');
  assert.equal(allARes.professionalStyle.styleScores[0]?.count, 3);

  // Combo 2: All B's (index 1 on A1-A9) -> Storyteller 3, Creator 2, Opportunity Builder 2 -> broad (gap 1)
  const allB = buildBaseAnswers();
  for (const q of partAQuestions) {
    allB.selections[q.id] = q.options[1].id;
  }
  const allBRes = scoreAssessment(allB);
  assert.equal(allBRes.professionalStyle.pattern, 'broad');
  assert.equal(allBRes.professionalStyle.styleScores[0]?.styleId, 'STORYTELLER');
  assert.equal(allBRes.professionalStyle.styleScores[0]?.count, 3);

  // Combo 3: Early stage (Part B all A=1, Part C C1 wrong + exp A=0)
  const early = buildBaseAnswers();
  early.selections.B1 = 'B1-A';
  early.selections.B2 = 'B2-A';
  early.selections.B3 = 'B3-A';
  early.selections.B4 = 'B4-A';
  early.selections['C1-U'] = 'C1-U-A';
  early.selections['C1-E'] = 'C1-E-A';
  const earlyRes = scoreAssessment(early);
  assert.equal(earlyRes.growthJourney.roundedStageLevel, 1);
  assert.equal(earlyRes.growthJourney.indicativeStage.name, 'Discovering');
  assert.equal(earlyRes.growthJourney.mixedStageFlag, false);

  // Combo 4: Advanced stage (Part B all E=5, Part C all correct + exp E=4)
  const advanced = buildBaseAnswers();
  advanced.selections.B1 = 'B1-E';
  advanced.selections.B2 = 'B2-E';
  advanced.selections.B3 = 'B3-E';
  advanced.selections.B4 = 'B4-E';
  advanced.selections['C1-E'] = 'C1-E-E';
  const advRes = scoreAssessment(advanced);
  assert.equal(advRes.growthJourney.roundedStageLevel, 5);
  assert.equal(advRes.growthJourney.indicativeStage.name, 'Advancing');
  assert.equal(advRes.growthJourney.mixedStageFlag, false);

  // Combo 5: Mixed stages (Part B [1, 2, 4, 5] -> avg 3.0 -> Stage 3 Applying, spread 4, mixedStageFlag true)
  const mixed = buildBaseAnswers();
  mixed.selections.B1 = 'B1-A';
  mixed.selections.B2 = 'B2-B';
  mixed.selections.B3 = 'B3-D';
  mixed.selections.B4 = 'B4-E';
  const mixedRes = scoreAssessment(mixed);
  assert.equal(mixedRes.growthJourney.roundedStageLevel, 3);
  assert.equal(mixedRes.growthJourney.indicativeStage.name, 'Applying');
  assert.equal(mixedRes.growthJourney.spread, 4);
  assert.equal(mixedRes.growthJourney.mixedStageFlag, true);
});
