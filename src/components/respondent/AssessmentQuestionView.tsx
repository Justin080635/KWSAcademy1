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

const SECTION_TRANSITION_COPY: Partial<
  Record<
    AssessmentSectionId,
    {
      stepLabel: string;
      headline: string;
      insightNote: string;
      capturedNote: string;
      nextSectionLabel: string;
      anticipationNote: string;
      ctaLabel: string;
    }
  >
> = {
  professional_style: {
    stepLabel: 'Milestone 01 of 03 · Section A complete',
    headline: 'You’ve mapped how you naturally think and decide',
    insightNote:
      'Nine quick scenarios reveal more than work habits—they show what you gravitate toward when deadlines compress, briefs stay ambiguous, and teams need direction.',
    capturedNote:
      'Your Part A scenario responses are saved toward your Professional Style profile.',
    nextSectionLabel: 'Up next · Section B — Your Growth Journey',
    anticipationNote:
      'Six brief reflections on where you stand right now—your learning momentum, what feels stretched today, and what you want the next 12 months to build.',
    ctaLabel: 'Continue to Section B',
  },
  growth_journey: {
    stepLabel: 'Milestone 02 of 03 · Section B complete',
    headline: 'Your direction and 12-month priorities are in focus',
    insightNote:
      'Naming what currently slows your growth—alongside what you want most from the year ahead—turns broad ambition into clear criteria for choosing your next step.',
    capturedNote:
      'Both your working style (Part A) and growth journey reflections (Part B) are saved.',
    nextSectionLabel: 'Up next · Section C — Your Strengths & Growth Areas',
    anticipationNote:
      'Six concise capability cards pairing real-world media and marketing judgment with your hands-on practical experience.',
    ctaLabel: 'Continue to Section C',
  },
  strengths_growth: {
    stepLabel: 'Milestone 03 of 03 · Section C complete',
    headline: 'All six capability pillars are captured',
    insightNote:
      'Looking at situational judgment alongside hands-on repetition surfaces where your instincts already outpace your toolkit—and which skills will compound fastest next.',
    capturedNote:
      'Sections A, B, and C are complete and ready to come together in your discovery report.',
    nextSectionLabel: 'Final step · Section D — Your Profile & Next Steps',
    anticipationNote:
      'A few brief context questions and your details—then your personalized KWS Discovery Report opens immediately on screen.',
    ctaLabel: 'Continue to Final Section',
  },
};

