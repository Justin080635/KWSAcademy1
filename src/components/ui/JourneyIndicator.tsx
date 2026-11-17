import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { ASSESSMENT_SECTIONS } from '../../domain/assessmentContent.ts';
import type { AssessmentSectionMeta } from '../../domain/types.ts';
import { KWS_EASE, KWS_SPRING } from './motionPrimitives.tsx';

interface JourneyDotsPillProps {
  orientation?: 'vertical' | 'horizontal';
  activeIndex?: number;
  completedCount?: number;
  ariaLabel: string;
  animateEntrance?: boolean;
  className?: string;
}

export function JourneyDotsPill({
  orientation = 'horizontal',
  activeIndex = 0,
  completedCount = 0,
  ariaLabel,
  animateEntrance = true,
  className = '',
}: JourneyDotsPillProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const isVertical = orientation === 'vertical';

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center rounded-full border border-white/15 bg-[var(--kws-frame)] shadow-[0_8px_22px_-6px_rgba(0,0,0,0.55)] ${
        isVertical ? 'flex-col gap-2.5 px-2.5 py-3.5' : 'flex-row gap-2.5 px-3.5 py-2'
      } ${className}`}
    >
      {[0, 1, 2, 3].map((idx) => {
        const isDone = idx < completedCount;
        const isCurrent = idx === activeIndex && !isDone;
        return (
          <motion.span
            key={idx}
            initial={
              animateEntrance && !prefersReducedMotion
                ? { scale: 0.4, opacity: 0.1 }
                : false
            }
            animate={{ scale: isCurrent ? 1.18 : 1, opacity: 1 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : {
                    duration: 0.36,
                    delay: animateEntrance ? 0.16 + idx * 0.055 : 0,
                    ease: KWS_EASE,
                  }
            }
            aria-hidden="true"
            className={`inline-flex items-center justify-center rounded-full transition-colors duration-200 ${
              isDone
                ? 'h-3.5 w-3.5 bg-[var(--kws-gold-bright)] text-[#29212a]'
                : isCurrent
                  ? 'h-3 w-3 bg-[var(--kws-gold-bright)] ring-[3px] ring-[var(--kws-gold-bright)]/30 shadow-[0_0_10px_rgba(232,206,156,0.65)]'
                  : 'h-2 w-2 bg-white/30'
            }`}
          >
            {isDone && <Check className="h-2.5 w-2.5 stroke-[3]" />}
          </motion.span>
        );
      })}
    </div>
  );
}

interface JourneyIndicatorProps {
  sections?: AssessmentSectionMeta[];
  currentSectionIndex: number;
  completedSectionCount: number;
  progressRatio?: number;
  headerLeft?: string;
  headerRight?: string;
  className?: string;
}

export function JourneyIndicator({
  sections = ASSESSMENT_SECTIONS,
  currentSectionIndex,
  completedSectionCount,
  progressRatio,
  headerLeft,
  headerRight,
  className = '',
}: JourneyIndicatorProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const computedRatio =
    typeof progressRatio === 'number'
      ? progressRatio
      : sections.length <= 1
        ? 1
        : Math.max(
            0,
            Math.min(1, completedSectionCount / (sections.length - 1))
          );

  return (
    <nav aria-label="Discovery journey progress" className={className}>
      {(headerLeft || headerRight) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--kws-muted)] sm:text-sm">
          <span className="font-semibold text-[var(--kws-ink)]">
            {headerLeft}
          </span>
          {headerRight && (
            <span className="tabular-nums text-[var(--kws-muted)]">
              {headerRight}
            </span>
          )}
        </div>
      )}

      <ol className="relative flex items-start justify-between gap-2">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-3.5 right-[12%] left-[12%] h-[3px] overflow-hidden rounded-full bg-[var(--kws-border)]"
        >
          <motion.div
            className={`h-full w-full origin-left rounded-full bg-[image:var(--kws-gradient-btn)] ${
              computedRatio > 0 && !prefersReducedMotion
                ? 'kws-progress-sheen'
                : ''
            }`}
            initial={false}
            animate={{ scaleX: computedRatio }}
            transition={prefersReducedMotion ? { duration: 0 } : KWS_SPRING}
          />
        </div>

        {sections.map((sec, idx) => {
          const isCompleted = idx < completedSectionCount;
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
                    ? 'border-transparent bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)] shadow-xs'
                    : isActive
                      ? 'border-[var(--kws-accent)] bg-[var(--kws-surface)] text-[var(--kws-accent)] ring-4 ring-[var(--kws-accent)]/20 shadow-[0_4px_14px_-4px_var(--kws-shadow-accent)]'
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
  );
}
