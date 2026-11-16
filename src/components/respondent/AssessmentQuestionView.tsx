import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_SECTIONS,
  ASSESSMENT_STEPS,
} from '../../domain/assessmentContent.ts';
import {
  isStepCompleteForSteps,
  validateContactDetails,
} from '../../domain/scoring.ts';
import type {
  AssessmentQuestion,
  AssessmentSectionId,
  AssessmentSectionMeta,
  AssessmentStep,
  QuestionTelemetryInput,
  RespondentAnswers,
} from '../../domain/types.ts';
import { useQuestionTiming } from '../../state/useQuestionTiming.ts';
import { Button } from '../ui/Button.tsx';
import { Surface } from '../ui/Surface.tsx';
import {
  KWS_DURATIONS,
  KWS_EASE,
  KWS_SPRING,
} from '../ui/motionPrimitives.tsx';
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

const BREAK_SCREEN_COPY: Record<
  AssessmentSectionId,
  { headline: string; supportingLine: string; ctaLabel: string }
> = {
  professional_style: {
    headline: 'Round one done. Your instincts are in.',
    supportingLine: 'Next, a look at where you are on your path.',
    ctaLabel: 'Keep going',
  },
  growth_journey: {
    headline: 'Nice. Your path is mapped.',
    supportingLine:
      "Up next: six quick strengths, what you know and what you've done.",
    ctaLabel: "Let's do it",
  },
  strengths_growth: {
    headline: 'Strengths done. One last stretch.',
    supportingLine: 'Just a few questions about you, then your profile.',
    ctaLabel: 'Almost there',
  },
  profile_next_steps: {
    headline: "That's everything.",
    supportingLine: 'Ready to see what your answers say about you?',
    ctaLabel: 'Reveal my profile',
  },
};

