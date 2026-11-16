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
  const subDirectionRef = useRef<1 | -1>(1);

  useEffect(() => {
    subDirectionRef.current = 1;
    setSubStep(
      selectedUnderstanding && selectedExperience
        ? 'experience'
        : 'understanding'
    );
  }, [card.id]);

  const activeQuestion =
    subStep === 'understanding'
      ? card.understandingQuestion
      : card.experienceQuestion;
  const activeSelection = answers.selections[activeQuestion.id];

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
      if (!selectedUnderstanding) return;
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
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    if (!selectedUnderstanding || !selectedExperience) return;
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
    <Surface className="p-5 sm:p-7">
      {/* Capability Card Header */}
      <div className="border-b border-[var(--kws-border)] pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono-tabular text-xs font-semibold text-[var(--kws-accent)]">
            Capability {card.index} of {totalCards}
          </p>
          <p className="text-xs text-[var(--kws-muted)]">
            Understanding &amp; Practical Experience are distinct dimensions
          </p>
        </div>

        <h2 className="mt-1.5 font-display text-xl font-bold text-[var(--kws-ink)] sm:text-2xl">
          {card.pillar.name}
        </h2>

        {/* Sequential Two-Dimension Stepper inside Card */}
        <div
          role="tablist"
          aria-label="Capability dimensions"
          className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-[var(--kws-bg)] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subStep === 'understanding'}
            onClick={() => {
              subDirectionRef.current = -1;
              setSubStep('understanding');
            }}
            className={`flex min-h-[44px] items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors cursor-pointer ${
              subStep === 'understanding'
                ? 'bg-[var(--kws-surface)] text-[var(--kws-ink)] shadow-xs'
                : 'text-[var(--kws-muted)] hover:text-[var(--kws-ink)]'
            }`}
          >
            <span className="truncate">A. Understanding</span>
            {selectedUnderstanding && (
              <CheckCircle2
                className="h-3.5 w-3.5 shrink-0 text-[var(--kws-success)]"
                aria-hidden="true"
              />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subStep === 'experience'}
            disabled={!selectedUnderstanding}
            onClick={() => {
              if (selectedUnderstanding) {
                subDirectionRef.current = 1;
                setSubStep('experience');
              }
            }}
            className={`flex min-h-[44px] items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors ${
              !selectedUnderstanding
                ? 'cursor-not-allowed text-[var(--kws-muted)]/50'
                : subStep === 'experience'
                  ? 'bg-[var(--kws-surface)] text-[var(--kws-ink)] shadow-xs cursor-pointer'
                  : 'text-[var(--kws-muted)] hover:text-[var(--kws-ink)] cursor-pointer'
            }`}
          >
            <span className="truncate">
              <span className="sm:hidden">B. Experience</span>
              <span className="hidden sm:inline">B. Practical Experience</span>
            </span>
            {selectedExperience && (
              <CheckCircle2
                className="h-3.5 w-3.5 shrink-0 text-[var(--kws-success)]"
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </div>

      {/* Active Dimension Prompt & Options */}
      <div className="mt-5 overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={subDirectionRef.current}>
          <motion.div
            key={activeQuestion.id}
            custom={subDirectionRef.current}
            initial={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 0, x: subDirectionRef.current * 24 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 0, x: subDirectionRef.current * -20 }
            }
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs font-semibold text-[var(--kws-muted)]">
              {subStep === 'understanding'
                ? 'Part A · Understanding scenario'
                : 'Part B · Your practical experience'}
            </p>

            <h1 className="mt-1.5 font-display text-lg font-bold leading-snug text-[var(--kws-ink)] sm:text-xl [text-wrap:balance]">
              {activeQuestion.prompt}
            </h1>

            <div
              role="radiogroup"
              aria-label={activeQuestion.prompt}
              className="mt-4 space-y-2.5"
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
                      <span className="text-[var(--kws-ink)]">{opt.label}</span>
                    </div>

                    {isSelected && (
                      <motion.span
                        initial={prefersReducedMotion ? false : { scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
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
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Explicit Card Controls */}
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
          onClick={handleContinue}
          disabled={!activeSelection}
          className="w-full sm:w-auto"
        >
          {subStep === 'understanding'
            ? 'Continue to Practical Experience'
            : 'Continue'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </Surface>
  );
}
