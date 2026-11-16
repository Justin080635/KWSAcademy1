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
      headline: string;
      capturedNote: string;
      anticipationNote: string;
      ctaLabel: string;
    }
  >
> = {
  professional_style: {
    headline: 'Your working preferences are captured',
    capturedNote:
      'You have completed Section A. Every scenario choice has been saved toward your Professional Style profile.',
    anticipationNote:
      'Next up is Section B — Your Growth Journey: six brief reflections on what currently matters most in your professional development, challenges, and 12-month goals.',
    ctaLabel: 'Continue to Section B',
  },
  growth_journey: {
    headline: 'Your growth reflections are saved',
    capturedNote:
      'Sections A and B are complete. Your current direction, momentum patterns, and 12-month priorities have been recorded.',
    anticipationNote:
      'Next up is Section C — Your Strengths & Growth Areas: six short capability cards pairing real-world scenarios with your hands-on experience.',
    ctaLabel: 'Continue to Section C',
  },
  strengths_growth: {
    headline: 'Your six capability snapshots are ready',
    capturedNote:
      'You have completed all six capability pillars across situational understanding and practical experience.',
    anticipationNote:
      'One short final section remains — Section D — Your Profile & Next Steps: a few context questions and your details so your immediate personalized discovery report can be generated.',
    ctaLabel: 'Continue to Final Section',
  },
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

  // Compute progress fraction within the active section for the 4-section segmented bar
  const sectionSteps = steps.filter(
    (s) => s.sectionId === currentStep.sectionId
  );
  const indexInSection = sectionSteps.findIndex((s) => s.id === currentStep.id);
  const activeSectionPct = transitionAfterSection
    ? 100
    : sectionSteps.length > 0
      ? Math.round(((indexInSection + 1) / sectionSteps.length) * 100)
      : 0;

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
    <div className="mx-auto max-w-[780px] px-4 py-6 sm:px-6 sm:py-10">
      {/* Four-Section Segmented Progress Indicator (No intimidating question counter) */}
      <nav aria-label="Assessment sections" className="mb-6 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-[var(--kws-muted)]">
          <span className="font-semibold text-[var(--kws-ink)]">
            {currentSection?.partLabel}
          </span>
          <span className="font-mono-tabular">
            Section {currentSection?.code} of D
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {sections.map((sec, idx) => {
            const isCompleted =
              idx < currentSectionIndex ||
              (transitionAfterSection === sec.id && idx === currentSectionIndex);
            const isActive = idx === currentSectionIndex && !isCompleted;
            const fillPct = isCompleted ? 100 : isActive ? activeSectionPct : 0;

            return (
              <div key={sec.id} className="min-w-0 space-y-1.5">
                <div
                  role="progressbar"
                  aria-label={sec.title}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={fillPct}
                  className="h-2 w-full overflow-hidden rounded-full bg-[var(--kws-border)]"
                >
                  <div
                    className="h-full bg-[var(--kws-accent)] transition-all duration-300 ease-out"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
                <p
                  className={`truncate text-[11px] sm:text-xs ${
                    isActive || isCompleted
                      ? 'font-semibold text-[var(--kws-ink)]'
                      : 'text-[var(--kws-muted)]/70'
                  }`}
                >
                  {sec.code}. {sec.navLabel}
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

      {/* Active Step Content or Section-End Transition Screen */}
      <AnimatePresence mode="wait" initial={false}>
        {transitionAfterSection && transitionCopy ? (
          <motion.div
            key={`transition-${transitionAfterSection}`}
            initial={
              prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={
              prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }
            }
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <Surface className="p-6 sm:p-8">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--kws-success)]">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>
                  {currentSection?.partLabel} Complete
                  <span aria-hidden="true" className="mx-1.5">
                    ·
                  </span>
                  {completedSectionsCount} of {sections.length} captured
                </span>
              </div>

              <h1 className="mt-3 font-display text-2xl font-bold leading-snug text-[var(--kws-ink)] sm:text-3xl [text-wrap:balance]">
                {transitionCopy.headline}
              </h1>

              <p className="mt-3 text-base leading-relaxed text-[var(--kws-ink)]">
                {transitionCopy.capturedNote}
              </p>

              <div className="mt-5 rounded-xl border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--kws-accent)]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Up Next
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--kws-ink)]">
                  {transitionCopy.anticipationNote}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {sections.map((sec, idx) => {
                  const done = idx < completedSectionsCount;
                  const upcoming = idx === completedSectionsCount;
                  return (
                    <div
                      key={sec.id}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs ${
                        done
                          ? 'border-[var(--kws-success)]/35 bg-[var(--kws-success-surface)] text-[var(--kws-ink)]'
                          : upcoming
                            ? 'border-[var(--kws-accent)]/40 bg-[var(--kws-surface)] text-[var(--kws-ink)]'
                            : 'border-[var(--kws-border)] bg-[var(--kws-surface-subtle)]/50 text-[var(--kws-muted)]'
                      }`}
                    >
                      {done ? (
                        <Check
                          className="h-4 w-4 shrink-0 text-[var(--kws-success)]"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center font-mono-tabular font-semibold text-[var(--kws-accent)]">
                          {sec.code}
                        </span>
                      )}
                      <span className="truncate font-medium">
                        {sec.title}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-7 flex items-center justify-between gap-4 border-t border-[var(--kws-border)] pt-5">
                <Button variant="secondary" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </Button>

                <Button
                  variant="primary"
                  onClick={() => {
                    setTransitionAfterSection(null);
                    onStepChange(safeStepIndex + 1);
                  }}
                >
                  {transitionCopy.ctaLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </Surface>
          </motion.div>
        ) : (
          <motion.div
            key={currentStep.id}
            initial={
              prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={
              prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }
            }
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {currentStep.kind === 'capability_card' ? (
              <CapabilityCardView
                card={currentStep.card}
                totalCards={totalCards}
                answers={answers}
                onSelectOption={onSelectOption}
                onBackCard={handleBack}
                onContinueCard={() => {
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
                              <CheckCircle2
                                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--kws-accent)]"
                                aria-hidden="true"
                              />
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
                  <div className="mt-7 flex items-center justify-between gap-4 border-t border-[var(--kws-border)] pt-5">
                    <Button
                      variant="secondary"
                      onClick={handleBack}
                      disabled={isSubmitting}
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
  );
}
