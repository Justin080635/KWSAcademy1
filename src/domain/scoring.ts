import {
  ASSESSMENT_CONTENT_VERSION,
  ASSESSMENT_QUESTIONS,
  CAPABILITY_PILLARS,
  PROFESSIONAL_STYLES,
  QUESTION_MAP,
  STAGE_MAP,
  STYLE_MAP,
} from './assessmentContent.ts';
import { buildAllPillarInsightsFromResults } from './pillarInsights.ts';
import {
  DEFAULT_PART_A_SCORING_CONFIG,
  PART_B_OPTION_VALUES,
  PART_B_SCORED_QUESTION_IDS,
  PART_C_EXPERIENCE_VALUES,
  PART_C_UNDERSTANDING_CORRECT_OPTIONS,
  validatePartAScoringConfig,
  type PartAScoringConfig,
} from './scoringConfig.ts';
import {
  validateContactDetails,
  validateAllAnswers,
  isQuestionComplete,
  isStepCompleteForSteps,
  isStepComplete,
  stepRequiresContactDetails,
} from './validation.ts';
import type {
  ArchetypePattern,
  AssessmentOption,
  AssessmentQuestion,
  AssessmentResult,
  CapabilityResultItem,
  DevelopmentPriorityItem,
  GrowthJourneyResult,
  GrowthRawResponse,
  GrowthStageLevel,
  NextStepResult,
  ProfessionalStyleResult,
  RespondentAnswers,
  StyleDetailPayload,
  StyleId,
  StyleScoreItem,
  SubmissionRecord,
} from './types.ts';

export {
  validateContactDetails,
  validateAllAnswers,
  isQuestionComplete,
  isStepCompleteForSteps,
  isStepComplete,
  stepRequiresContactDetails,
};

export const CONTENT_VERSION = ASSESSMENT_CONTENT_VERSION;
export const ASSESSMENT_VERSION = 'kws-assessment-v3.0';
export const SCORING_ENGINE_VERSION = 'kws-scoring-v3.0';
export const PART_A_CONFIG_VERSION = DEFAULT_PART_A_SCORING_CONFIG.approved
  ? 'approved-v1'
  : 'pending-approval-v1';

export const REFLECTIVE_DISCLAIMER =
  'These results reflect your answers today. They are here to spark honest reflection and conversation—never an exam score or final label.';

const EXPERIENCE_LABELS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'Haven’t started yet',
  1: 'Just starting to explore',
  2: 'Tried it on real or practice projects',
  3: 'Done this on my own',
  4: 'Part of my regular work',
};

function resolveSelectedOption(
  questionId: string,
  answers: RespondentAnswers,
  questions?: AssessmentQuestion[]
): AssessmentOption | undefined {
  const question =
    questions?.find((q) => q.id === questionId) ?? QUESTION_MAP[questionId];
  if (!question) return undefined;
  const selectedOptionId = answers.selections[questionId];
  if (!selectedOptionId) return undefined;
  return question.options.find((opt) => opt.id === selectedOptionId);
}

function toStyleDetail(styleId: StyleId): StyleDetailPayload {
  const def = STYLE_MAP[styleId];
  return {
    styleId: def.id,
    name: def.name,
    tagline: def.tagline,
    description: def.description,
    likelyContributions: def.likelyContributions,
    blindSpot: def.blindSpot,
    reflectionPrompt: def.reflectionPrompt,
  };
}

