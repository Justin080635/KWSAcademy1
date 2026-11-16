import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../server/app.ts';
import { SqliteAssessmentRepository } from '../server/storage.ts';
import { formatPublicShareSummary } from '../src/components/respondent/ResultsView.tsx';
import { ASSESSMENT_QUESTIONS, CAPABILITY_PILLARS } from '../src/domain/assessmentContent.ts';
import {
  KWS_PROGRAMME_INFO,
  MIXED_STAGE_STATEMENT,
  STYLE_PERSONAS,
  buildHeroStyleHeadline,
  buildInterestingCapabilityInsight,
  buildShareCardPayload,
  getCapabilitySignalBadge,
  selectFeaturedCapability,
} from '../src/domain/reportDiscovery.ts';
import { scoreAssessment } from '../src/domain/scoring.ts';
import { DEFAULT_PART_A_SCORING_CONFIG } from '../src/domain/scoringConfig.ts';
import type { RespondentAnswers, StyleId } from '../src/domain/types.ts';
import type { PublicRespondentRecord } from '../src/services/api.ts';

function buildStyleAnswers(targetStyle: StyleId): RespondentAnswers {
  const orientationQuestions = ASSESSMENT_QUESTIONS.filter(
    (q) => q.kind === 'orientation'
  );
  const selections: Record<string, string> = {};

  for (const q of orientationQuestions) {
    const match = q.options.find(
      (opt) => DEFAULT_PART_A_SCORING_CONFIG.optionToStyle[opt.id] === targetStyle
    );
    const fallback = q.options[0];
    selections[q.id] = match?.id ?? fallback.id;
  }

  return {
    selections: {
      ...selections,
      growth_q01: 'growth_q01_stage_3',
      growth_q02: 'growth_q02_stage_3',
      growth_q03: 'growth_q03_stage_3',
      growth_q04: 'growth_q04_stage_3',
      growth_q05: 'growth_q05_application',
      growth_q06: 'growth_q06_projects',
      cap_p1_knowledge: 'cap_p1_k_examine',
      cap_p1_experience: 'cap_p1_e_3',
      cap_p2_knowledge: 'cap_p2_k_define',
      cap_p2_experience: 'cap_p2_e_2',
      cap_p3_knowledge: 'cap_p3_k_revisit',
      cap_p3_experience: 'cap_p3_e_2',
      cap_p4_knowledge: 'cap_p4_k_clarify',
      cap_p4_experience: 'cap_p4_e_1',
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
      profile_q07: 'profile_q07_no',
      profile_q08: 'profile_q08_referral',
    },
    otherText: {},
    contact: {
      fullName: 'Chinedu Okafor',
      whatsappNumber: '+2348099887766',
      email: 'chinedu.private@example.com',
      city: 'Lagos',
      state: 'Lagos',
      institution: '',
      whatsappConsent: true,
    },
  };
}

function toPublicRecord(answers: RespondentAnswers): PublicRespondentRecord {
  const result = scoreAssessment(answers);
  const now = new Date().toISOString();
  return {
    id: 'kws_test_record_01',
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
    completionStatus: 'submitted',
    assessmentVersion: 'kws-assessment-v2.0',
    scoringVersion: result.scoringVersion,
    durationMinutes: 6,
    contact: answers.contact,
    feedback: { archetypeFits: '', stageFits: '', notes: '' },
    result,
    consultationSummary: {
      preference: result.nextStep.consultationIntent,
      status:
        result.nextStep.consultationIntent === 'none'
          ? 'awaiting_review'
          : 'requested',
      requestedAt: now,
    },
  };
}

test('Results Discovery: handles all 6 styles, co-leading ties, and broad clusters accurately', () => {
  const allStyles: StyleId[] = [
    'STORYTELLER',
    'STRATEGIST',
    'CREATOR',
    'CONNECTOR',
    'EXECUTOR',
    'OPPORTUNITY_BUILDER',
  ];

  for (const styleId of allStyles) {
    const answers = buildStyleAnswers(styleId);
    const result = scoreAssessment(answers);
    assert.equal(result.professionalStyle.status, 'complete');
    assert.equal(result.professionalStyle.leadingStyles[0]?.styleId, styleId);

    const hero = buildHeroStyleHeadline(result.professionalStyle);
    assert.equal(hero.primaryTitle, STYLE_PERSONAS[styleId].revealHeadline);
  }

  // Co-leading tie: 4 Storyteller, 4 Creator, 1 Connector
  const tieAnswers = buildStyleAnswers('STORYTELLER');
  tieAnswers.selections.style_q01 = 'style_q01_opt_3'; // Creator
  tieAnswers.selections.style_q02 = 'style_q02_opt_4'; // Connector
  tieAnswers.selections.style_q03 = 'style_q03_opt_3'; // Creator
  tieAnswers.selections.style_q08 = 'style_q08_opt_3'; // Creator
  tieAnswers.selections.style_q09 = 'style_q09_opt_3'; // Creator
  const tieResult = scoreAssessment(tieAnswers);
  assert.equal(tieResult.professionalStyle.pattern, 'co_leading');
  const tieHero = buildHeroStyleHeadline(tieResult.professionalStyle);
  assert.equal(tieHero.eyebrow, 'Dual Leading Orientation');
  assert.ok(tieHero.primaryTitle.includes('&'));

  // Broad 3-way tie
  const broadAnswers = buildStyleAnswers('STORYTELLER');
  broadAnswers.selections.style_q01 = 'style_q01_opt_3';
  broadAnswers.selections.style_q02 = 'style_q02_opt_2';
  broadAnswers.selections.style_q03 = 'style_q03_opt_2';
  broadAnswers.selections.style_q07 = 'style_q07_opt_2';
  broadAnswers.selections.style_q08 = 'style_q08_opt_3';
  broadAnswers.selections.style_q09 = 'style_q09_opt_3';
  const broadResult = scoreAssessment(broadAnswers);
  assert.equal(broadResult.professionalStyle.pattern, 'broad');
  const broadHero = buildHeroStyleHeadline(broadResult.professionalStyle);
  assert.equal(broadHero.primaryTitle, 'BROAD SPECTRUM');
});

