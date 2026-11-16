import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_STEPS,
  CAPABILITY_PILLARS,
  PROFESSIONAL_STYLES,
  QUESTION_MAP,
  STAGE_MAP,
  STYLE_MAP,
} from './assessmentContent.ts';
import {
  DEFAULT_PART_A_SCORING_CONFIG,
  PART_B_OPTION_VALUES,
  PART_B_SCORED_QUESTION_IDS,
  PART_C_EXPERIENCE_VALUES,
  PART_C_UNDERSTANDING_CORRECT_OPTIONS,
  validatePartAScoringConfig,
  type PartAScoringConfig,
} from './scoringConfig.ts';
import type {
  ArchetypePattern,
  AssessmentOption,
  AssessmentQuestion,
  AssessmentResult,
  AssessmentStep,
  CapabilityResultItem,
  DevelopmentPriorityItem,
  GrowthJourneyResult,
  GrowthRawResponse,
  GrowthStageLevel,
  NextStepResult,
  ProfessionalStyleResult,
  RespondentAnswers,
  RespondentContact,
  StyleDetailPayload,
  StyleId,
  StyleScoreItem,
  SubmissionRecord,
} from './types.ts';

export const ASSESSMENT_VERSION = 'kws-assessment-v2.0';
export const SCORING_ENGINE_VERSION = 'kws-scoring-v3.0';
export const PART_A_CONFIG_VERSION = DEFAULT_PART_A_SCORING_CONFIG.approved
  ? 'approved-v1'
  : 'pending-approval-v1';

export const REFLECTIVE_DISCLAIMER =
  'These results are reflective indicators based on your self-reported responses. They are designed to support thoughtful self-discovery and conversation, not to serve as an exam grade, certification, psychometric diagnosis, or definitive judgment of ability.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EXPERIENCE_LABELS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'Beginning from scratch',
  1: 'Early informal exploration',
  2: 'Practice & collaborative projects',
  3: 'Independent real-world application',
  4: 'Consistent applied track record',
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