export function scorePartAProfessionalStyle(
  answers: RespondentAnswers,
  config: PartAScoringConfig = DEFAULT_PART_A_SCORING_CONFIG,
  questions: AssessmentQuestion[] = ASSESSMENT_QUESTIONS
): ProfessionalStyleResult {
  const validation = validatePartAScoringConfig(config, questions);

  if (!validation.valid) {
    return {
      status: 'incomplete_configuration',
      configurationMessage:
        'Working style mapping is currently being updated. Your responses are saved intact.',
      missingOptionIds: validation.missingOptionIds,
      pattern: null,
      leadTitle: 'Profile in progress',
      summary:
        'Your responses for Part A are saved and will be reflected in your style breakdown.',
      leadingStyles: [],
      secondaryStyle: null,
      reflectionPrompt:
        'Notice which situations in Part A felt most energizing to step into.',
      styleScores: [],
    };
  }

  const counts: Record<StyleId, number> = {
    STORYTELLER: 0,
    STRATEGIST: 0,
    CREATOR: 0,
    CONNECTOR: 0,
    EXECUTOR: 0,
    OPPORTUNITY_BUILDER: 0,
  };

  const orientationQuestions = questions.filter(
    (q) => q.kind === 'orientation' && q.active !== false
  );

  for (const q of orientationQuestions) {
    const selectedOptionId = answers.selections[q.id];
    if (!selectedOptionId) continue;
    const mappedStyle = config.optionToStyle[selectedOptionId];
    if (mappedStyle) {
      counts[mappedStyle] += 1;
    }
  }

  const sorted: StyleScoreItem[] = PROFESSIONAL_STYLES.map((s) => ({
    styleId: s.id,
    name: s.name,
    count: counts[s.id],
  })).sort((a, b) => b.count - a.count);

  const topCount = sorted[0]?.count ?? 0;
  const secondCount = sorted[1]?.count ?? 0;
  const tiedAtTop = sorted.filter((s) => s.count === topCount);
  const closeThreshold = Math.max(0, config.closeScoreThreshold ?? 1);
  const isCloseProfile =
    tiedAtTop.length >= 3 ||
    (tiedAtTop.length === 1 && topCount - secondCount <= closeThreshold);

  let pattern: ArchetypePattern;
  if (tiedAtTop.length === 2) {
    pattern = 'co_leading';
  } else if (isCloseProfile) {
    pattern = 'broad';
  } else {
    pattern = 'dominant';
  }

  const first = toStyleDetail(sorted[0].styleId);
  const second = toStyleDetail(sorted[1].styleId);

  let leadTitle = first.name;
  let summary =
    sorted[1].count > 0
      ? `You lean most toward ${first.name}, with a helpful streak of ${second.name}.`
      : `You lean most toward ${first.name}.`;
  let leadingStyles: StyleDetailPayload[] = [first];
  let secondaryStyle: StyleDetailPayload | null =
    sorted[1].count > 0 ? second : null;

  if (pattern === 'co_leading') {
    leadTitle = `${first.name} & ${second.name}`;
    summary = `Your answers put ${first.name} and ${second.name} neck and neck. You switch naturally between both.`;
    leadingStyles = [first, second];
    secondaryStyle = sorted[2].count > 0 ? toStyleDetail(sorted[2].styleId) : null;
  } else if (pattern === 'broad') {
    const closeList =
      tiedAtTop.length >= 3
        ? tiedAtTop.slice(0, 3)
        : sorted
            .filter((s) => s.count >= topCount - closeThreshold && s.count > 0)
            .slice(0, 3);
    const closeNames = closeList.map((s) => s.name);
    leadTitle = 'A broad profile';
    summary =
      closeNames.length >= 2
        ? `Your scores sit close together across ${closeNames.join(', ')}—meaning you bring range across different kinds of work rather than sticking to one lane.`
        : 'Your answers spread naturally across different ways of working, giving you plenty of range.';
    leadingStyles = closeList.map((t) => toStyleDetail(t.styleId));
    secondaryStyle =
      tiedAtTop.length === 1 && sorted[1].count > 0 ? second : null;
  }

  return {
    status: 'complete',
    configurationMessage: '',
    missingOptionIds: [],
    pattern,
    leadTitle,
    summary,
    leadingStyles,
    secondaryStyle,
    reflectionPrompt: first.reflectionPrompt,
    styleScores: sorted,
  };
}

/**
 * Round half up to the nearest integer stage (e.g. 1.5 -> 2, 2.5 -> 3, 3.49 -> 3, 3.5 -> 4).
 */
export function roundGrowthMean(mean: number): GrowthStageLevel {
  const rounded = Math.floor(mean + 0.5);
  return Math.min(5, Math.max(1, rounded)) as GrowthStageLevel;
}

export function scorePartBGrowthJourney(
  answers: RespondentAnswers,
  questions?: AssessmentQuestion[]
): GrowthJourneyResult {
  const rawResponses: GrowthRawResponse[] = PART_B_SCORED_QUESTION_IDS.map(
    (questionId) => {
      const optionId = answers.selections[questionId] ?? '';
      const value = PART_B_OPTION_VALUES[optionId] ?? 1;
      return { questionId, optionId, value };
    }
  );

  const values = rawResponses.map((r) => r.value);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const unroundedAverage =
    values.length > 0 ? Math.round((sum / values.length) * 100) / 100 : 1;
  const roundedStageLevel = roundGrowthMean(unroundedAverage);
  const indicativeStage = STAGE_MAP[roundedStageLevel];
  const spread =
    values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;
  const mixedStageFlag = spread >= 2;

  const supportingPatternSummary = mixedStageFlag
    ? `You’re between stages—some parts of your work feel well ahead while others are still warming up (spanning ${Math.min(...values)} to ${Math.max(...values)} across the path).`
    : `Your answers sit closely together around the ${indicativeStage.name} stage.`;

  const challengeOption = resolveSelectedOption('B5', answers, questions);
  const progressOption = resolveSelectedOption('B6', answers, questions);

  return {
    indicativeStage,
    rawResponses,
    unroundedAverage,
    roundedStageLevel,
    spread,
    mixedStageFlag,
    supportingPatternSummary,
    suggestedProgressDirection: indicativeStage.suggestedProgressDirection,
    biggestChallengeText: challengeOption?.label ?? '',
    twelveMonthProgressText: progressOption?.label ?? '',
  };
}