test('Results Discovery: Growth stages 1-5 and mixed-stage observation work cleanly', () => {
  for (const level of [1, 2, 3, 4, 5] as const) {
    const answers = buildStyleAnswers('STRATEGIST');
    answers.selections.growth_q01 = `growth_q01_stage_${level}`;
    answers.selections.growth_q02 = `growth_q02_stage_${level}`;
    answers.selections.growth_q03 = `growth_q03_stage_${level}`;
    answers.selections.growth_q04 = `growth_q04_stage_${level}`;
    const record = toPublicRecord(answers);
    const card = buildShareCardPayload(record);
    assert.equal(card.stageNumber, level);
    assert.equal(card.mixedStage, false);
    assert.ok(card.stageLabel.startsWith(`Stage ${level} of 5`));
  }

  // Mixed stage
  const mixed = buildStyleAnswers('CREATOR');
  mixed.selections.growth_q01 = 'growth_q01_stage_1';
  mixed.selections.growth_q02 = 'growth_q02_stage_2';
  mixed.selections.growth_q03 = 'growth_q03_stage_4';
  mixed.selections.growth_q04 = 'growth_q04_stage_4';
  const mixedRecord = toPublicRecord(mixed);
  assert.equal(mixedRecord.result.growthJourney.mixedStageFlag, true);
  assert.ok(
    MIXED_STAGE_STATEMENT.includes('not happening at the same pace') ||
      MIXED_STAGE_STATEMENT.includes('isn’t happening at the same pace')
  );
});

test('Results Discovery: Capabilities cover high, low, understanding-ahead, and experience-ahead profiles + all 6 areas', () => {
  // All 6 capabilities always present
  const base = buildStyleAnswers('EXECUTOR');
  const baseResult = scoreAssessment(base);
  assert.equal(baseResult.capabilities.length, CAPABILITY_PILLARS.length);

  // Understanding ahead vs Experience ahead signal badges
  assert.equal(getCapabilitySignalBadge(1, 3).label, 'Proven Anchor');
  assert.equal(
    getCapabilitySignalBadge(1, 1).label,
    'Instinct Ahead of Practice'
  );
  assert.equal(getCapabilitySignalBadge(0, 4).label, 'Hands-On Momentum');
  assert.equal(getCapabilitySignalBadge(0, 0).label, 'Fresh Room to Grow');

  // Featured capability and share insight adapt to U=0, E=0 baseline gracefully
  const lowAnswers = buildStyleAnswers('CONNECTOR');
  Object.assign(lowAnswers.selections, {
    cap_p1_knowledge: 'cap_p1_k_avoid',
    cap_p1_experience: 'cap_p1_e_0',
    cap_p2_knowledge: 'cap_p2_k_ask',
    cap_p2_experience: 'cap_p2_e_0',
    cap_p3_knowledge: 'cap_p3_k_ignore',
    cap_p3_experience: 'cap_p3_e_0',
    cap_p4_knowledge: 'cap_p4_k_post',
    cap_p4_experience: 'cap_p4_e_0',
    cap_p5_knowledge: 'cap_p5_k_start',
    cap_p5_experience: 'cap_p5_e_0',
    cap_p6_knowledge: 'cap_p6_k_charge',
    cap_p6_experience: 'cap_p6_e_0',
  });
  const lowResult = scoreAssessment(lowAnswers);
  const featured = selectFeaturedCapability(lowResult);
  assert.ok(featured.name.length > 0);
  const lowInsight = buildInterestingCapabilityInsight(lowResult);
  assert.ok(lowInsight.headline.includes('Open room to grow'));
});