function BreakScreenIllustration({
  sectionId,
}: {
  sectionId: AssessmentSectionId;
}) {
  if (sectionId === 'professional_style') {
    // Rising stepping-stone trail & compass star (heading onto growth path)
    return (
      <div
        aria-hidden="true"
        className="flex h-14 w-20 items-center justify-center rounded-2xl border border-[var(--kws-border)] bg-[var(--kws-tint-bg)]/80"
      >
        <svg viewBox="0 0 72 48" className="h-10 w-16" fill="none">
          <path
            d="M10 35C22 35 24 23 36 23C48 23 50 13 61 13"
            stroke="var(--kws-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="4 4"
          />
          <circle cx="10" cy="35" r="4" fill="var(--kws-accent)" fillOpacity="0.35" />
          <circle cx="36" cy="23" r="4.5" fill="var(--kws-accent)" fillOpacity="0.7" />
          <circle cx="61" cy="13" r="5.5" fill="var(--kws-gold)" />
        </svg>
      </div>
    );
  }

  if (sectionId === 'growth_journey') {
    // Balanced 6-bar strengths equalizer & spark (heading into Part C)
    return (
      <div
        aria-hidden="true"
        className="flex h-14 w-20 items-center justify-center rounded-2xl border border-[var(--kws-border)] bg-[var(--kws-tint-bg)]/80"
      >
        <svg viewBox="0 0 72 48" className="h-10 w-16" fill="none">
          <rect x="12" y="24" width="6" height="14" rx="3" fill="var(--kws-accent)" fillOpacity="0.4" />
          <rect x="21" y="17" width="6" height="21" rx="3" fill="var(--kws-accent)" fillOpacity="0.65" />
          <rect x="30" y="12" width="6" height="26" rx="3" fill="var(--kws-accent)" />
          <rect x="39" y="19" width="6" height="19" rx="3" fill="var(--kws-gold)" />
          <rect x="48" y="15" width="6" height="23" rx="3" fill="var(--kws-accent)" fillOpacity="0.75" />
          <rect x="57" y="22" width="6" height="16" rx="3" fill="var(--kws-accent)" fillOpacity="0.45" />
        </svg>
      </div>
    );
  }

  if (sectionId === 'strengths_growth') {
    // Finish line ribbon / short bridge ahead (heading into Part D)
    return (
      <div
        aria-hidden="true"
        className="flex h-14 w-20 items-center justify-center rounded-2xl border border-[var(--kws-border)] bg-[var(--kws-tint-bg)]/80"
      >
        <svg viewBox="0 0 72 48" className="h-10 w-16" fill="none">
          <rect x="14" y="14" width="44" height="20" rx="10" stroke="var(--kws-accent)" strokeWidth="2.5" strokeOpacity="0.35" />
          <rect x="14" y="14" width="33" height="20" rx="10" fill="var(--kws-accent)" fillOpacity="0.18" />
          <circle cx="49" cy="24" r="7" fill="var(--kws-gold)" />
          <path
            d="M46 24L48.2 26.2L52.5 21.8"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  // After Part D: radiant profile card ready to reveal
  return (
    <div
      aria-hidden="true"
      className="flex h-14 w-20 items-center justify-center rounded-2xl border border-[var(--kws-border)] bg-[var(--kws-tint-bg)]/80"
    >
      <svg viewBox="0 0 72 48" className="h-10 w-16" fill="none">
        <rect
          x="16"
          y="10"
          width="40"
          height="28"
          rx="6"
          fill="var(--kws-surface)"
          stroke="var(--kws-accent)"
          strokeWidth="2.2"
        />
        <circle cx="27" cy="21" r="4" fill="var(--kws-gold)" />
        <path
          d="M35 19H49M35 24H45M23 30H49"
          stroke="var(--kws-accent)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
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
  const [showMissingHint, setShowMissingHint] = useState(false);
  const [transitionAfterSection, setTransitionAfterSection] =
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

  const scrollTopSmoothly = useCallback(() => {
    if (typeof window !== 'undefined' && window.scrollY > 24) {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    scrollTopSmoothly();
    setShowContactErrors(false);
    setShowMissingHint(false);
    setTransitionAfterSection(null);
  }, [safeStepIndex, scrollTopSmoothly]);

  useEffect(() => {
    if (canProceed) {
      setShowMissingHint(false);
    }
  }, [canProceed]);

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

  if (!currentStep) {
    return null;
  }

  const sectionSteps = steps.filter(
    (s) => s.sectionId === currentStep.sectionId
  );
  const indexInSection = sectionSteps.findIndex((s) => s.id === currentStep.id);

  const stepSlideVariants = {
    enter: (dir: number) =>
      prefersReducedMotion
        ? { opacity: 1 }
        : { opacity: 0, x: dir * 20, scale: 0.988 },
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: number) =>
      prefersReducedMotion
        ? { opacity: 1 }
        : { opacity: 0, x: dir * -16, scale: 0.992 },
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
    if (!canProceed) {
      setShowMissingHint(true);
      return;
    }

    setShowMissingHint(false);

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
    if (isSectionLast && BREAK_SCREEN_COPY[currentStep.sectionId]) {
      setTransitionAfterSection(currentStep.sectionId);
      scrollTopSmoothly();
    } else if (isLastStep) {
      onSubmit();
    } else {
      onStepChange(safeStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (isSubmitting) return;
    directionRef.current = -1;
    setShowMissingHint(false);
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

  const celebration = transitionAfterSection
    ? BREAK_SCREEN_COPY[transitionAfterSection]
    : null;

  const partStatusText = `Part ${currentSection?.code ?? 'A'} · ${indexInSection + 1} of ${sectionSteps.length}`;

  const showPartCHalfwayBanner =
    !transitionAfterSection &&
    currentStep.kind === 'capability_card' &&
    currentStep.card.index === 4;

  const trackProgressRatio = useMemo(() => {
    if (sections.length <= 1) return 0;
    const maxSegment = sections.length - 1;
    if (transitionAfterSection) {
      return Math.min(1, (currentSectionIndex + 1) / maxSegment);
    }
    const withinSectionFraction =
      sectionSteps.length > 0 ? indexInSection / sectionSteps.length : 0;
    const continuousNode =
      currentSectionIndex +
      (currentSectionIndex < maxSegment ? withinSectionFraction : 0);
    return Math.max(0, Math.min(1, continuousNode / maxSegment));
  }, [
    sections.length,
    transitionAfterSection,
    currentSectionIndex,
    indexInSection,
    sectionSteps.length,
  ]);

  return (
    <div className="mx-auto max-w-[780px] px-4 pt-4 pb-6 sm:px-6 sm:py-10">
      {/* Clean Four-Stop Journey Path (No percentages, no monospace; hide part status row on break screens) */}
      <nav aria-label="Discovery journey progress" className="mb-5 sm:mb-7">
        {!transitionAfterSection && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--kws-muted)] sm:text-sm">
            <span className="font-semibold text-[var(--kws-ink)]">
              {currentSection?.partLabel}
            </span>
            <span className="tabular-nums text-[var(--kws-muted)]">
              {partStatusText}
            </span>
          </div>
        )}

        <ol className="relative flex items-start justify-between gap-2">
          {/* Connecting track behind the four nodes */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-3.5 right-[12%] left-[12%] h-[3px] overflow-hidden rounded-full bg-[var(--kws-border)]"
          >
            <motion.div
              className={`h-full w-full origin-left rounded-full bg-[image:var(--kws-gradient-btn)] ${
                trackProgressRatio > 0 && !prefersReducedMotion
                  ? 'kws-progress-sheen'
                  : ''
              }`}
              initial={false}
              animate={{ scaleX: trackProgressRatio }}
              transition={prefersReducedMotion ? { duration: 0 } : KWS_SPRING}
            />
          </div>

          {sections.map((sec, idx) => {
            const isCompleted =
              idx < currentSectionIndex ||
              (transitionAfterSection === sec.id && idx === currentSectionIndex);
            const isActive = idx === currentSectionIndex && !isCompleted;

            return (
              <li
                key={sec.id}
                aria-current={isActive ? 'step' : undefined}
                className="relative z-10 flex flex-1 flex-col items-center text-center"
              >
                <motion.span
                  key={`${sec.id}-${isCompleted ? 'done' : isActive ? 'active' : 'pending'}`}
                  initial={
                    prefersReducedMotion || !isCompleted
                      ? false
                      : { scale: 0.85 }
                  }
                  animate={{ scale: 1 }}
                  transition={prefersReducedMotion ? { duration: 0 } : KWS_SPRING}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-[background-color,border-color,color,box-shadow] duration-250 ${
                    isCompleted
                      ? 'border-transparent bg-[image:var(--kws-gradient-btn)] text-[var(--kws-accent-fg)] shadow-xs'
                      : isActive
                        ? 'border-[var(--kws-accent)] bg-[var(--kws-surface)] text-[var(--kws-accent)] ring-4 ring-[var(--kws-accent)]/15'
                        : 'border-[var(--kws-border-strong)] bg-[var(--kws-surface)] text-[var(--kws-muted)]'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 stroke-[2.75]" aria-hidden="true" />
                  ) : (
                    sec.code
                  )}
                </motion.span>
                <span
                  className={`mt-1.5 text-[11px] transition-colors duration-200 sm:text-xs ${
                    isActive || isCompleted
                      ? 'font-semibold text-[var(--kws-ink)]'
                      : 'text-[var(--kws-muted)]'
                  }`}
                >
                  {sec.navLabel}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Section Intro Banner on First Question of Each Part */}
      <AnimatePresence initial={false}>
        {!transitionAfterSection && isSectionFirst && currentSection && (
          <motion.div
            key={`intro-${currentSection.id}`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            transition={{ duration: KWS_DURATIONS.base, ease: KWS_EASE }}
            className="mb-5 rounded-[20px] border border-[var(--kws-border)]/75 bg-[var(--kws-tint-bg)]/75 px-5 py-3.5 sm:mb-6"
          >
            <p className="text-xs leading-relaxed text-[var(--kws-muted)] sm:text-sm">
              {currentSection.instructions}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Non-Blocking Halfway Banner in Part C (right after card 3, on arrival at card 4) */}
      <AnimatePresence initial={false}>
        {showPartCHalfwayBanner && (
          <motion.div
            key="part-c-halfway"
            role="status"
            initial={
              prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.99 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            transition={{ duration: KWS_DURATIONS.base, ease: KWS_EASE }}
            className="mb-5 flex items-center gap-3.5 rounded-[20px] border border-[var(--kws-accent)]/25 bg-[var(--kws-tint-bg)] px-5 py-3.5 sm:mb-6"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[image:var(--kws-gradient-btn)] text-[var(--kws-accent-fg)] shadow-xs"
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-[var(--kws-ink)] sm:text-base">
                Halfway through your strengths.
              </p>
              <p className="text-xs text-[var(--kws-muted)] sm:text-sm">
                Three to go. You're doing great.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Question OR Clean Section Break Screen */}
      <div className="overflow-x-clip">
        <AnimatePresence
          mode="wait"
          initial={false}
          custom={directionRef.current}
        >
          {transitionAfterSection && celebration ? (
            <motion.div
              key={`celebration-${transitionAfterSection}`}
              custom={directionRef.current}
              variants={stepSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: KWS_DURATIONS.base, ease: KWS_EASE }}
            >
              <Surface className="rounded-[24px] p-7 sm:p-10">
                <div className="flex items-center justify-between gap-4">
                  <motion.div
                    initial={
                      prefersReducedMotion
                        ? false
                        : { scale: 0.78, opacity: 0 }
                    }
                    animate={{ scale: 1, opacity: 1 }}
                    transition={
                      prefersReducedMotion ? { duration: 0 } : KWS_SPRING
                    }
                    className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[image:var(--kws-gradient-btn)] text-[var(--kws-accent-fg)] shadow-[0_12px_30px_-6px_rgba(43,59,196,0.45)] ring-4 ring-[var(--kws-accent)]/12"
                    aria-hidden="true"
                  >
                    <Check className="h-7 w-7 stroke-[2.5]" />
                  </motion.div>

                  <div className={prefersReducedMotion ? '' : 'kws-float-slow'}>
                    <BreakScreenIllustration sectionId={transitionAfterSection} />
                  </div>
                </div>

                <h1 className="mt-6 font-display text-[26px] font-bold leading-[1.16] tracking-[-0.025em] text-[var(--kws-ink)] sm:text-[32px] [text-wrap:balance]">
                  {celebration.headline}
                </h1>

                <p className="mt-3 max-w-[48ch] text-base leading-[1.6] text-[var(--kws-muted)] sm:text-lg">
                  {celebration.supportingLine}
                </p>

                {transitionAfterSection === 'profile_next_steps' && submitError && (
                  <div
                    role="alert"
                    className="mt-5 flex items-start gap-3 rounded-xl border border-[var(--kws-border-strong)] bg-[var(--kws-tint-bg)] p-3.5 text-xs text-[var(--kws-ink)] sm:text-sm"
                  >
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kws-accent)]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold">
                        That didn’t go through, but your answers are safe.
                      </p>
                      <p className="mt-0.5 text-[var(--kws-muted)]">
                        {submitError}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-8">
                  <Button
                    variant="primary"
                    size="lg"
                    loading={
                      transitionAfterSection === 'profile_next_steps' &&
                      isSubmitting
                    }
                    onClick={() => {
                      if (transitionAfterSection === 'profile_next_steps') {
                        onSubmit();
                        return;
                      }
                      directionRef.current = 1;
                      setTransitionAfterSection(null);
                      onStepChange(safeStepIndex + 1);
                    }}
                    className="w-full min-h-[56px] justify-center sm:w-auto sm:min-w-[210px]"
                  >
                    <span>{celebration.ctaLabel}</span>
                    {!(
                      transitionAfterSection === 'profile_next_steps' &&
                      isSubmitting
                    ) && (
                      <ArrowRight
                        className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    )}
                  </Button>
                </div>
              </Surface>

              <div className="mt-4 sm:mt-5">
                <Button
                  variant="secondary"
                  allowWrap
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-6 sm:w-auto"
                >
                  <ArrowLeft
                    className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
                    aria-hidden="true"
                  />
                  <span>Back</span>
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={currentStep.id}
              custom={directionRef.current}
              variants={stepSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: KWS_DURATIONS.base, ease: KWS_EASE }}
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
                        BREAK_SCREEN_COPY[currentStep.sectionId]
                      ) {
                        setTransitionAfterSection(currentStep.sectionId);
                        scrollTopSmoothly();
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
                    <div>
                      <Surface className="rounded-[24px] p-6 sm:p-8">
                        <h1 className="font-display text-xl font-bold leading-snug text-[var(--kws-ink)] sm:text-2xl [text-wrap:balance]">
                          {question.prompt}
                        </h1>

                        {question.kind === 'contact_details' ? (
                          <div className="mt-5 space-y-4 sm:space-y-5">
                            <p className="border-l-2 border-[var(--kws-accent)]/40 pl-3.5 text-xs leading-relaxed text-[var(--kws-muted)] sm:text-sm">
                              This just saves a copy of your profile for you and
                              lets us reach out if you ask for a chat. You’ll
                              see your full results right away either way.
                            </p>

                            <div>
                              <label
                                htmlFor="kws-full-name"
                                className="block text-sm font-semibold text-[var(--kws-ink)]"
                              >
                                Full name{' '}
                                <span className="text-[var(--kws-accent)]">*</span>
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
                                className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] placeholder:text-[var(--kws-muted)]/70 focus:border-[var(--kws-accent)]"
                              />
                              {showContactErrors &&
                                contactValidation.errors.fullName && (
                                  <p className="mt-1 text-xs font-medium text-[var(--kws-accent)]">
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
                                  <span className="text-[var(--kws-accent)]">*</span>
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
                                  className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] placeholder:text-[var(--kws-muted)]/70 focus:border-[var(--kws-accent)]"
                                />
                                {showContactErrors &&
                                  contactValidation.errors.whatsappNumber && (
                                    <p className="mt-1 text-xs font-medium text-[var(--kws-accent)]">
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
                                  <span className="text-[var(--kws-accent)]">*</span>
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
                                  className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] placeholder:text-[var(--kws-muted)]/70 focus:border-[var(--kws-accent)]"
                                />
                                {showContactErrors &&
                                  contactValidation.errors.email && (
                                    <p className="mt-1 text-xs font-medium text-[var(--kws-accent)]">
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
                                  <span className="text-[var(--kws-accent)]">*</span>
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
                                  className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] placeholder:text-[var(--kws-muted)]/70 focus:border-[var(--kws-accent)]"
                                />
                                {showContactErrors &&
                                  contactValidation.errors.city && (
                                    <p className="mt-1 text-xs font-medium text-[var(--kws-accent)]">
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
                                  <span className="text-[var(--kws-accent)]">*</span>
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
                                  className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] placeholder:text-[var(--kws-muted)]/70 focus:border-[var(--kws-accent)]"
                                />
                                {showContactErrors &&
                                  contactValidation.errors.state && (
                                    <p className="mt-1 text-xs font-medium text-[var(--kws-accent)]">
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
                                  Send me my profile and occasional KWS Academy
                                  updates on WhatsApp.
                                </span>
                              </label>
                              <p className="mt-2 text-xs text-[var(--kws-muted)]">
                                Totally optional. Your full profile opens
                                either way.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div
                            role="radiogroup"
                            aria-label={question.prompt}
                            className="mt-5 space-y-3"
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
                                  className={`group flex w-full min-h-[56px] items-center justify-between gap-3 rounded-[20px] border px-4 py-3.5 text-left transition-[transform,box-shadow,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer active:scale-[0.988] sm:min-h-[60px] sm:gap-4 sm:px-5 sm:py-4 ${
                                    isSelected
                                      ? 'border-[var(--kws-accent)] bg-[var(--kws-tint-bg)] ring-2 ring-[var(--kws-accent)]/25 shadow-xs'
                                      : 'border-[var(--kws-border)] bg-[var(--kws-surface)] hover:-translate-y-0.5 hover:border-[var(--kws-border-strong)] hover:bg-[var(--kws-surface-subtle)]/40 hover:shadow-xs'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 text-sm leading-relaxed sm:gap-3.5 sm:text-base">
                                    <span
                                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] sm:text-sm ${
                                        isSelected
                                          ? 'scale-105 bg-[image:var(--kws-gradient-btn)] text-[var(--kws-accent-fg)] shadow-xs'
                                          : 'bg-[var(--kws-surface-subtle)] text-[var(--kws-muted)] group-hover:scale-105 group-hover:text-[var(--kws-ink)]'
                                      }`}
                                    >
                                      {OPTION_LETTERS[idx]}
                                    </span>
                                    <span className="font-medium text-[var(--kws-ink)]">
                                      {opt.label}
                                    </span>
                                  </div>

                                  {isSelected && (
                                    <motion.span
                                      initial={
                                        prefersReducedMotion
                                          ? false
                                          : { scale: 0.65, opacity: 0 }
                                      }
                                      animate={{ scale: 1, opacity: 1 }}
                                      transition={
                                        prefersReducedMotion
                                          ? { duration: 0 }
                                          : KWS_SPRING
                                      }
                                      className="shrink-0"
                                    >
                                      <CheckCircle2
                                        className="h-5 w-5 text-[var(--kws-accent)]"
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
                          <div className="mt-4">
                            <label
                              htmlFor="kws-other-text"
                              className="block text-sm font-semibold text-[var(--kws-ink)]"
                            >
                              Please specify{' '}
                              <span className="text-[var(--kws-accent)]">*</span>
                            </label>
                            <input
                              id="kws-other-text"
                              type="text"
                              value={answers.otherText[question.id] ?? ''}
                              onChange={(e) =>
                                onChangeOtherText(question.id, e.target.value)
                              }
                              placeholder="Enter your response"
                              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] focus:border-[var(--kws-accent)]"
                            />
                          </div>
                        )}

                        {/* Conditional Institution input */}
                        {selectedOption?.requiresInstitution && (
                          <div className="mt-4">
                            <label
                              htmlFor="kws-institution"
                              className="block text-sm font-semibold text-[var(--kws-ink)]"
                            >
                              Exact name of the institution you attend or most
                              recently attended{' '}
                              <span className="text-[var(--kws-accent)]">*</span>
                            </label>
                            <input
                              id="kws-institution"
                              type="text"
                              value={answers.contact.institution}
                              onChange={(e) =>
                                onUpdateContact({ institution: e.target.value })
                              }
                              placeholder="e.g. University of Lagos"
                              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] focus:border-[var(--kws-accent)]"
                            />
                          </div>
                        )}

                        {/* Friendly Missing Selection Hint */}
                        {showMissingHint && !canProceed && question.kind !== 'contact_details' && (
                          <p
                            role="status"
                            className="mt-4 text-sm font-medium text-[var(--kws-accent)]"
                          >
                            {!selectedOption
                              ? 'Pick an answer to keep going.'
                              : selectedOption.requiresOtherText &&
                                  !(answers.otherText[question.id] ?? '').trim()
                                ? 'Please add a short note above so we know what you meant.'
                                : 'Please add your school or institution above to keep going.'}
                          </p>
                        )}

                        {/* Submission Error Alert */}
                        {submitError && (
                          <div
                            role="alert"
                            className="mt-5 flex items-start gap-3 rounded-xl border border-[var(--kws-border-strong)] bg-[var(--kws-tint-bg)] p-3.5 text-xs text-[var(--kws-ink)] sm:text-sm"
                          >
                            <AlertCircle
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kws-accent)]"
                              aria-hidden="true"
                            />
                            <div>
                              <p className="font-semibold">
                                That didn’t go through, but your answers are safe.
                              </p>
                              <p className="mt-0.5 text-[var(--kws-muted)]">
                                {submitError}
                              </p>
                            </div>
                          </div>
                        )}
                      </Surface>

                      {/* Sticky Bottom Mobile Action Bar */}
                      <div className="sticky bottom-0 z-20 -mx-4 mt-4 bg-gradient-to-t from-[var(--kws-bg)] via-[var(--kws-bg)]/95 to-transparent px-4 pt-6 pb-[calc(16px+env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mt-6 sm:bg-none sm:p-0">
                        <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-4">
                          <Button
                            variant="primary"
                            allowWrap
                            onClick={handleNextQuestion}
                            loading={isSubmitting}
                            className="w-full min-h-[56px] justify-between px-6 sm:w-auto sm:min-w-[190px] sm:justify-center"
                          >
                            <span>Continue</span>
                            {!isSubmitting && (
                              <ArrowRight
                                className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                                aria-hidden="true"
                              />
                            )}
                          </Button>

                          <Button
                            variant="secondary"
                            allowWrap
                            onClick={handleBack}
                            disabled={isSubmitting}
                            className="w-full min-h-[48px] px-6 sm:w-auto"
                          >
                            <ArrowLeft
                              className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
                              aria-hidden="true"
                            />
                            <span>{safeStepIndex === 0 ? 'Overview' : 'Back'}</span>
                          </Button>
                        </div>
                      </div>
                    </div>
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