function buildCapabilityInterpretation(
  name: string,
  understandingScore: 0 | 1,
  experienceScore: 0 | 1 | 2 | 3 | 4
): string {
  if (understandingScore === 1 && experienceScore >= 3) {
    return `You spotted the smart move in ${name} and you already have real hands-on mileage here. Sharing how you make decisions on real projects will sharpen your edge even more.`;
  }
  if (understandingScore === 1 && experienceScore <= 2) {
    return `Your instincts on ${name} are right on the mark—now it’s just about getting more reps in. A real brief or small side project will help build proof behind what you know.`;
  }
  if (understandingScore === 0 && experienceScore >= 3) {
    return `You’ve clearly done real work in ${name}, and the scenario offers a handy new angle to pair with it. Stepping back to look at the why behind the work can unlock another gear.`;
  }
  return `You have a fresh stretch ahead in ${name}, both in how you think about it and what you’ve tried. Picking up one core idea and trying one small exercise is a great way in.`;
}

export function scorePartCCapabilities(
  answers: RespondentAnswers,
  questions: AssessmentQuestion[] = ASSESSMENT_QUESTIONS
): CapabilityResultItem[] {
  return CAPABILITY_PILLARS.map((pillar) => {
    const knowledgeQ = questions.find(
      (q) =>
        q.kind === 'capability_knowledge' &&
        q.pillarId === pillar.id &&
        q.active !== false
    );
    const experienceQ = questions.find(
      (q) =>
        q.kind === 'capability_experience' &&
        q.pillarId === pillar.id &&
        q.active !== false
    );

    const selectedKnowledgeId = knowledgeQ
      ? answers.selections[knowledgeQ.id]
      : undefined;
    const selectedExperienceId = experienceQ
      ? answers.selections[experienceQ.id]
      : undefined;

    const correctOptionId = PART_C_UNDERSTANDING_CORRECT_OPTIONS[pillar.id];
    const understandingScore: 0 | 1 =
      selectedKnowledgeId === correctOptionId ? 1 : 0;

    const experienceScore: 0 | 1 | 2 | 3 | 4 =
      selectedExperienceId && selectedExperienceId in PART_C_EXPERIENCE_VALUES
        ? PART_C_EXPERIENCE_VALUES[selectedExperienceId]
        : 0;

    return {
      pillarId: pillar.id,
      name: pillar.name,
      understandingScore,
      experienceScore,
      experienceLabel: EXPERIENCE_LABELS[experienceScore],
      constructiveInterpretation: buildCapabilityInterpretation(
        pillar.name,
        understandingScore,
        experienceScore
      ),
    };
  });
}

function buildDevelopmentPriorities(
  growthJourney: GrowthJourneyResult,
  capabilities: CapabilityResultItem[]
): DevelopmentPriorityItem[] {
  const stagePriority: DevelopmentPriorityItem = {
    id: 'priority_stage_focus',
    title: `Right now: ${growthJourney.indicativeStage.name}`,
    explanation: `At this stage, it helps most to focus on ${growthJourney.indicativeStage.typicalPriority.toLowerCase()}`,
    practicalNextStep: growthJourney.suggestedProgressDirection,
  };

  const focusCapabilities = [...capabilities]
    .sort((a, b) => {
      if (a.experienceScore !== b.experienceScore) {
        return a.experienceScore - b.experienceScore;
      }
      return a.understandingScore - b.understandingScore;
    })
    .slice(0, 2);

  const capabilityPriorities: DevelopmentPriorityItem[] = focusCapabilities.map(
    (cap, idx) => ({
      id: `priority_cap_${idx + 1}_${cap.pillarId}`,
      title: `Build momentum in ${cap.name}`,
      explanation: cap.constructiveInterpretation,
      practicalNextStep:
        cap.experienceScore <= 1
          ? `Pick one small practice brief or short study in ${cap.name} this month.`
          : `Take one real piece of work in ${cap.name}, put it in front of a peer, and note what lands.`,
    })
  );

  return [stagePriority, ...capabilityPriorities];
}