export function validateContactDetails(contact: RespondentContact): {
  valid: boolean;
  errors: Partial<Record<keyof RespondentContact, string>>;
} {
  const errors: Partial<Record<keyof RespondentContact, string>> = {};

  if (!contact.fullName.trim()) {
    errors.fullName = 'Please enter your full name.';
  }
  if (!contact.whatsappNumber.trim()) {
    errors.whatsappNumber =
      'Please enter your WhatsApp number including country code (e.g. +234...).';
  }
  if (!contact.email.trim()) {
    errors.email = 'Please enter your email address.';
  } else if (!EMAIL_PATTERN.test(contact.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!contact.city.trim()) {
    errors.city = 'Please enter your current city.';
  }
  if (!contact.state.trim()) {
    errors.state = 'Please enter your current state.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAllAnswers(
  answers: RespondentAnswers,
  questions: AssessmentQuestion[] = ASSESSMENT_QUESTIONS
): {
  valid: boolean;
  missingQuestionIds: string[];
} {
  const missingQuestionIds: string[] = [];
  const activeQuestions = questions.filter((q) => q.active !== false);

  for (const question of activeQuestions) {
    if (question.kind === 'contact_details') {
      if (!validateContactDetails(answers.contact).valid) {
        missingQuestionIds.push(question.id);
      }
      continue;
    }

    const selected = resolveSelectedOption(question.id, answers, activeQuestions);
    if (!selected) {
      missingQuestionIds.push(question.id);
      continue;
    }

    if (
      selected.requiresOtherText &&
      !(answers.otherText[question.id] ?? '').trim()
    ) {
      missingQuestionIds.push(question.id);
      continue;
    }

    if (
      selected.requiresInstitution &&
      !answers.contact.institution.trim()
    ) {
      missingQuestionIds.push(question.id);
    }
  }

  return {
    valid: missingQuestionIds.length === 0,
    missingQuestionIds,
  };
}

export function isQuestionComplete(
  questionId: string,
  answers: RespondentAnswers,
  questions?: AssessmentQuestion[]
): boolean {
  const question =
    questions?.find((q) => q.id === questionId) ?? QUESTION_MAP[questionId];
  if (!question) return false;
  if (question.active === false) return true;

  if (question.kind === 'contact_details') {
    return validateContactDetails(answers.contact).valid;
  }

  const selected = resolveSelectedOption(questionId, answers, questions);
  if (!selected) return false;

  if (
    selected.requiresOtherText &&
    !(answers.otherText[questionId] ?? '').trim()
  ) {
    return false;
  }

  if (selected.requiresInstitution && !answers.contact.institution.trim()) {
    return false;
  }

  return true;
}

export function isStepCompleteForSteps(
  stepIndex: number,
  answers: RespondentAnswers,
  steps: AssessmentStep[],
  questions?: AssessmentQuestion[]
): boolean {
  const step = steps[stepIndex];
  if (!step) return false;
  if (step.kind === 'question') {
    return isQuestionComplete(step.question.id, answers, questions);
  }
  return (
    isQuestionComplete(step.card.understandingQuestion.id, answers, questions) &&
    isQuestionComplete(step.card.experienceQuestion.id, answers, questions)
  );
}

export function isStepComplete(
  stepIndex: number,
  answers: RespondentAnswers
): boolean {
  return isStepCompleteForSteps(stepIndex, answers, ASSESSMENT_STEPS);
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
        'Professional Style scoring is pending KWS Academy’s final approved mapping of Section A options to the six professional styles. Your Section A responses have been saved intact.',
      missingOptionIds: validation.missingOptionIds,
      pattern: null,
      leadTitle: 'Pending configuration',
      summary:
        'Your responses for Section A are recorded. Style interpretation will become available once KWS Academy supplies and approves the final option-to-style mapping.',
      leadingStyles: [],
      secondaryStyle: null,
      reflectionPrompt:
        'While the final style mapping is being confirmed, consider which scenarios in Section A felt most energising to you.',
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
  const clusteredNearTop = sorted.filter((s) => s.count >= topCount - 1);

  let pattern: ArchetypePattern;
  if (tiedAtTop.length >= 3) {
    pattern = 'broad';
  } else if (tiedAtTop.length === 2) {
    pattern = 'co_leading';
  } else if (clusteredNearTop.length >= 3) {
    pattern = 'clustered';
  } else if (topCount - secondCount >= 2) {
    pattern = 'dominant';
  } else {
    pattern = 'blend';
  }

  const first = toStyleDetail(sorted[0].styleId);
  const second = toStyleDetail(sorted[1].styleId);

  let leadTitle = first.name;
  let summary = `Your responses lean most strongly towards ${first.name}.`;
  let leadingStyles: StyleDetailPayload[] = [first];
  let secondaryStyle: StyleDetailPayload | null =
    sorted[1].count > 0 ? second : null;

  if (pattern === 'co_leading') {
    leadTitle = `${first.name} & ${second.name}`;
    summary = `Your responses place ${first.name} and ${second.name} evenly as co-leading orientations.`;
    leadingStyles = [first, second];
    secondaryStyle = sorted[2].count > 0 ? toStyleDetail(sorted[2].styleId) : null;
  } else if (pattern === 'blend') {
    leadTitle = `${first.name} (with ${second.name})`;
    summary = `Your responses show a close blend of ${first.name} and ${second.name}. Both orientations are active in how you approach work.`;
    leadingStyles = [first];
    secondaryStyle = second;
  } else if (pattern === 'clustered') {
    const clusterNames = clusteredNearTop.map((c) => c.name);
    leadTitle = `${first.name} within a balanced cluster`;
    summary = `Your responses cluster closely across ${clusterNames.join(', ')}, with ${first.name} slightly ahead.`;
    leadingStyles = [first];
    secondaryStyle = second;
  } else if (pattern === 'broad') {
    leadTitle = 'A broad, multi-oriented profile';
    summary =
      'Your responses are distributed evenly across multiple orientations, suggesting adaptability across different roles rather than one narrow preference.';
    leadingStyles = tiedAtTop.slice(0, 3).map((t) => toStyleDetail(t.styleId));
    secondaryStyle = null;
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
    ? `Your responses across the four growth questions span ${spread} stage points (ranging from ${Math.min(...values)} to ${Math.max(...values)}), indicating that some areas of your experience are further along than others.`
    : `Your responses across the four growth questions are closely aligned around the ${indicativeStage.name} stage.`;

  const challengeOption = resolveSelectedOption('growth_q05', answers, questions);
  const progressOption = resolveSelectedOption('growth_q06', answers, questions);

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
    return `You selected the sound situational approach for ${name} and report independent practical experience. Continuing to reflect on real outcomes and edge cases can help sharpen your judgment further.`;
  }
  if (understandingScore === 1 && experienceScore <= 2) {
    return `Your situational choice aligns with sound practice in ${name}, while your practical exposure is still growing. Guided projects or real briefs are a natural next way to turn that clarity into hands-on confidence.`;
  }
  if (understandingScore === 0 && experienceScore >= 3) {
    return `You report meaningful hands-on experience in ${name}, while the scenario prompt points to a strategic nuance worth revisiting. Stepping back to connect day-to-day execution with underlying principles can deepen your impact.`;
  }
  return `Both foundational principles and practical exposure in ${name} represent open space to explore. Starting with a clear core concept and one small practical exercise is a constructive way to build momentum.`;
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
    title: `Growth Stage Focus: ${growthJourney.indicativeStage.name}`,
    explanation: `At the ${growthJourney.indicativeStage.name} stage, your typical priority is ${growthJourney.indicativeStage.typicalPriority.toLowerCase()}`,
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
      title: `Build practical depth in ${cap.name}`,
      explanation: cap.constructiveInterpretation,
      practicalNextStep:
        cap.experienceScore <= 1
          ? `Start with one focused learning brief or guided exercise in ${cap.name} over the next month.`
          : `Document or test one real-world piece of work in ${cap.name} and seek feedback from a peer or mentor.`,
    })
  );

  return [stagePriority, ...capabilityPriorities];
}

