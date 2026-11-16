import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
} from 'lucide-react';
import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_SECTIONS,
  ASSESSMENT_STEPS,
  STAGE_MAP,
} from '../../domain/assessmentContent.ts';
import {
  PILLAR_INSIGHT_THRESHOLDS,
  selectBestInsight,
} from '../../domain/pillarInsights.ts';
import {
  isStepCompleteForSteps,
  validateContactDetails,
} from '../../domain/scoring.ts';
import type {
  AssessmentQuestion,
  AssessmentSectionId,
  AssessmentSectionMeta,
  AssessmentStep,
  GrowthStageLevel,
  PillarInsightResult,
  QuestionTelemetryInput,
  RespondentAnswers,
} from '../../domain/types.ts';
import { fetchPillarInsight } from '../../services/api.ts';
import { useQuestionTiming } from '../../state/useQuestionTiming.ts';
import { Button } from '../ui/Button.tsx';
import { CircularProgressRing } from '../ui/CircularProgressRing.tsx';
import { Surface } from '../ui/Surface.tsx';
import { BlurredReportPreview } from './BlurredReportPreview.tsx';
import { CapabilityCardView } from './CapabilityCardView.tsx';

interface AssessmentQuestionViewProps {
  stepIndex: number;
  answers: RespondentAnswers;
  sections?: AssessmentSectionMeta[];
  steps?: AssessmentStep[];
  questions?: AssessmentQuestion[];
  isSubmitting: boolean;
  submitError: string | null;
  onSelectOption: (
    questionId: string,
    optionId: string,
    sectionId?: AssessmentSectionId
  ) => void;
  onChangeOtherText: (questionId: string, text: string) => void;
  onUpdateContact: (patch: Partial<RespondentAnswers['contact']>) => void;
  onStepChange: (nextStep: number) => void;
  onSubmit: () => void;
  onExitToWelcome: () => void;
  onEmitTelemetry?: (events: QuestionTelemetryInput[]) => void;
  onAbandonmentBeacon?: (event: QuestionTelemetryInput) => void;
}

const OPTION_LETTERS = 'ABCDEFGH';

const MOBILE_SECTION_LABELS: Record<AssessmentSectionId, string> = {
  professional_style: 'Style',
  growth_journey: 'Journey',
  strengths_growth: 'Strengths',
  profile_next_steps: 'Next Steps',
};

const MILESTONE_ORDER: Partial<Record<AssessmentSectionId, string>> = {
  professional_style: 'Pillar 1 Discovery · Section A Complete',
  growth_journey: 'Pillar 2 Discovery · Section B Complete',
  strengths_growth: 'Pillar 3 Discovery · Section C Complete',
};

const NEXT_SECTION_PREVIEW: Partial<
  Record<AssessmentSectionId, { label: string; teaser: string }>
> = {
  professional_style: {
    label: 'Up next · Section B — Your Growth Journey',
    teaser:
      'Six concise reflections locate your current growth stage and 12-month focus.',
  },
  growth_journey: {
    label: 'Up next · Section C — Strengths & Growth Areas',
    teaser:
      'Six paired capability cards separate situational judgment from hands-on experience.',
  },
  strengths_growth: {
    label: 'Final step · Section D — Your Profile & Next Steps',
    teaser:
      'A few brief context questions and your details before your complete report unlocks.',
  },
};

/**
 * Pure client-safe offline fallback when awaiting or falling back from /api/assessment/pillar-insight.
 * Never embeds Part A option-to-style matrices or Part C answer keys.
 */