export function buildNextStep(
  answers: RespondentAnswers,
  questions?: AssessmentQuestion[]
): NextStepResult {
  const consultationOption = resolveSelectedOption(
    'D7',
    answers,
    questions
  );
  const consultationIntent = consultationOption?.consultationIntent ?? 'none';
  const wantsConsultation =
    consultationIntent === 'book' || consultationIntent === 'more_info';

  if (consultationIntent === 'book') {
    return {
      wantsConsultation: true,
      consultationIntent,
      headline: 'You asked to talk it through',
      description:
        'We’ve noted that you’d like a conversation with KWS Academy about your profile and next steps.',
      invitationNote:
        'Meanwhile, pick one idea above that excites you and try one small step on it this month.',
    };
  }

  if (consultationIntent === 'more_info') {
    return {
      wantsConsultation: true,
      consultationIntent,
      headline: 'Happy to share more',
      description:
        'We’ve noted that you’d like more information as you weigh up what’s next.',
      invitationNote:
        'Take a look at your focus areas above and test one small idea over the next couple of weeks.',
    };
  }

  return {
    wantsConsultation: false,
    consultationIntent: 'none',
    headline: 'Want to talk it through? Totally optional.',
    description:
      'Pick one focus area above and give yourself one small, real project on it this month.',
    invitationNote:
      'If you ever feel like talking through your results with someone at KWS Academy, the door is open below.',
  };
}

export function scoreAssessment(
  answers: RespondentAnswers,
  options?: {
    partAConfig?: PartAScoringConfig;
    questions?: AssessmentQuestion[];
  }
): AssessmentResult {
  const activeQuestions = options?.questions ?? ASSESSMENT_QUESTIONS;
  const professionalStyle = scorePartAProfessionalStyle(
    answers,
    options?.partAConfig ?? DEFAULT_PART_A_SCORING_CONFIG,
    activeQuestions
  );
  const growthJourney = scorePartBGrowthJourney(answers, activeQuestions);
  const capabilities = scorePartCCapabilities(answers, activeQuestions);
  const developmentPriorities = buildDevelopmentPriorities(
    growthJourney,
    capabilities
  );
  const nextStep = buildNextStep(answers, activeQuestions);
  const pillarInsights = buildAllPillarInsightsFromResults({
    answers,
    professionalStyle,
    growthJourney,
    capabilities,
    nextStep,
    questions: activeQuestions,
  });

  return {
    scoringVersion: SCORING_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    disclaimer: REFLECTIVE_DISCLAIMER,
    professionalStyle,
    growthJourney,
    capabilities,
    developmentPriorities,
    nextStep,
    pillarInsights,
  };
}

export function formatPlainTextSummary(record: SubmissionRecord): string {
  const { answers, result, durationMinutes, feedback } = record;
  const cityState = [answers.contact.city.trim(), answers.contact.state.trim()]
    .filter(Boolean)
    .join(', ');

  const styleLine =
    result.professionalStyle.status === 'complete'
      ? result.professionalStyle.leadTitle
      : 'Style profile in progress';

  return [
    'KWS ACADEMY DISCOVERY SUMMARY',
    `Reference: ${record.id}`,
    `Name: ${answers.contact.fullName.trim()}`,
    `City & State: ${cityState}`,
    `Minutes taken: ${durationMinutes}`,
    `Professional Style: ${styleLine}`,
    `Growth Stage: ${result.growthJourney.indicativeStage.name}${
      result.growthJourney.mixedStageFlag ? ' (between stages)' : ''
    }`,
    'Strengths (What you know 0-1 / What you have done 0-4):',
    ...result.capabilities.map(
      (c) =>
        `- ${c.name}: What you know ${c.understandingScore}/1, What you have done ${c.experienceScore}/4 (${c.experienceLabel})`
    ),
    'Focus Areas:',
    ...result.developmentPriorities.map((p, i) => `${i + 1}. ${p.title}`),
    `FEEDBACK – style fits: ${feedback.archetypeFits || '-'} | stage fits: ${
      feedback.stageFits || '-'
    }`,
    `Notes: ${(feedback.notes || '').trim()}`,
  ].join('\n');
}
