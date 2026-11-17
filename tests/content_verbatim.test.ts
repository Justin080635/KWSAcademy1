import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createApp } from '../server/app.ts';
import { SqliteAssessmentRepository } from '../server/storage.ts';
import { AssessmentQuestionView } from '../src/components/respondent/AssessmentQuestionView.tsx';
import { CapabilityCardView } from '../src/components/respondent/CapabilityCardView.tsx';
import {
  ASSESSMENT_CONTENT_VERSION,
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_SECTIONS,
  ASSESSMENT_STEPS,
  PART_D_CONDITIONAL,
} from '../src/domain/assessmentContent.ts';
import type { RespondentAnswers } from '../src/domain/types.ts';
import {
  isStepCompleteForSteps,
  stepRequiresContactDetails,
} from '../src/domain/validation.ts';

interface SpecJson {
  contentVersion: string;
  partA: {
    questions: Array<{
      id: string;
      text: string;
      options: Array<{ id: string; key: string; text: string }>;
    }>;
  };
  partB: {
    questions: Array<{
      id: string;
      text: string;
      options: Array<{ id: string; key: string; text: string }>;
    }>;
  };
  partC: {
    cards: Array<{
      id: string;
      capability: string;
      understanding: {
        text: string;
        options: Array<{ id: string; key: string; text: string }>;
      };
      experience: {
        text: string;
        options: Array<{ id: string; key: string; text: string }>;
      };
      correctUnderstandingKey: string;
    }>;
  };
  partD: {
    questions: Array<{
      id: string;
      text: string;
      options: Array<{ id: string; key: string; text: string }>;
    }>;
    conditional: {
      showIf: string;
      id: string;
      text: string;
      type: string;
    };
  };
  scoring: {
    partA_styleMap_DRAFT_PENDING_KWS_APPROVAL: Record<
      string,
      Record<string, string>
    >;
  };
}

const RAW_SPEC: SpecJson = JSON.parse(
  fs.readFileSync(path.resolve('content/assessment.json'), 'utf8')
);

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ''));
}

function extractTagText(html: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'g');
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    matches.push(stripTags(match[1]));
  }
  return matches;
}

function extractRenderedOptions(
  html: string
): Array<{ key: string; text: string }> {
  const buttonRegex =
    /<button[^>]*role="radio"[^>]*>([\s\S]*?)<\/button>/g;
  const results: Array<{ key: string; text: string }> = [];
  let btnMatch: RegExpExecArray | null;
  while ((btnMatch = buttonRegex.exec(html)) !== null) {
    const inner = btnMatch[1];
    const spanRegex = /<span[^>]*>([\s\S]*?)<\/span>/g;
    const spans: string[] = [];
    let spanMatch: RegExpExecArray | null;
    while ((spanMatch = spanRegex.exec(inner)) !== null) {
      spans.push(stripTags(spanMatch[1]));
    }
    assert.ok(
      spans.length >= 2,
      `Expected key and label spans inside radio button, got: ${inner}`
    );
    results.push({ key: spans[0], text: spans[1] });
  }
  return results;
}