function buildClientFallbackInsight(
  sectionId: AssessmentSectionId,
  answers: RespondentAnswers,
  questions: AssessmentQuestion[]
): PillarInsightResult {
  if (sectionId === 'professional_style') {
    const orientationQs = questions.filter(
      (q) => q.kind === 'orientation' && q.active !== false
    );
    const total = Math.max(1, orientationQs.length);
    const answered = orientationQs.filter((q) =>
      Boolean(answers.selections[q.id])
    ).length;

    return selectBestInsight('professional_style', {
      pillarId: 'professional_style',
      partA: {
        partAConfigApproved: false,
        answeredCount: answered,
        totalQuestions: total,
        pattern: null,
        topStyleId: null,
        topStyleName: null,
        topCount: 0,
        topSharePct: 0,
        secondaryStyleId: null,
        secondaryStyleName: null,
        secondaryCount: 0,
        secondarySharePct: 0,
        tiedAtTopCount: 0,
        clusteredNearTopCount: 0,
        activeStylesCount: 0,
        leadGap: 0,
      },
    });
  }

  if (sectionId === 'growth_journey') {
    const scoredIds = ['growth_q01', 'growth_q02', 'growth_q03', 'growth_q04'];
    const values = scoredIds.map((qId) => {
      const optId = answers.selections[qId] ?? '';
      const match = optId.match(/_stage_([1-5])$/);
      if (match) return Number(match[1]) as GrowthStageLevel;
      const q = questions.find((item) => item.id === qId);
      const idx = q ? q.options.findIndex((o) => o.id === optId) : -1;
      return (idx >= 0 ? Math.min(5, Math.max(1, idx + 1)) : 1) as GrowthStageLevel;
    });
    const avg = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
    const rounded = Math.min(5, Math.max(1, Math.floor(avg + 0.5))) as GrowthStageLevel;
    const spread = Math.max(...values) - Math.min(...values);
    const stageDef = STAGE_MAP[rounded];

    return selectBestInsight('growth_journey', {
      pillarId: 'growth_journey',
      partB: {
        unroundedAverage: Math.round(avg * 100) / 100,
        roundedStageLevel: rounded,
        stageName: stageDef.name,
        spread,
        mixedStageFlag: spread >= PILLAR_INSIGHT_THRESHOLDS.partB.mixedStageMinSpread,
        hasChallenge: Boolean(answers.selections.growth_q05),
        hasTwelveMonthGoal: Boolean(answers.selections.growth_q06),
      },
    });
  }

  return selectBestInsight(sectionId, { pillarId: sectionId });
}

