import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../server/app.ts';
import { SqliteAssessmentRepository } from '../server/storage.ts';
import { formatPublicShareSummary } from '../src/components/respondent/ResultsView.tsx';
import {
  ASSESSMENT_QUESTIONS,
  CAPABILITY_PILLARS,
} from '../src/domain/assessmentContent.ts';
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

const STAGE_LETTERS = ['', 'A', 'B', 'C', 'D', 'E'] as const;

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
      B1: 'B1-C',
      B2: 'B2-C',
      B3: 'B3-C',
      B4: 'B4-C',
      B5: 'B5-C',
      B6: 'B6-C',
      'C1-U': 'C1-U-C',
      'C1-E': 'C1-E-D',
      'C2-U': 'C2-U-D',
      'C2-E': 'C2-E-C',
      'C3-U': 'C3-U-B',
      'C3-E': 'C3-E-C',
      'C4-U': 'C4-U-D',
      'C4-E': 'C4-E-B',
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
      D7: 'D7-C',
      D8: 'D8-F',
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
    assessmentVersion: 'kws-assessment-v3.0',
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
  tieAnswers.selections.A1 = 'A1-B'; // Creator
  tieAnswers.selections.A2 = 'A2-A'; // Connector
  tieAnswers.selections.A3 = 'A3-A'; // Creator
  tieAnswers.selections.A4 = 'A4-B'; // Storyteller
  tieAnswers.selections.A5 = 'A5-B'; // Storyteller
  tieAnswers.selections.A6 = 'A6-D'; // Storyteller
  tieAnswers.selections.A7 = 'A7-C'; // Storyteller
  tieAnswers.selections.A8 = 'A8-A'; // Creator
  tieAnswers.selections.A9 = 'A9-B'; // Creator
  const tieResult = scoreAssessment(tieAnswers);
  assert.equal(tieResult.professionalStyle.pattern, 'co_leading');
  const tieHero = buildHeroStyleHeadline(tieResult.professionalStyle);
  assert.equal(tieHero.eyebrow, 'Dual Leading Orientation');
  assert.ok(tieHero.primaryTitle.includes('&'));

  // Broad 3-way tie: 3 Storyteller, 3 Strategist, 3 Creator
  const broadAnswers = buildStyleAnswers('STORYTELLER');
  broadAnswers.selections.A1 = 'A1-B'; // Creator
  broadAnswers.selections.A2 = 'A2-C'; // Strategist
  broadAnswers.selections.A3 = 'A3-D'; // Strategist
  broadAnswers.selections.A4 = 'A4-B'; // Storyteller
  broadAnswers.selections.A5 = 'A5-B'; // Storyteller
  broadAnswers.selections.A6 = 'A6-D'; // Storyteller
  broadAnswers.selections.A7 = 'A7-A'; // Strategist
  broadAnswers.selections.A8 = 'A8-A'; // Creator
  broadAnswers.selections.A9 = 'A9-B'; // Creator
  const broadResult = scoreAssessment(broadAnswers);
  assert.equal(broadResult.professionalStyle.pattern, 'broad');
  const broadHero = buildHeroStyleHeadline(broadResult.professionalStyle);
  assert.equal(broadHero.primaryTitle, 'BROAD SPECTRUM');
});

test('Results Discovery: Growth stages 1-5 and mixed-stage observation work cleanly', () => {
  for (const level of [1, 2, 3, 4, 5] as const) {
    const letter = STAGE_LETTERS[level];
    const answers = buildStyleAnswers('STRATEGIST');
    answers.selections.B1 = `B1-${letter}`;
    answers.selections.B2 = `B2-${letter}`;
    answers.selections.B3 = `B3-${letter}`;
    answers.selections.B4 = `B4-${letter}`;
    const record = toPublicRecord(answers);
    const card = buildShareCardPayload(record);
    assert.equal(card.stageNumber, level);
    assert.equal(card.mixedStage, false);
    assert.ok(card.stageLabel.startsWith(`Stage ${level} of 5`));
  }

  // Mixed stage
  const mixed = buildStyleAnswers('CREATOR');
  mixed.selections.B1 = 'B1-A';
  mixed.selections.B2 = 'B2-B';
  mixed.selections.B3 = 'B3-D';
  mixed.selections.B4 = 'B4-D';
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
    'C1-U': 'C1-U-A',
    'C1-E': 'C1-E-A',
    'C2-U': 'C2-U-A',
    'C2-E': 'C2-E-A',
    'C3-U': 'C3-U-A',
    'C3-E': 'C3-E-A',
    'C4-U': 'C4-U-A',
    'C4-E': 'C4-E-A',
    'C5-U': 'C5-U-B',
    'C5-E': 'C5-E-A',
    'C6-U': 'C6-U-A',
    'C6-E': 'C6-E-A',
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
    { option: 'D7-A', expected: 'book', wants: true },
    { option: 'D7-B', expected: 'more_info', wants: true },
    { option: 'D7-C', expected: 'none', wants: false },
  ];

  for (const item of mapping) {
    const answers = buildStyleAnswers('OPPORTUNITY_BUILDER');
    answers.selections.D7 = item.option;
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
    answers.selections.D7 = 'D7-A';

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
      'D7-A',
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
  const reducedMotionSection =
    cssSrc.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';
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
