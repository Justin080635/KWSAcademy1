import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { CAPABILITY_CARDS } from '../../domain/assessmentContent.ts';
import type {
  AssessmentSectionId,
  CapabilityCardDefinition,
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

interface CapabilityCardViewProps {
  card: CapabilityCardDefinition;
  totalCards?: number;
  answers: RespondentAnswers;
  onSelectOption: (
    questionId: string,
    optionId: string,
    sectionId?: AssessmentSectionId
  ) => void;
  onBackCard: () => void;
  onContinueCard: () => void;
  onEmitTelemetry?: (events: QuestionTelemetryInput[]) => void;
  onAbandonmentBeacon?: (event: QuestionTelemetryInput) => void;
}

const OPTION_LETTERS = 'ABCDEFGH';

export function CapabilityCardView({
  card,
  totalCards = CAPABILITY_CARDS.length,
  answers,
  onSelectOption,
  onBackCard,
  onContinueCard,
  onEmitTelemetry,
  onAbandonmentBeacon,
}: CapabilityCardViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const understandingId = card.understandingQuestion.id;
  const experienceId = card.experienceQuestion.id;
  const selectedUnderstanding = answers.selections[understandingId];
  const selectedExperience = answers.selections[experienceId];

  const [subStep, setSubStep] = useState<'understanding' | 'experience'>(() =>
    selectedUnderstanding && selectedExperience
      ? 'experience'
      : 'understanding'
  );
  const [showMissingHint, setShowMissingHint] = useState(false);
  const subDirectionRef = useRef<1 | -1>(1);
  const subStepRegionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    subDirectionRef.current = 1;
    setShowMissingHint(false);
    setSubStep(
      selectedUnderstanding && selectedExperience
        ? 'experience'
        : 'understanding'
    );
  }, [card.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'instant' : 'smooth',
    });
    const timer = window.setTimeout(() => {
      const container = subStepRegionRef.current;
      if (!container) return;
      const firstOption = container.querySelector<HTMLElement>('[role="radio"]');
      if (firstOption) {
        firstOption.focus({ preventScroll: true });
        return;
      }
      const heading = container.querySelector<HTMLElement>('h1');
      heading?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [card.id, subStep, prefersReducedMotion]);

  const activeQuestion =
    subStep === 'understanding'
      ? card.understandingQuestion
      : card.experienceQuestion;
  const activeSelection = answers.selections[activeQuestion.id];

  useEffect(() => {
    if (activeSelection) {
      setShowMissingHint(false);
    }
  }, [activeSelection]);

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
    activeQuestion.id,
    'strengths_growth',
    handleLeaveAbandon
  );

  useEffect(() => {
    onEmitTelemetry?.([
      {
        eventType: 'question_displayed',
        sectionId: 'strengths_growth',
        questionId: activeQuestion.id,
      },
    ]);
  }, [activeQuestion.id, onEmitTelemetry]);

  const handleBack = () => {
    setShowMissingHint(false);
    const timing = getTimingSnapshot();
    markProgressed();
    onEmitTelemetry?.([
      {
        eventType: 'back_clicked',
        sectionId: 'strengths_growth',
        questionId: activeQuestion.id,
        activeTimeMs: timing.activeTimeMs,
        inactiveTimeMs: timing.inactiveTimeMs,
        wallTimeMs: timing.wallTimeMs,
      },
    ]);
    if (subStep === 'experience') {
      subDirectionRef.current = -1;
      setSubStep('understanding');
      return;
    }
    onBackCard();
  };

  const handleContinue = () => {
    const timing = getTimingSnapshot();
    if (subStep === 'understanding') {
      if (!selectedUnderstanding) {
        setShowMissingHint(true);
        return;
      }
      setShowMissingHint(false);
      markProgressed();
      onEmitTelemetry?.([
        {
          eventType: 'continue_clicked',
          sectionId: 'strengths_growth',
          questionId: activeQuestion.id,
          optionId: selectedUnderstanding,
          activeTimeMs: timing.activeTimeMs,
          inactiveTimeMs: timing.inactiveTimeMs,
          wallTimeMs: timing.wallTimeMs,
        },
      ]);
      subDirectionRef.current = 1;
      setSubStep('experience');
      if (typeof window !== 'undefined' && window.scrollY > 24) {
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });
      }
      return;
    }
    if (!selectedUnderstanding || !selectedExperience) {
      setShowMissingHint(true);
      return;
    }
    setShowMissingHint(false);
    markProgressed();
    onEmitTelemetry?.([
      {
        eventType: 'continue_clicked',
        sectionId: 'strengths_growth',
        questionId: activeQuestion.id,
        optionId: selectedExperience,
        activeTimeMs: timing.activeTimeMs,
        inactiveTimeMs: timing.inactiveTimeMs,
        wallTimeMs: timing.wallTimeMs,
      },
    ]);
    onContinueCard();
  };

  return (
    <div>
      <Surface className="rounded-[24px] p-6 sm:p-8">
        {/* Card Header with locked capability name */}
        <div className="border-b border-[var(--kws-border)] pb-4 sm:pb-5">
          <p className="text-xs font-medium tabular-nums text-[var(--kws-muted)]">
            Part C · {card.index} of {totalCards}
          </p>

          <h2 className="mt-1.5 font-display text-xl font-bold leading-snug text-[var(--kws-ink)] sm:text-2xl">
            {card.pillar.name}
          </h2>

          {/* Sequential Two-Step Tabs (plain labels, gliding pill indicator) */}
          <div
            role="tablist"
            aria-label="Strength card steps"
            className="mt-4 grid grid-cols-2 gap-1.5 rounded-full border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={subStep === 'understanding'}
              onClick={() => {
                setShowMissingHint(false);
                subDirectionRef.current = -1;
                setSubStep('understanding');
              }}
              className={`relative flex min-h-[42px] items-center justify-center rounded-full px-3.5 py-2 text-center text-xs font-semibold transition-colors cursor-pointer sm:min-h-[44px] sm:px-4 ${
                subStep === 'understanding'
                  ? 'text-[var(--kws-ink)]'
                  : 'text-[var(--kws-muted)] hover:text-[var(--kws-ink)]'
              }`}
            >
              {subStep === 'understanding' && (
                <motion.span
                  layoutId={`cap-tab-pill-${card.id}`}
                  transition={prefersReducedMotion ? { duration: 0 } : KWS_SPRING}
                  className="absolute inset-0 rounded-full bg-[var(--kws-surface)] shadow-xs"
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10 truncate">
                <span className="sm:hidden">What you know</span>
                <span className="hidden sm:inline">
                  Understanding · what you know
                </span>
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={subStep === 'experience'}
              disabled={!selectedUnderstanding}
              onClick={() => {
                if (selectedUnderstanding) {
                  setShowMissingHint(false);
                  subDirectionRef.current = 1;
                  setSubStep('experience');
                }
              }}
              className={`relative flex min-h-[42px] items-center justify-center rounded-full px-3.5 py-2 text-center text-xs font-semibold transition-colors sm:min-h-[44px] sm:px-4 ${
                !selectedUnderstanding
                  ? 'cursor-not-allowed text-[var(--kws-muted)]/50'
                  : subStep === 'experience'
                    ? 'text-[var(--kws-ink)] cursor-pointer'
                    : 'text-[var(--kws-muted)] hover:text-[var(--kws-ink)] cursor-pointer'
              }`}
            >
              {subStep === 'experience' && (
                <motion.span
                  layoutId={`cap-tab-pill-${card.id}`}
                  transition={prefersReducedMotion ? { duration: 0 } : KWS_SPRING}
                  className="absolute inset-0 rounded-full bg-[var(--kws-surface)] shadow-xs"
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10 truncate">
                <span className="sm:hidden">What you’ve done</span>
                <span className="hidden sm:inline">
                  Experience · what you’ve done
                </span>
              </span>
            </button>
          </div>
        </div>

        {/* Active Step Prompt & Options */}
        <div ref={subStepRegionRef} className="mt-5 overflow-hidden sm:mt-6">
          <AnimatePresence mode="wait" initial={false} custom={subDirectionRef.current}>
            <motion.div
              key={activeQuestion.id}
              custom={subDirectionRef.current}
              initial={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 0, x: subDirectionRef.current * 20, scale: 0.988 }
              }
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 0, x: subDirectionRef.current * -16, scale: 0.992 }
              }
              transition={{ duration: KWS_DURATIONS.base, ease: KWS_EASE }}
            >
              <p
                className={`text-xs font-semibold ${
                  subStep === 'understanding'
                    ? 'text-[var(--kws-accent)]'
                    : 'text-[var(--kws-gold-ink)]'
                }`}
              >
                {subStep === 'understanding'
                  ? 'What you know'
                  : 'What you’ve done'}
              </p>

              <h1
                tabIndex={-1}
                className="mt-2 font-display text-xl font-bold leading-snug text-[var(--kws-ink)] sm:text-2xl [text-wrap:balance]"
              >
                {activeQuestion.prompt}
              </h1>

              <div
                role="radiogroup"
                aria-label={activeQuestion.prompt}
                className="mt-5 space-y-3"
              >
                {activeQuestion.options.map((opt, idx) => {
                  const isSelected = activeSelection === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() =>
                        onSelectOption(
                          activeQuestion.id,
                          opt.id,
                          'strengths_growth'
                        )
                      }
                      className={`group flex w-full min-h-[60px] items-center justify-between gap-3 rounded-[20px] border-2 px-4 py-3.5 text-left transition-[transform,box-shadow,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer active:scale-[0.988] sm:min-h-[64px] sm:gap-4 sm:px-5 sm:py-4 ${
                        isSelected
                          ? 'border-[var(--kws-accent)] bg-[var(--kws-tint-bg)] ring-4 ring-[var(--kws-accent)]/15 shadow-[0_10px_24px_-10px_var(--kws-shadow-accent)]'
                          : 'border-[var(--kws-border)] bg-[var(--kws-surface)] hover:-translate-y-0.5 hover:border-[var(--kws-border-strong)] hover:bg-[var(--kws-tint-bg)]/45 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-sm leading-relaxed sm:gap-3.5 sm:text-base">
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] sm:text-sm ${
                            isSelected
                              ? 'scale-105 bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)] shadow-xs'
                              : 'bg-[var(--kws-surface-subtle)] text-[var(--kws-muted)] group-hover:scale-105 group-hover:text-[var(--kws-ink)]'
                          }`}
                        >
                          {opt.key ?? OPTION_LETTERS[idx]}
                        </span>
                        <span className="font-medium text-[var(--kws-ink)]">
                          {opt.label}
                        </span>
                      </div>

                      {isSelected && (
                        <motion.span
                          initial={prefersReducedMotion ? false : { scale: 0.65, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={prefersReducedMotion ? { duration: 0 } : KWS_SPRING}
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
            </motion.div>
          </AnimatePresence>
        </div>
      </Surface>

      {/* Sticky Bottom Mobile Action Bar — Disabled Continue Always Shows Quiet Helper */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-4 bg-gradient-to-t from-[var(--kws-bg)] via-[var(--kws-bg)]/95 to-transparent px-4 pt-6 pb-[calc(16px+env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mt-6 sm:bg-none sm:p-0">
        <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-col gap-1.5 sm:flex-row-reverse sm:items-center sm:gap-3">
            <Button
              variant="primary"
              allowWrap
              disabled={!activeSelection}
              aria-describedby={
                !activeSelection ? 'kws-cap-continue-helper' : undefined
              }
              onClick={handleContinue}
              className="w-full min-h-[56px] justify-between px-6 sm:w-auto sm:min-w-[180px] sm:justify-center"
            >
              <span>Continue</span>
              <ArrowRight
                className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Button>

            {!activeSelection && (
              <p
                id="kws-cap-continue-helper"
                role="status"
                className="text-center text-xs font-medium text-[var(--kws-muted)] sm:text-right sm:text-sm"
              >
                Pick an answer to keep going.
              </p>
            )}
          </div>

          <Button
            variant="secondary"
            allowWrap
            onClick={handleBack}
            className="w-full min-h-[48px] px-6 sm:w-auto"
          >
            <ArrowLeft
              className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
              aria-hidden="true"
            />
            <span>Back</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