function createEmptyAnswers(
  selections: Record<string, string> = {}
): RespondentAnswers {
  return {
    selections,
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
}

const NOOP = () => {};

test('1. Structural counts & ordering match content/assessment.json exactly (29 cards, 35 questions)', () => {
  assert.equal(ASSESSMENT_CONTENT_VERSION, RAW_SPEC.contentVersion);
  assert.equal(ASSESSMENT_CONTENT_VERSION, 'spec-2026-11-17');

  assert.equal(RAW_SPEC.partA.questions.length, 9);
  assert.equal(RAW_SPEC.partB.questions.length, 6);
  assert.equal(RAW_SPEC.partC.cards.length, 6);
  assert.equal(RAW_SPEC.partD.questions.length, 8);
  assert.equal(ASSESSMENT_STEPS.length, 29);
  assert.equal(ASSESSMENT_QUESTIONS.length, 35);

  // Per-part step counts
  assert.equal(
    ASSESSMENT_STEPS.filter((s) => s.sectionId === 'professional_style').length,
    9
  );
  assert.equal(
    ASSESSMENT_STEPS.filter((s) => s.sectionId === 'growth_journey').length,
    6
  );
  assert.equal(
    ASSESSMENT_STEPS.filter((s) => s.sectionId === 'strengths_growth').length,
    6
  );
  assert.equal(
    ASSESSMENT_STEPS.filter((s) => s.sectionId === 'profile_next_steps').length,
    8
  );

  // Exact option counts per question
  const partAOptionCounts = RAW_SPEC.partA.questions.map((q) => q.options.length);
  assert.deepEqual(partAOptionCounts, [4, 4, 4, 4, 4, 4, 4, 4, 4]);

  const partBOptionCounts = RAW_SPEC.partB.questions.map((q) => q.options.length);
  assert.deepEqual(partBOptionCounts, [5, 5, 5, 5, 7, 6]);

  for (const card of RAW_SPEC.partC.cards) {
    assert.equal(card.understanding.options.length, 4);
    assert.equal(card.experience.options.length, 5);
  }

  const partDOptionCounts = RAW_SPEC.partD.questions.map((q) => q.options.length);
  assert.deepEqual(partDOptionCounts, [8, 8, 5, 5, 5, 5, 3, 8]);
});

test('2. Every one of all 29 rendered cards matches content/assessment.json character-for-character via React SSR', () => {
  // Part A: Cards 1..9 (steps 0..8)
  RAW_SPEC.partA.questions.forEach((specQ, idx) => {
    const html = renderToStaticMarkup(
      React.createElement(AssessmentQuestionView, {
        stepIndex: idx,
        answers: createEmptyAnswers(),
        sections: ASSESSMENT_SECTIONS,
        steps: ASSESSMENT_STEPS,
        questions: ASSESSMENT_QUESTIONS,
        isSubmitting: false,
        submitError: null,
        onSelectOption: NOOP,
        onChangeOtherText: NOOP,
        onUpdateContact: NOOP,
        onStepChange: NOOP,
        onSubmit: NOOP,
        onExitToWelcome: NOOP,
      })
    );
    const headings = extractTagText(html, 'h1');
    assert.equal(headings.length, 1);
    assert.strictEqual(headings[0], specQ.text);

    const renderedOpts = extractRenderedOptions(html);
    assert.equal(renderedOpts.length, specQ.options.length);
    specQ.options.forEach((specOpt, optIdx) => {
      assert.strictEqual(renderedOpts[optIdx].key, specOpt.key);
      assert.strictEqual(renderedOpts[optIdx].text, specOpt.text);
    });
  });

  // Part B: Cards 10..15 (steps 9..14)
  RAW_SPEC.partB.questions.forEach((specQ, idx) => {
    const stepIndex = 9 + idx;
    const html = renderToStaticMarkup(
      React.createElement(AssessmentQuestionView, {
        stepIndex,
        answers: createEmptyAnswers(),
        sections: ASSESSMENT_SECTIONS,
        steps: ASSESSMENT_STEPS,
        questions: ASSESSMENT_QUESTIONS,
        isSubmitting: false,
        submitError: null,
        onSelectOption: NOOP,
        onChangeOtherText: NOOP,
        onUpdateContact: NOOP,
        onStepChange: NOOP,
        onSubmit: NOOP,
        onExitToWelcome: NOOP,
      })
    );
    const headings = extractTagText(html, 'h1');
    assert.equal(headings.length, 1);
    assert.strictEqual(headings[0], specQ.text);

    const renderedOpts = extractRenderedOptions(html);
    assert.equal(renderedOpts.length, specQ.options.length);
    specQ.options.forEach((specOpt, optIdx) => {
      assert.strictEqual(renderedOpts[optIdx].key, specOpt.key);
      assert.strictEqual(renderedOpts[optIdx].text, specOpt.text);
    });
  });

  // Part C: Cards 16..21 (steps 15..20), verifying both Understanding and Experience sub-steps
  RAW_SPEC.partC.cards.forEach((specCard, idx) => {
    const step = ASSESSMENT_STEPS[15 + idx];
    assert.equal(step.kind, 'capability_card');
    if (step.kind !== 'capability_card') return;

    // Understanding step (neither selected -> defaults to 'understanding')
    const uHtml = renderToStaticMarkup(
      React.createElement(CapabilityCardView, {
        card: step.card,
        totalCards: 6,
        answers: createEmptyAnswers(),
        onSelectOption: NOOP,
        onBackCard: NOOP,
        onContinueCard: NOOP,
      })
    );
    const uCardTitles = extractTagText(uHtml, 'h2');
    assert.strictEqual(uCardTitles[0], specCard.capability);
    const uPrompts = extractTagText(uHtml, 'h1');
    assert.strictEqual(uPrompts[0], specCard.understanding.text);
    const uOpts = extractRenderedOptions(uHtml);
    assert.equal(uOpts.length, specCard.understanding.options.length);
    specCard.understanding.options.forEach((specOpt, optIdx) => {
      assert.strictEqual(uOpts[optIdx].key, specOpt.key);
      assert.strictEqual(uOpts[optIdx].text, specOpt.text);
    });

    // Experience step (both selected -> renders 'experience' tab)
    const eHtml = renderToStaticMarkup(
      React.createElement(CapabilityCardView, {
        card: step.card,
        totalCards: 6,
        answers: createEmptyAnswers({
          [step.card.understandingQuestion.id]:
            specCard.understanding.options[0].id,
          [step.card.experienceQuestion.id]: specCard.experience.options[0].id,
        }),
        onSelectOption: NOOP,
        onBackCard: NOOP,
        onContinueCard: NOOP,
      })
    );
    const ePrompts = extractTagText(eHtml, 'h1');
    assert.strictEqual(ePrompts[0], specCard.experience.text);
    assert.ok(ePrompts[0].startsWith('How much experience'));
    assert.ok(!ePrompts[0].startsWith('Experience:'));

    const eOpts = extractRenderedOptions(eHtml);
    assert.equal(eOpts.length, specCard.experience.options.length);
    specCard.experience.options.forEach((specOpt, optIdx) => {
      assert.strictEqual(eOpts[optIdx].key, specOpt.key);
      assert.strictEqual(eOpts[optIdx].text, specOpt.text);
    });
  });

  // Part D: Cards 22..29 (steps 21..28)
  RAW_SPEC.partD.questions.forEach((specQ, idx) => {
    const stepIndex = 21 + idx;
    const html = renderToStaticMarkup(
      React.createElement(AssessmentQuestionView, {
        stepIndex,
        answers: createEmptyAnswers(),
        sections: ASSESSMENT_SECTIONS,
        steps: ASSESSMENT_STEPS,
        questions: ASSESSMENT_QUESTIONS,
        isSubmitting: false,
        submitError: null,
        onSelectOption: NOOP,
        onChangeOtherText: NOOP,
        onUpdateContact: NOOP,
        onStepChange: NOOP,
        onSubmit: NOOP,
        onExitToWelcome: NOOP,
      })
    );
    const headings = extractTagText(html, 'h1');
    assert.equal(headings.length, 1);
    assert.strictEqual(headings[0], specQ.text);

    const renderedOpts = extractRenderedOptions(html);
    assert.equal(renderedOpts.length, specQ.options.length);
    specQ.options.forEach((specOpt, optIdx) => {
      assert.strictEqual(renderedOpts[optIdx].key, specOpt.key);
      assert.strictEqual(renderedOpts[optIdx].text, specOpt.text);
    });
  });

  // Deliberate 1-character difference fails check (proves verifier sensitivity)
  const sampleHtml = renderToStaticMarkup(
    React.createElement(AssessmentQuestionView, {
      stepIndex: 25, // D5 with ₦1,200,000
      answers: createEmptyAnswers(),
      sections: ASSESSMENT_SECTIONS,
      steps: ASSESSMENT_STEPS,
      questions: ASSESSMENT_QUESTIONS,
      isSubmitting: false,
      submitError: null,
      onSelectOption: NOOP,
      onChangeOtherText: NOOP,
      onUpdateContact: NOOP,
      onStepChange: NOOP,
      onSubmit: NOOP,
      onExitToWelcome: NOOP,
    })
  );
  const d5Rendered = extractTagText(sampleHtml, 'h1')[0];
  assert.ok(d5Rendered.includes('₦1,200,000'));
  assert.notStrictEqual(d5Rendered, `${RAW_SPEC.partD.questions[4].text}.`);
});

test('3. Conditional D1-institution prompt & Card 29 contact fields render accurately', () => {
  assert.strictEqual(
    PART_D_CONDITIONAL.text,
    RAW_SPEC.partD.conditional.text
  );

  // D1-A (student) shows verbatim conditional prompt
  const d1AHtml = renderToStaticMarkup(
    React.createElement(AssessmentQuestionView, {
      stepIndex: 21,
      answers: createEmptyAnswers({ D1: 'D1-A' }),
      sections: ASSESSMENT_SECTIONS,
      steps: ASSESSMENT_STEPS,
      questions: ASSESSMENT_QUESTIONS,
      isSubmitting: false,
      submitError: null,
      onSelectOption: NOOP,
      onChangeOtherText: NOOP,
      onUpdateContact: NOOP,
      onStepChange: NOOP,
      onSubmit: NOOP,
      onExitToWelcome: NOOP,
    })
  );
  assert.ok(decodeHtmlEntities(d1AHtml).includes(RAW_SPEC.partD.conditional.text));
  assert.ok(d1AHtml.includes('id="kws-institution"'));

  // D1-B (graduate) shows verbatim conditional prompt
  const d1BHtml = renderToStaticMarkup(
    React.createElement(AssessmentQuestionView, {
      stepIndex: 21,
      answers: createEmptyAnswers({ D1: 'D1-B' }),
      sections: ASSESSMENT_SECTIONS,
      steps: ASSESSMENT_STEPS,
      questions: ASSESSMENT_QUESTIONS,
      isSubmitting: false,
      submitError: null,
      onSelectOption: NOOP,
      onChangeOtherText: NOOP,
      onUpdateContact: NOOP,
      onStepChange: NOOP,
      onSubmit: NOOP,
      onExitToWelcome: NOOP,
    })
  );
  assert.ok(decodeHtmlEntities(d1BHtml).includes(RAW_SPEC.partD.conditional.text));

  // D1-C hides conditional prompt
  const d1CHtml = renderToStaticMarkup(
    React.createElement(AssessmentQuestionView, {
      stepIndex: 21,
      answers: createEmptyAnswers({ D1: 'D1-C' }),
      sections: ASSESSMENT_SECTIONS,
      steps: ASSESSMENT_STEPS,
      questions: ASSESSMENT_QUESTIONS,
      isSubmitting: false,
      submitError: null,
      onSelectOption: NOOP,
      onChangeOtherText: NOOP,
      onUpdateContact: NOOP,
      onStepChange: NOOP,
      onSubmit: NOOP,
      onExitToWelcome: NOOP,
    })
  );
  assert.ok(!d1CHtml.includes('id="kws-institution"'));

  // Card 29 (stepIndex 28 -> D8) requires and renders inline contact fields
  assert.equal(stepRequiresContactDetails(28, ASSESSMENT_STEPS), true);
  assert.equal(stepRequiresContactDetails(27, ASSESSMENT_STEPS), false);

  const d8Html = renderToStaticMarkup(
    React.createElement(AssessmentQuestionView, {
      stepIndex: 28,
      answers: createEmptyAnswers({ D8: 'D8-A' }),
      sections: ASSESSMENT_SECTIONS,
      steps: ASSESSMENT_STEPS,
      questions: ASSESSMENT_QUESTIONS,
      isSubmitting: false,
      submitError: null,
      onSelectOption: NOOP,
      onChangeOtherText: NOOP,
      onUpdateContact: NOOP,
      onStepChange: NOOP,
      onSubmit: NOOP,
      onExitToWelcome: NOOP,
    })
  );
  for (const fieldId of [
    'kws-full-name',
    'kws-whatsapp',
    'kws-email',
    'kws-city',
    'kws-state',
  ]) {
    assert.ok(d8Html.includes(`id="${fieldId}"`), `Missing ${fieldId} on Card 29`);
  }

  // Card 29 cannot advance until BOTH D8 and contact fields are complete
  assert.equal(
    isStepCompleteForSteps(
      28,
      createEmptyAnswers({ D8: 'D8-A' }),
      ASSESSMENT_STEPS
    ),
    false
  );
  assert.equal(
    isStepCompleteForSteps(
      28,
      {
        selections: { D8: 'D8-A' },
        otherText: {},
        contact: {
          fullName: 'Adaeze',
          whatsappNumber: '+2348011223344',
          email: 'ada@example.com',
          city: 'Ikeja',
          state: 'Lagos',
          institution: '',
          whatsappConsent: false,
        },
      },
      ASSESSMENT_STEPS
    ),
    true
  );
});

test('4. Internal keys & scoring maps never appear in UI, assessmentContent.ts, or /api/assessment/config', async () => {
  const assessmentContentSrc = fs.readFileSync(
    path.resolve('src/domain/assessmentContent.ts'),
    'utf8'
  );
  assert.ok(!assessmentContentSrc.includes('correctUnderstandingKey'));
  assert.ok(!assessmentContentSrc.includes('partA_styleMap'));

  // Check Part A UI HTML never reveals style names in prompts or options
  for (let i = 0; i < 9; i += 1) {
    const html = renderToStaticMarkup(
      React.createElement(AssessmentQuestionView, {
        stepIndex: i,
        answers: createEmptyAnswers(),
        sections: ASSESSMENT_SECTIONS,
        steps: ASSESSMENT_STEPS,
        questions: ASSESSMENT_QUESTIONS,
        isSubmitting: false,
        submitError: null,
        onSelectOption: NOOP,
        onChangeOtherText: NOOP,
        onUpdateContact: NOOP,
        onStepChange: NOOP,
        onSubmit: NOOP,
        onExitToWelcome: NOOP,
      })
    );
    const bodyWithoutAriaHidden = html.toLowerCase();
    for (const styleLabel of [
      'opportunity_builder',
      'storyteller',
      'strategist',
      'connector',
      'executor',
    ]) {
      assert.ok(
        !bodyWithoutAriaHidden.includes(styleLabel),
        `Part A question ${i + 1} leaked internal style "${styleLabel}"`
      );
    }
  }

  // Check /api/assessment/config
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kws-verbatim-cfg-'));
  const dbPath = path.join(tempDir, 'cfg.db');
  const repository = new SqliteAssessmentRepository(dbPath);
  const { app } = await createApp({ repository, enableFrontend: false });
  const server = await new Promise<import('http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const port = (server.address() as AddressInfo).port;
    const cfgRes = await fetch(`http://127.0.0.1:${port}/api/assessment/config`);
    assert.equal(cfgRes.status, 200);
    const rawJson = await cfgRes.text();
    assert.ok(!rawJson.includes('correctUnderstandingKey'));
    assert.ok(!rawJson.includes('partA_styleMap'));
    assert.ok(!rawJson.includes('optionToStyle'));

    const parsed = JSON.parse(rawJson);
    assert.equal(parsed.contentVersion, 'spec-2026-11-17');
    assert.equal(parsed.questions.length, 35);
    assert.equal(parsed.stepsCount, 29);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    repository.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('5. Session draft version lock discards stale or unversioned drafts', () => {
  const sessionSrc = fs.readFileSync(
    path.resolve('src/state/useAssessmentSession.ts'),
    'utf8'
  );
  assert.ok(sessionSrc.includes('parsed.contentVersion !== ASSESSMENT_CONTENT_VERSION'));
  assert.ok(sessionSrc.includes('prev.contentVersion !== activeContentVersion'));
});