export function AssessmentQuestionView({
  stepIndex,
  answers,
  sections = ASSESSMENT_SECTIONS,
  steps = ASSESSMENT_STEPS,
  questions = ASSESSMENT_QUESTIONS,
  isSubmitting,
  submitError,
  onSelectOption,
  onChangeOtherText,
  onUpdateContact,
  onStepChange,
  onSubmit,
  onExitToWelcome,
  onEmitTelemetry,
  onAbandonmentBeacon,
}: AssessmentQuestionViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showContactErrors, setShowContactErrors] = useState(false);
  const [transitionAfterSection, setTransitionAfterSection] =
    useState<AssessmentSectionId | null>(null);
  const [pillarInsightsBySection, setPillarInsightsBySection] = useState<
    Partial<Record<AssessmentSectionId, PillarInsightResult>>
  >({});
  const [loadingInsightSection, setLoadingInsightSection] =
    useState<AssessmentSectionId | null>(null);

  const enteredSectionsRef = useRef<Set<AssessmentSectionId>>(new Set());
  const directionRef = useRef<1 | -1>(1);

  const totalSteps = steps.length;
  const safeStepIndex = Math.min(
    Math.max(stepIndex, 0),
    Math.max(totalSteps - 1, 0)
  );
  const currentStep = steps[safeStepIndex];
  const currentSection = sections.find(
    (s) => s.id === currentStep?.sectionId
  );
  const currentSectionIndex = sections.findIndex(
    (s) => s.id === currentStep?.sectionId
  );

  const totalCards = useMemo(
    () => steps.filter((s) => s.kind === 'capability_card').length,
    [steps]
  );

  const previousStep = safeStepIndex > 0 ? steps[safeStepIndex - 1] : null;
  const nextStepObj =
    safeStepIndex < totalSteps - 1 ? steps[safeStepIndex + 1] : null;
  const isSectionFirst =
    Boolean(currentStep) &&
    (!previousStep || previousStep.sectionId !== currentStep.sectionId);
  const isSectionLast =
    Boolean(currentStep) &&
    (!nextStepObj || nextStepObj.sectionId !== currentStep.sectionId);

  const isLastStep = safeStepIndex === totalSteps - 1;
  const canProceed = isStepCompleteForSteps(
    safeStepIndex,
    answers,
    steps,
    questions
  );

  const contactValidation = validateContactDetails(answers.contact);

  const activeQuestionId =
    !transitionAfterSection && currentStep?.kind === 'question'
      ? currentStep.question.id
      : null;

  const handleLeaveAbandon = useCallback(
    (payload: {
      questionId: string;
      sectionId: AssessmentSectionId;
      timing: { activeTimeMs: number; inactiveTimeMs: number; wallTimeMs: number };
    }) => {
      onAbandonmentBeacon?.({
        eventType: 'assessment_abandoned',
        sectionId: payload.sectionId,
        questionId: payload.questionId,
        activeTimeMs: payload.timing.activeTimeMs,
        inactiveTimeMs: payload.timing.inactiveTimeMs,
        wallTimeMs: payload.timing.wallTimeMs,
      });
    },
    [onAbandonmentBeacon]
  );

  const { getTimingSnapshot, markProgressed } = useQuestionTiming(
    activeQuestionId,
    currentStep?.sectionId ?? 'professional_style',
    handleLeaveAbandon
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setShowContactErrors(false);
    setTransitionAfterSection(null);
  }, [safeStepIndex]);

  useEffect(() => {
    if (!currentStep || transitionAfterSection) return;
    const events: QuestionTelemetryInput[] = [];
    if (!enteredSectionsRef.current.has(currentStep.sectionId)) {
      enteredSectionsRef.current.add(currentStep.sectionId);
      events.push({
        eventType: 'section_entered',
        sectionId: currentStep.sectionId,
      });
    }
    if (currentStep.kind === 'question') {
      events.push({
        eventType: 'question_displayed',
        sectionId: currentStep.sectionId,
        questionId: currentStep.question.id,
      });
    }
    if (events.length > 0) {
      onEmitTelemetry?.(events);
    }
  }, [safeStepIndex, currentStep, transitionAfterSection, onEmitTelemetry]);

  const loadPillarInsight = useCallback(
    (sectionId: AssessmentSectionId, currentAnswers: RespondentAnswers) => {
      setLoadingInsightSection(sectionId);
      void fetchPillarInsight(sectionId, currentAnswers)
        .then((res) => {
          setPillarInsightsBySection((prev) => ({
            ...prev,
            [sectionId]: res.insight,
          }));
        })
        .catch(() => {
          const fallback = buildClientFallbackInsight(
            sectionId,
            currentAnswers,
            questions
          );
          setPillarInsightsBySection((prev) => ({
            ...prev,
            [sectionId]: prev[sectionId] ?? fallback,
          }));
        })
        .finally(() => {
          setLoadingInsightSection((prev) => (prev === sectionId ? null : prev));
        });
    },
    [questions]
  );

  if (!currentStep) {
    return null;
  }

  // Responsive completion progress calculations
  const sectionSteps = steps.filter(
    (s) => s.sectionId === currentStep.sectionId
  );
  const indexInSection = sectionSteps.findIndex((s) => s.id === currentStep.id);

  let currentStepFraction = 0;
  if (transitionAfterSection) {
    currentStepFraction = 1;
  } else if (currentStep.kind === 'capability_card') {
    const hasUnderstanding = Boolean(
      answers.selections[currentStep.card.understandingQuestion.id]
    );
    const hasExperience = Boolean(
      answers.selections[currentStep.card.experienceQuestion.id]
    );
    currentStepFraction =
      hasUnderstanding && hasExperience ? 0.85 : hasUnderstanding ? 0.45 : 0;
  } else if (canProceed) {
    currentStepFraction = 0.75;
  }

  const activeSectionRatio = transitionAfterSection
    ? 1
    : sectionSteps.length > 0
      ? Math.min(
          1,
          (indexInSection + Math.max(0.18, currentStepFraction)) /
            sectionSteps.length
        )
      : 0;
  const activeSectionPct = Math.round(activeSectionRatio * 100);

  const overallPct =
    totalSteps > 0
      ? transitionAfterSection
        ? Math.round(((safeStepIndex + 1) / totalSteps) * 100)
        : Math.max(
            3,
            Math.min(
              100,
              Math.round(
                ((safeStepIndex + currentStepFraction) / totalSteps) * 100
              )
            )
          )
      : 0;

  const momentumLabel =
    overallPct >= 85
      ? 'Final stretch'
      : overallPct >= 55
        ? 'Past halfway'
        : overallPct >= 25
          ? 'Building clarity'
          : 'Finding your rhythm';

  const stepSlideVariants = {
    enter: (dir: number) =>
      prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: dir * 28 },
    center: { opacity: 1, x: 0 },
    exit: (dir: number) =>
      prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: dir * -24 },
  };

  const triggerPillarReveal = (sectionId: AssessmentSectionId) => {
    setTransitionAfterSection(sectionId);
    loadPillarInsight(sectionId, answers);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleNextQuestion = () => {
    if (isSubmitting) return;
    if (
      currentStep.kind === 'question' &&
      currentStep.question.kind === 'contact_details' &&
      !contactValidation.valid
    ) {
      setShowContactErrors(true);
      return;
    }
    if (!canProceed) return;

    if (currentStep.kind === 'question') {
      const timing = getTimingSnapshot();
      markProgressed();
      const events: QuestionTelemetryInput[] = [
        {
          eventType: 'continue_clicked',
          sectionId: currentStep.sectionId,
          questionId: currentStep.question.id,
          optionId: answers.selections[currentStep.question.id] ?? '',
          activeTimeMs: timing.activeTimeMs,
          inactiveTimeMs: timing.inactiveTimeMs,
          wallTimeMs: timing.wallTimeMs,
        },
      ];
      if (isSectionLast) {
        events.push({
          eventType: 'section_completed',
          sectionId: currentStep.sectionId,
        });
      }
      onEmitTelemetry?.(events);
    }

    directionRef.current = 1;
    if (isLastStep) {
      onSubmit();
    } else if (
      isSectionLast &&
      nextStepObj &&
      MILESTONE_ORDER[currentStep.sectionId]
    ) {
      triggerPillarReveal(currentStep.sectionId);
    } else {
      onStepChange(safeStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (isSubmitting) return;
    directionRef.current = -1;
    if (transitionAfterSection) {
      setTransitionAfterSection(null);
      return;
    }
    if (currentStep.kind === 'question') {
      const timing = getTimingSnapshot();
      markProgressed();
      onEmitTelemetry?.([
        {
          eventType: 'back_clicked',
          sectionId: currentStep.sectionId,
          questionId: currentStep.question.id,
          activeTimeMs: timing.activeTimeMs,
          inactiveTimeMs: timing.inactiveTimeMs,
          wallTimeMs: timing.wallTimeMs,
        },
      ]);
    }
    if (safeStepIndex > 0) {
      onStepChange(safeStepIndex - 1);
    } else {
      onExitToWelcome();
    }
  };

  const activeRevealInsight: PillarInsightResult | null = transitionAfterSection
    ? (pillarInsightsBySection[transitionAfterSection] ??
      buildClientFallbackInsight(transitionAfterSection, answers, questions))
    : null;

  const unlockedHighlightsForPreview = useMemo(() => {
    if (!transitionAfterSection) return [];
    const order: AssessmentSectionId[] = [
      'professional_style',
      'growth_journey',
      'strengths_growth',
    ];
    const cutoff = order.indexOf(transitionAfterSection);
    const items: Array<{ sectionLabel: string; value: string }> = [];

    for (let i = 0; i <= cutoff; i += 1) {
      const secId = order[i];
      const item =
        secId === transitionAfterSection
          ? activeRevealInsight
          : pillarInsightsBySection[secId];
      if (!item) continue;
      items.push({
        sectionLabel: item.previewSummary.unlockedLabel,
        value: item.previewSummary.unlockedDetail,
      });
    }
    return items;
  }, [transitionAfterSection, activeRevealInsight, pillarInsightsBySection]);

  const nextSectionMeta = transitionAfterSection
    ? NEXT_SECTION_PREVIEW[transitionAfterSection]
    : null;

  return (
    <div className="mx-auto max-w-[780px] px-3.5 py-3 sm:px-6 sm:py-8">
      {/* Four-Section Responsive Segmented Progress Indicator */}
      <nav
        aria-label="Assessment sections"
        className="mb-3 space-y-1.5 sm:mb-6 sm:space-y-2.5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-[var(--kws-muted)]">
          <span className="font-semibold text-[var(--kws-ink)]">
            {transitionAfterSection
              ? `${currentSection?.partLabel} Complete`
              : currentSection?.partLabel}
          </span>
          <span className="font-mono-tabular flex items-center gap-1.5">
            <span>{momentumLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[var(--kws-ink)]">
              {overallPct}%
            </span>
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
          {sections.map((sec, idx) => {
            const isCompleted =
              idx < currentSectionIndex ||
              (transitionAfterSection === sec.id && idx === currentSectionIndex);
            const isActive = idx === currentSectionIndex && !isCompleted;
            const fillRatio = isCompleted
              ? 1
              : isActive
                ? activeSectionRatio
                : 0;
            const fillPct = isCompleted
              ? 100
              : isActive
                ? activeSectionPct
                : 0;

            return (
              <div key={sec.id} className="min-w-0 space-y-1">
                <div
                  role="progressbar"
                  aria-label={sec.title}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={fillPct}
                  className="h-2 w-full overflow-hidden rounded-full bg-[var(--kws-border)] sm:h-2.5"
                >
                  <motion.div
                    initial={false}
                    animate={{ scaleX: fillRatio }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : {
                            type: 'spring',
                            stiffness: 260,
                            damping: 28,
                            mass: 0.8,
                          }
                    }
                    style={{ transformOrigin: 'left center' }}
                    className={`h-full w-full rounded-full ${
                      isCompleted
                        ? 'bg-[var(--kws-success)]'
                        : 'bg-[var(--kws-accent)]'
                    }`}
                  />
                </div>
                <p
                  className={`flex items-center gap-1 truncate text-[11px] sm:text-xs ${
                    isActive || isCompleted
                      ? 'font-semibold text-[var(--kws-ink)]'
                      : 'text-[var(--kws-muted)]/75'
                  }`}
                >
                  {isCompleted ? (
                    <motion.span
                      initial={
                        prefersReducedMotion
                          ? false
                          : { scale: 0.6, opacity: 0 }
                      }
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="inline-flex shrink-0"
                    >
                      <Check
                        className="h-3 w-3 text-[var(--kws-success)]"
                        aria-hidden="true"
                      />
                    </motion.span>
                  ) : (
                    <span
                      className={`font-mono-tabular shrink-0 ${
                        isActive ? 'text-[var(--kws-accent)]' : ''
                      }`}
                    >
                      {sec.code}.
                    </span>
                  )}
                  <span className="truncate">
                    <span className="sm:hidden">
                      {MOBILE_SECTION_LABELS[sec.id]}
                    </span>
                    <span className="hidden sm:inline">{sec.navLabel}</span>
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Compact Section Intro Banner on First Step of Each Section */}
      {!transitionAfterSection && isSectionFirst && currentSection && (
        <Surface
          subtle
          className="mb-2.5 px-3 py-2 sm:mb-5 sm:px-5 sm:py-3.5"
        >
          <p className="text-xs leading-snug text-[var(--kws-muted)] sm:text-sm sm:leading-relaxed">
            {currentSection.instructions}
          </p>
        </Surface>
      )}

      {/* Active Step Content or Personalized Pillar Discovery Reveal Screen */}
      <div className="overflow-x-hidden">
        <AnimatePresence
          mode="wait"
          initial={false}
          custom={directionRef.current}
        >
          {transitionAfterSection && activeRevealInsight ? (
            <motion.div
              key={`transition-${transitionAfterSection}`}
              custom={directionRef.current}
              variants={stepSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              <Surface className="overflow-hidden p-4 sm:p-8">
                {/* Header status row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--kws-border)] pb-3">
                  <div className="flex items-center gap-2 font-mono-tabular text-xs font-semibold text-[var(--kws-success)]">
                    <CheckCircle2
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{MILESTONE_ORDER[transitionAfterSection]}</span>
                  </div>
                  <span className="font-mono-tabular text-xs font-medium text-[var(--kws-muted)]">
                    {overallPct}% overall
                  </span>
                </div>

                {/* Main Personalised Headline + Insight + Circular Visual Metric */}
                <div className="mt-4 grid grid-cols-1 items-center gap-5 sm:mt-6 md:grid-cols-12 md:gap-6">
                  <div className="md:col-span-7">
                    <h1 className="font-display text-xl font-bold leading-snug text-[var(--kws-ink)] sm:text-[28px] [text-wrap:balance]">
                      {activeRevealInsight.headline}
                    </h1>

                    <p className="mt-2.5 text-sm leading-relaxed text-[var(--kws-ink)] sm:mt-3 sm:text-base">
                      {activeRevealInsight.message}
                    </p>

                    {activeRevealInsight.secondaryObservation && (
                      <p className="mt-2.5 rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-3 text-xs leading-relaxed text-[var(--kws-muted)] sm:text-sm">
                        {activeRevealInsight.secondaryObservation}
                      </p>
                    )}

                    {loadingInsightSection === transitionAfterSection && (
                      <p className="mt-2 font-mono-tabular text-[11px] text-[var(--kws-muted)]">
                        Refining insight from your responses...
                      </p>
                    )}
                  </div>

                  {/* Circular Metric Representation */}
                  <div
                    className={`flex items-start justify-center gap-4 rounded-xl border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-4 md:col-span-5 ${
                      activeRevealInsight.secondaryMetric
                        ? 'grid grid-cols-2 md:gap-3'
                        : 'flex-col items-center'
                    }`}
                  >
                    <CircularProgressRing
                      metric={activeRevealInsight.primaryMetric}
                      size={activeRevealInsight.secondaryMetric ? 'sm' : 'lg'}
                      className="mx-auto"
                    />
                    {activeRevealInsight.secondaryMetric && (
                      <CircularProgressRing
                        metric={activeRevealInsight.secondaryMetric}
                        size="sm"
                        className="mx-auto"
                      />
                    )}
                  </div>
                </div>

                {/* Partially Obscured / Blurred Developing Report Preview */}
                <div className="mt-5">
                  <BlurredReportPreview
                    stage={transitionAfterSection}
                    insight={activeRevealInsight}
                    unlockedHighlights={unlockedHighlightsForPreview}
                    compact
                  />
                </div>

                {/* Curiosity Hook & Next Pillar Teaser */}
                {(activeRevealInsight.curiosityHook || nextSectionMeta) && (
                  <div className="mt-4 border-t border-[var(--kws-border)] pt-4">
                    {nextSectionMeta && (
                      <p className="text-xs font-semibold text-[var(--kws-accent)]">
                        {nextSectionMeta.label}
                      </p>
                    )}
                    <p className="mt-1 text-xs leading-relaxed text-[var(--kws-muted)] sm:text-sm">
                      {activeRevealInsight.curiosityHook ?? nextSectionMeta?.teaser}
                    </p>
                  </div>
                )}

                {/* Navigation Controls */}
                <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-[var(--kws-border)] pt-4 sm:mt-6 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:pt-5">
                  <Button
                    variant="secondary"
                    onClick={handleBack}
                    className="w-full sm:w-auto"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back
                  </Button>

                  <Button
                    variant="primary"
                    onClick={() => {
                      directionRef.current = 1;
                      setTransitionAfterSection(null);
                      onStepChange(safeStepIndex + 1);
                    }}
                    className="w-full sm:w-auto"
                  >
                    <span className="truncate">
                      {activeRevealInsight.ctaLabel}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </Button>
                </div>
              </Surface>
            </motion.div>
          ) : (
            <motion.div
              key={currentStep.id}
              custom={directionRef.current}
              variants={stepSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {currentStep.kind === 'capability_card' ? (
                <CapabilityCardView
                  card={currentStep.card}
                  totalCards={totalCards}
                  answers={answers}
                  onSelectOption={onSelectOption}
                  onBackCard={handleBack}
                  onContinueCard={() => {
                    directionRef.current = 1;
                    if (isSectionLast) {
                      onEmitTelemetry?.([
                        {
                          eventType: 'section_completed',
                          sectionId: currentStep.sectionId,
                        },
                      ]);
                      if (
                        nextStepObj &&
                        MILESTONE_ORDER[currentStep.sectionId]
                      ) {
                        triggerPillarReveal(currentStep.sectionId);
                        return;
                      }
                    }
                    onStepChange(safeStepIndex + 1);
                  }}
                  onEmitTelemetry={onEmitTelemetry}
                  onAbandonmentBeacon={onAbandonmentBeacon}
                />
              ) : (
                (() => {
                  const question = currentStep.question;
                  const selectedOptionId = answers.selections[question.id];
                  const selectedOption = question.options.find(
                    (o) => o.id === selectedOptionId
                  );

                  return (
                    <Surface className="p-3.5 sm:p-7">
                      <h1 className="font-display text-[15px] font-bold leading-snug text-[var(--kws-ink)] sm:text-2xl [text-wrap:balance]">
                        {question.prompt}
                      </h1>

                      {question.kind === 'contact_details' ? (
                        <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
                          <p className="rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-3 text-xs leading-relaxed text-[var(--kws-muted)] sm:p-3.5 sm:text-sm">
                            We ask for your contact and location details so KWS
                            Academy can keep a record of your discovery report,
                            understand regional demand across cities and states,
                            and reach out if you requested a consultation. Your
                            personalized results are shown immediately on screen
                            regardless of whether you request a consultation.
                          </p>

                          <div>
                            <label
                              htmlFor="kws-full-name"
                              className="block text-sm font-semibold text-[var(--kws-ink)]"
                            >
                              Full name{' '}
                              <span className="text-[var(--kws-danger)]">*</span>
                            </label>
                            <input
                              id="kws-full-name"
                              type="text"
                              autoComplete="name"
                              required
                              value={answers.contact.fullName}
                              onChange={(e) =>
                                onUpdateContact({ fullName: e.target.value })
                              }
                              placeholder="Enter your full name"
                              className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] placeholder:text-[var(--kws-muted)]/70 focus:border-[var(--kws-accent)]"
                            />
                            {showContactErrors &&
                              contactValidation.errors.fullName && (
                                <p className="mt-1 text-xs text-[var(--kws-danger)]">
                                  {contactValidation.errors.fullName}
                                </p>
                              )}
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor="kws-whatsapp"
                                className="block text-sm font-semibold text-[var(--kws-ink)]"
                              >
                                WhatsApp number (with country code){' '}
                                <span className="text-[var(--kws-danger)]">*</span>
                              </label>
                              <input
                                id="kws-whatsapp"
                                type="tel"
                                autoComplete="tel"
                                required
                                value={answers.contact.whatsappNumber}
                                onChange={(e) =>
                                  onUpdateContact({
                                    whatsappNumber: e.target.value,
                                  })
                                }
                                placeholder="+234..."
                                className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] placeholder:text-[var(--kws-muted)]/70 focus:border-[var(--kws-accent)]"
                              />
                              {showContactErrors &&
                                contactValidation.errors.whatsappNumber && (
                                  <p className="mt-1 text-xs text-[var(--kws-danger)]">
                                    {contactValidation.errors.whatsappNumber}
                                  </p>
                                )}
                            </div>

                            <div>
                              <label
                                htmlFor="kws-email"
                                className="block text-sm font-semibold text-[var(--kws-ink)]"
                              >
                                Email address{' '}
                                <span className="text-[var(--kws-danger)]">*</span>
                              </label>
                              <input
                                id="kws-email"
                                type="email"
                                autoComplete="email"
                                required
                                value={answers.contact.email}
                                onChange={(e) =>
                                  onUpdateContact({ email: e.target.value })
                                }
                                placeholder="you@example.com"
                                className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] placeholder:text-[var(--kws-muted)]/70 focus:border-[var(--kws-accent)]"
                              />
                              {showContactErrors &&
                                contactValidation.errors.email && (
                                  <p className="mt-1 text-xs text-[var(--kws-danger)]">
                                    {contactValidation.errors.email}
                                  </p>
                                )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor="kws-city"
                                className="block text-sm font-semibold text-[var(--kws-ink)]"
                              >
                                City{' '}
                                <span className="text-[var(--kws-danger)]">*</span>
                              </label>
                              <input
                                id="kws-city"
                                type="text"
                                autoComplete="address-level2"
                                required
                                value={answers.contact.city}
                                onChange={(e) =>
                                  onUpdateContact({ city: e.target.value })
                                }
                                placeholder="e.g. Ikeja"
                                className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] placeholder:text-[var(--kws-muted)]/70 focus:border-[var(--kws-accent)]"
                              />
                              {showContactErrors &&
                                contactValidation.errors.city && (
                                  <p className="mt-1 text-xs text-[var(--kws-danger)]">
                                    {contactValidation.errors.city}
                                  </p>
                                )}
                            </div>

                            <div>
                              <label
                                htmlFor="kws-state"
                                className="block text-sm font-semibold text-[var(--kws-ink)]"
                              >
                                State{' '}
                                <span className="text-[var(--kws-danger)]">*</span>
                              </label>
                              <input
                                id="kws-state"
                                type="text"
                                autoComplete="address-level1"
                                required
                                value={answers.contact.state}
                                onChange={(e) =>
                                  onUpdateContact({ state: e.target.value })
                                }
                                placeholder="e.g. Lagos"
                                className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] placeholder:text-[var(--kws-muted)]/70 focus:border-[var(--kws-accent)]"
                              />
                              {showContactErrors &&
                                contactValidation.errors.state && (
                                  <p className="mt-1 text-xs text-[var(--kws-danger)]">
                                    {contactValidation.errors.state}
                                  </p>
                                )}
                            </div>
                          </div>

                          <div className="pt-1">
                            <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--kws-ink)]">
                              <input
                                type="checkbox"
                                checked={answers.contact.whatsappConsent}
                                onChange={(e) =>
                                  onUpdateContact({
                                    whatsappConsent: e.target.checked,
                                  })
                                }
                                className="mt-1 h-4 w-4 rounded border-[var(--kws-border-strong)] accent-[var(--kws-accent)]"
                              />
                              <span>
                                I agree to receive my assessment report and
                                relevant KWS Academy follow-up through WhatsApp.
                              </span>
                            </label>
                            <p className="mt-2 text-xs text-[var(--kws-muted)]">
                              Your results are shown immediately on screen
                              whether or not you tick this box.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div
                          role="radiogroup"
                          aria-label={question.prompt}
                          className="mt-3 space-y-1.5 sm:mt-5 sm:space-y-2.5"
                        >
                          {question.options.map((opt, idx) => {
                            const isSelected = selectedOptionId === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                onClick={() =>
                                  onSelectOption(
                                    question.id,
                                    opt.id,
                                    currentStep.sectionId
                                  )
                                }
                                className={`group flex w-full min-h-[42px] items-start justify-between gap-2.5 rounded-xl border px-3 py-2 text-left transition-all duration-150 ease-out cursor-pointer active:scale-[0.995] sm:min-h-[52px] sm:gap-3 sm:px-4 sm:py-3.5 ${
                                  isSelected
                                    ? 'border-[var(--kws-accent)] bg-[var(--kws-surface-subtle)] ring-1 ring-[var(--kws-accent)]'
                                    : 'border-[var(--kws-border)] bg-[var(--kws-surface)] hover:border-[var(--kws-border-strong)] hover:bg-[var(--kws-surface-subtle)]/50'
                                }`}
                              >
                                <div className="flex items-start gap-2 text-[13px] leading-snug sm:gap-3 sm:text-base sm:leading-relaxed">
                                  <span
                                    className={`mt-0.5 inline-flex min-w-[1.25rem] font-mono-tabular text-xs font-semibold sm:min-w-[1.5rem] sm:text-sm ${
                                      isSelected
                                        ? 'text-[var(--kws-accent)]'
                                        : 'text-[var(--kws-muted)] group-hover:text-[var(--kws-ink)]'
                                    }`}
                                  >
                                    {OPTION_LETTERS[idx]}.
                                  </span>
                                  <span className="text-[var(--kws-ink)]">
                                    {opt.label}
                                  </span>
                                </div>

                                {isSelected && (
                                  <motion.span
                                    initial={
                                      prefersReducedMotion
                                        ? false
                                        : { scale: 0.7, opacity: 0 }
                                    }
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{
                                      duration: 0.16,
                                      ease: [0.16, 1, 0.3, 1],
                                    }}
                                    className="mt-0.5 shrink-0"
                                  >
                                    <CheckCircle2
                                      className="h-4 w-4 text-[var(--kws-accent)] sm:h-5 sm:w-5"
                                      aria-hidden="true"
                                    />
                                  </motion.span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Conditional "Other (please specify)" input */}
                      {selectedOption?.requiresOtherText && (
                        <div className="mt-3 sm:mt-4">
                          <label
                            htmlFor="kws-other-text"
                            className="block text-xs font-semibold text-[var(--kws-ink)] sm:text-sm"
                          >
                            Please specify{' '}
                            <span className="text-[var(--kws-danger)]">*</span>
                          </label>
                          <input
                            id="kws-other-text"
                            type="text"
                            value={answers.otherText[question.id] ?? ''}
                            onChange={(e) =>
                              onChangeOtherText(question.id, e.target.value)
                            }
                            placeholder="Enter your response"
                            className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2 text-sm text-[var(--kws-ink)] focus:border-[var(--kws-accent)] sm:py-2.5 sm:text-base"
                          />
                        </div>
                      )}

                      {/* Conditional Institution input */}
                      {selectedOption?.requiresInstitution && (
                        <div className="mt-3 sm:mt-4">
                          <label
                            htmlFor="kws-institution"
                            className="block text-xs font-semibold text-[var(--kws-ink)] sm:text-sm"
                          >
                            Exact name of the institution you attend or most
                            recently attended{' '}
                            <span className="text-[var(--kws-danger)]">*</span>
                          </label>
                          <input
                            id="kws-institution"
                            type="text"
                            value={answers.contact.institution}
                            onChange={(e) =>
                              onUpdateContact({ institution: e.target.value })
                            }
                            placeholder="e.g. University of Lagos"
                            className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2 text-sm text-[var(--kws-ink)] focus:border-[var(--kws-accent)] sm:py-2.5 sm:text-base"
                          />
                        </div>
                      )}

                      {/* Submission Error Alert */}
                      {submitError && (
                        <div
                          role="alert"
                          className="mt-4 flex items-start gap-3 rounded-lg border border-[var(--kws-danger)]/40 bg-[var(--kws-danger-surface)] p-3 text-xs text-[var(--kws-danger)] sm:mt-5 sm:p-3.5 sm:text-sm"
                        >
                          <AlertCircle
                            className="mt-0.5 h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <div>
                            <p className="font-semibold">
                              Unable to submit assessment
                            </p>
                            <p className="mt-0.5">{submitError}</p>
                          </div>
                        </div>
                      )}

                      {/* Navigation Controls (side-by-side on mobile to eliminate scroll) */}
                      <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-[var(--kws-border)] pt-3 sm:mt-7 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:pt-5">
                        <Button
                          variant="secondary"
                          onClick={handleBack}
                          disabled={isSubmitting}
                          className="w-full sm:w-auto"
                        >
                          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                          {safeStepIndex === 0 ? 'Overview' : 'Back'}
                        </Button>

                        <Button
                          variant="primary"
                          onClick={handleNextQuestion}
                          disabled={
                            question.kind !== 'contact_details' && !canProceed
                          }
                          loading={isSubmitting}
                          className="w-full sm:w-auto"
                        >
                          {isLastStep ? (
                            isSubmitting ? (
                              'Submitting...'
                            ) : (
                              <>
                                <span className="sm:hidden">Finish</span>
                                <span className="hidden sm:inline">
                                  Submit &amp; Continue
                                </span>
                              </>
                            )
                          ) : (
                            'Continue'
                          )}
                          {!isSubmitting && (
                            <ArrowRight
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          )}
                        </Button>
                      </div>
                    </Surface>
                  );
                })()
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