const MOBILE_SECTION_LABELS: Record<AssessmentSectionId, string> = {
  professional_style: 'Style',
  growth_journey: 'Journey',
  strengths_growth: 'Strengths',
  profile_next_steps: 'Next Steps',
};

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
  const enteredSectionsRef = useRef<Set<AssessmentSectionId>>(new Set());
  const directionRef = useRef<1 | -1>(1);

  const totalSteps = steps.length;
  const safeStepIndex = Math.min(Math.max(stepIndex, 0), Math.max(totalSteps - 1, 0));
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

  if (!currentStep) {
    return null;
  }

  // Compute responsive section & overall completion ratios (reacts immediately on option click)
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
              Math.round(((safeStepIndex + currentStepFraction) / totalSteps) * 100)
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
      SECTION_TRANSITION_COPY[currentStep.sectionId]
    ) {
      setTransitionAfterSection(currentStep.sectionId);
      window.scrollTo({ top: 0, behavior: 'auto' });
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

  const transitionCopy = transitionAfterSection
    ? SECTION_TRANSITION_COPY[transitionAfterSection]
    : null;
  const completedSectionsCount =
    transitionAfterSection !== null
      ? currentSectionIndex + 1
      : currentSectionIndex;

  return (
    <div className="mx-auto max-w-[780px] px-4 py-5 sm:px-6 sm:py-10">
      {/* Four-Section Responsive Segmented Progress Indicator */}
      <nav aria-label="Assessment sections" className="mb-6 space-y-2.5">
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

        <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
          {sections.map((sec, idx) => {
            const isCompleted =
              idx < currentSectionIndex ||
              (transitionAfterSection === sec.id && idx === currentSectionIndex);
            const isActive = idx === currentSectionIndex && !isCompleted;
            const fillRatio = isCompleted ? 1 : isActive ? activeSectionRatio : 0;
            const fillPct = isCompleted ? 100 : isActive ? activeSectionPct : 0;

            return (
              <div key={sec.id} className="min-w-0 space-y-1.5">
                <div
                  role="progressbar"
                  aria-label={sec.title}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={fillPct}
                  className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--kws-border)]"
                >
                  <motion.div
                    initial={false}
                    animate={{ scaleX: fillRatio }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 260, damping: 28, mass: 0.8 }
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
                      initial={prefersReducedMotion ? false : { scale: 0.6, opacity: 0 }}
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

      {/* Section Intro Banner on First Step of Each Section */}
      {!transitionAfterSection && isSectionFirst && currentSection && (
        <Surface subtle className="mb-5 px-4 py-3.5 sm:px-5">
          <p className="text-sm leading-relaxed text-[var(--kws-muted)]">
            {currentSection.instructions}
          </p>
        </Surface>
      )}

      {/* Active Step Content or Section-End Editorial Milestone Screen */}
      <div className="overflow-x-hidden">
        <AnimatePresence
          mode="wait"
          initial={false}
          custom={directionRef.current}
        >
          {transitionAfterSection && transitionCopy ? (
            <motion.div
              key={`transition-${transitionAfterSection}`}
              custom={directionRef.current}
              variants={stepSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <Surface className="overflow-hidden p-0">
                {/* Top Milestone Progress Hairline */}
                <div className="h-1 w-full bg-[var(--kws-border)]/70">
                  <motion.div
                    initial={prefersReducedMotion ? false : { scaleX: Math.max(0, (completedSectionsCount - 1) / sections.length) }}
                    animate={{ scaleX: completedSectionsCount / sections.length }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 200, damping: 26 }
                    }
                    style={{ transformOrigin: 'left center' }}
                    className="h-full w-full bg-[var(--kws-success)]"
                  />
                </div>

                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-mono-tabular text-xs font-semibold text-[var(--kws-success)]">
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{transitionCopy.stepLabel}</span>
                    </div>
                    <span className="font-mono-tabular text-xs font-medium text-[var(--kws-muted)]">
                      {overallPct}% overall progress
                    </span>
                  </div>

                  <h1 className="mt-4 font-display text-2xl font-bold leading-tight text-[var(--kws-ink)] sm:text-[32px] [text-wrap:balance]">
                    {transitionCopy.headline}
                  </h1>

                  <p className="mt-3.5 text-base leading-relaxed text-[var(--kws-ink)]">
                    {transitionCopy.insightNote}
                  </p>

                  <p className="mt-2.5 text-sm leading-relaxed text-[var(--kws-muted)]">
                    {transitionCopy.capturedNote}
                  </p>

                  {/* Unboxed Editorial Preview of Next Section */}
                  <div className="mt-6 border-t border-[var(--kws-border)] pt-5">
                    <p className="text-xs font-semibold text-[var(--kws-accent)]">
                      {transitionCopy.nextSectionLabel}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--kws-ink)] sm:text-base">
                      {transitionCopy.anticipationNote}
                    </p>
                  </div>

                  {/* Unboxed 4-Step Editorial Journey Rail */}
                  <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[var(--kws-border)] pt-5 sm:grid-cols-4">
                    {sections.map((sec, idx) => {
                      const done = idx < completedSectionsCount;
                      const upcoming = idx === completedSectionsCount;
                      return (
                        <div key={sec.id} className="min-w-0">
                          <div
                            className={`h-0.5 w-full rounded-full ${
                              done
                                ? 'bg-[var(--kws-success)]'
                                : upcoming
                                  ? 'bg-[var(--kws-accent)]'
                                  : 'bg-[var(--kws-border)]'
                            }`}
                          />
                          <div className="mt-2 flex items-center gap-1.5 text-xs">
                            {done ? (
                              <Check
                                className="h-3.5 w-3.5 shrink-0 text-[var(--kws-success)]"
                                aria-hidden="true"
                              />
                            ) : (
                              <span
                                className={`font-mono-tabular font-semibold ${
                                  upcoming
                                    ? 'text-[var(--kws-accent)]'
                                    : 'text-[var(--kws-muted)]/70'
                                }`}
                              >
                                {sec.code}
                              </span>
                            )}
                            <span
                              className={
                                done
                                  ? 'font-semibold text-[var(--kws-success)]'
                                  : upcoming
                                    ? 'font-semibold text-[var(--kws-accent)]'
                                    : 'text-[var(--kws-muted)]/70'
                              }
                            >
                              {done ? 'Saved' : upcoming ? 'Next' : 'Later'}
                            </span>
                          </div>
                          <p
                            className={`mt-0.5 truncate text-xs font-medium ${
                              done || upcoming
                                ? 'text-[var(--kws-ink)]'
                                : 'text-[var(--kws-muted)]/75'
                            }`}
                          >
                            {sec.navLabel}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[var(--kws-border)] pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
                      {transitionCopy.ctaLabel}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
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
                        SECTION_TRANSITION_COPY[currentStep.sectionId]
                      ) {
                        setTransitionAfterSection(currentStep.sectionId);
                        window.scrollTo({ top: 0, behavior: 'auto' });
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
                <Surface className="p-5 sm:p-7">
                  <h1 className="font-display text-xl font-bold leading-snug text-[var(--kws-ink)] sm:text-2xl [text-wrap:balance]">
                    {question.prompt}
                  </h1>

                  {question.kind === 'contact_details' ? (
                    <div className="mt-5 space-y-5">
                      <p className="rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-3.5 text-sm leading-relaxed text-[var(--kws-muted)]">
                        We ask for your contact and location details so KWS
                        Academy can keep a record of your discovery report,
                        understand regional demand across cities and states, and
                        reach out if you requested a consultation. Your
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
                            I agree to receive my assessment report and relevant
                            KWS Academy follow-up through WhatsApp.
                          </span>
                        </label>
                        <p className="mt-2 text-xs text-[var(--kws-muted)]">
                          Your results are shown immediately on screen whether
                          or not you tick this box.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div
                      role="radiogroup"
                      aria-label={question.prompt}
                      className="mt-5 space-y-2.5"
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
                            className={`group flex w-full min-h-[52px] items-start justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-150 ease-out cursor-pointer active:scale-[0.995] ${
                              isSelected
                                ? 'border-[var(--kws-accent)] bg-[var(--kws-surface-subtle)] ring-1 ring-[var(--kws-accent)]'
                                : 'border-[var(--kws-border)] bg-[var(--kws-surface)] hover:border-[var(--kws-border-strong)] hover:bg-[var(--kws-surface-subtle)]/50'
                            }`}
                          >
                            <div className="flex items-start gap-3 text-sm leading-relaxed sm:text-base">
                              <span
                                className={`mt-0.5 inline-flex min-w-[1.5rem] font-mono-tabular text-sm font-semibold ${
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
                        className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] focus:border-[var(--kws-accent)]"
                      />
                    </div>
                  )}

                  {/* Conditional Institution input for students / recent graduates */}
                  {selectedOption?.requiresInstitution && (
                    <div className="mt-4">
                      <label
                        htmlFor="kws-institution"
                        className="block text-sm font-semibold text-[var(--kws-ink)]"
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
                        className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] focus:border-[var(--kws-accent)]"
                      />
                    </div>
                  )}

                  {/* Submission Error Alert */}
                  {submitError && (
                    <div
                      role="alert"
                      className="mt-5 flex items-start gap-3 rounded-lg border border-[var(--kws-danger)]/40 bg-[var(--kws-danger-surface)] p-3.5 text-sm text-[var(--kws-danger)]"
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

                  {/* Navigation Controls */}
                  <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[var(--kws-border)] pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
                      {isLastStep
                        ? isSubmitting
                          ? 'Submitting...'
                          : 'Submit & Continue'
                        : 'Continue'}
                      {!isSubmitting && (
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