function buildNextStep(
  answers: RespondentAnswers,
  questions?: AssessmentQuestion[]
): NextStepResult {
  const consultationOption = resolveSelectedOption(
    'profile_q07',
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
      headline: 'Consultation requested',
      description:
        'You indicated that you would like to book a conversation with KWS Academy to talk through your results and possible next steps.',
      invitationNote:
        'In the meantime, choose one priority above and take one practical step on it this month.',
    };
  }

  if (consultationIntent === 'more_info') {
    return {
      wantsConsultation: true,
      consultationIntent,
      headline: 'Exploring next steps with KWS Academy',
      description:
        'You indicated that you would like more information before deciding on a consultation or programme.',
      invitationNote:
        'Review your capability focus areas above and take one small practical step this month while KWS Academy shares relevant information.',
    };
  }

  return {
    wantsConsultation: false,
    consultationIntent: 'none',
    headline: 'Self-directed next step',
    description:
      'Choose one development priority above and take one small, concrete step on it over the next four weeks.',
    invitationNote:
      'If you later decide you would like a human-led conversation with KWS Academy about these reflections, you are always welcome to reach out.',
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

  return {
    scoringVersion: SCORING_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    disclaimer: REFLECTIVE_DISCLAIMER,
    professionalStyle,
    growthJourney,
    capabilities,
    developmentPriorities,
    nextStep,
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
      : 'Pending final style mapping configuration';

  return [
    'KWS ACADEMY DISCOVERY SUMMARY',
    `Reference: ${record.id}`,
    `Name: ${answers.contact.fullName.trim()}`,
    `City & State: ${cityState}`,
    `Minutes taken: ${durationMinutes}`,
    `Professional Style: ${styleLine}`,
    `Growth Stage (provisional): ${result.growthJourney.indicativeStage.name}${
      result.growthJourney.mixedStageFlag ? ' (mixed-stage pattern)' : ''
    }`,
    'Capabilities (Understanding 0-1 / Experience 0-4):',
    ...result.capabilities.map(
      (c) =>
        `- ${c.name}: Understanding ${c.understandingScore}/1, Experience ${c.experienceScore}/4 (${c.experienceLabel})`
    ),
    'Development Priorities:',
    ...result.developmentPriorities.map((p, i) => `${i + 1}. ${p.title}`),
    `FEEDBACK – style fits: ${feedback.archetypeFits || '-'} | stage fits: ${
      feedback.stageFits || '-'
    }`,
    `Notes: ${(feedback.notes || '').trim()}`,
  ].join('\n');
}