test('Results Discovery: Programme info matches approved copy and all 3 consultation choices work', () => {
  assert.equal(KWS_PROGRAMME_INFO.duration, '10-week programme');
  assert.equal(KWS_PROGRAMME_INFO.format, 'In-person in Ikeja, Lagos');
  assert.equal(KWS_PROGRAMME_INFO.fee, '₦1,200,000');
  assert.equal(KWS_PROGRAMME_INFO.nextCohort, 'January 2027');

  const mapping: Array<{
    option: string;
    expected: 'book' | 'more_info' | 'none';
    wants: boolean;
  }> = [
    { option: 'profile_q07_yes', expected: 'book', wants: true },
    { option: 'profile_q07_more_info', expected: 'more_info', wants: true },
    { option: 'profile_q07_no', expected: 'none', wants: false },
  ];

  for (const item of mapping) {
    const answers = buildStyleAnswers('OPPORTUNITY_BUILDER');
    answers.selections.profile_q07 = item.option;
    const result = scoreAssessment(answers);
    assert.equal(result.nextStep.consultationIntent, item.expected);
    assert.equal(result.nextStep.wantsConsultation, item.wants);
  }
});

test('Immediate Results Access (No Admin Gating) & Share Card Zero-PII Guarantee over HTTP', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kws-overhaul-test-'));
  const dbPath = path.join(tempDir, 'test.db');
  const repository = new SqliteAssessmentRepository(dbPath);
  const { app } = await createApp({ repository, enableFrontend: false });
  const server = await new Promise<import('http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const answers = buildStyleAnswers('STRATEGIST');
    answers.selections.profile_q07 = 'profile_q07_yes';

    // Submit directly with NO admin login or approval interaction whatsoever
    const submitRes = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'submit',
        durationMinutes: 5,
        answers,
      }),
    });
    assert.equal(submitRes.status, 201);
    const submitData = (await submitRes.json()) as {
      record: PublicRespondentRecord;
      accessToken: string;
    };

    assert.equal(submitData.record.completionStatus, 'submitted');
    assert.equal(submitData.record.result.professionalStyle.status, 'complete');
    assert.equal(
      submitData.record.result.professionalStyle.leadingStyles[0]?.styleId,
      'STRATEGIST'
    );

    // Immediate GET retrieval with respondent token succeeds immediately
    const getRes = await fetch(
      `${baseUrl}/api/submissions/${encodeURIComponent(submitData.record.id)}`,
      {
        headers: { 'X-Submission-Token': submitData.accessToken },
      }
    );
    assert.equal(getRes.status, 200);
    const fetched = (await getRes.json()) as { record: PublicRespondentRecord };
    assert.equal(fetched.record.id, submitData.record.id);

    // Verify Share Card Payload and plain-text Share Summary contain zero PII
    const card = buildShareCardPayload(fetched.record);
    const cardJson = JSON.stringify(card);
    const shareText = formatPublicShareSummary(fetched.record, {
      archetypeFits: 'Yes',
      stageFits: 'Yes',
      notes: 'Private admin note test should not leak into share card',
    });

    for (const secretPii of [
      answers.contact.email,
      answers.contact.whatsappNumber,
      'profile_q07_yes',
      'Private admin note test',
    ]) {
      assert.ok(
        !cardJson.includes(secretPii),
        `Share Card payload must never include PII (${secretPii})`
      );
      assert.ok(
        !shareText.includes(secretPii),
        `Public Share summary must never include PII (${secretPii})`
      );
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    repository.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Motion System: unified motion tokens, reduced-motion safeguards, and clean bundle imports', () => {
  const appSrc = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  const cssSrc = fs.readFileSync(path.resolve('src/index.css'), 'utf8');
  const motionSrc = fs.readFileSync(
    path.resolve('src/components/ui/motionPrimitives.tsx'),
    'utf8'
  );
  const questionSrc = fs.readFileSync(
    path.resolve('src/components/respondent/AssessmentQuestionView.tsx'),
    'utf8'
  );
  const capSrc = fs.readFileSync(
    path.resolve('src/components/respondent/CapabilityCardView.tsx'),
    'utf8'
  );

  // MotionConfig honors OS reduced motion globally
  assert.ok(appSrc.includes('reducedMotion="user"'));

  // CSS keyframes for shimmer, floating, ambient glow, and sheen exist AND reset inside prefers-reduced-motion
  for (const selector of [
    '.kws-shimmer-text',
    '.kws-float-slow',
    '.kws-ambient-breathe',
    '.kws-halo-pulse',
    '.kws-progress-sheen',
  ]) {
    assert.ok(cssSrc.includes(selector), `Expected CSS class ${selector}`);
  }
  const reducedMotionSection = cssSrc.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';
  assert.ok(reducedMotionSection.includes('.kws-shimmer-text'));
  assert.ok(reducedMotionSection.includes('.kws-float-slow'));
  assert.ok(reducedMotionSection.includes('.kws-progress-sheen::after'));

  // VIEWPORT_REVEAL uses mobile-safe once: true & amount: 'some'
  assert.ok(motionSrc.includes("amount: 'some'"));
  assert.ok(motionSrc.includes('once: true'));

  // Question screens & capability cards use calm smooth scroll only when scrolled past threshold (never abrupt behavior: 'auto' snap)
  assert.ok(!questionSrc.includes("behavior: 'auto' }"));
  assert.ok(!capSrc.includes("behavior: 'auto' }"));
});

