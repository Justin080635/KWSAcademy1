import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { GROWTH_STAGES } from '../../../domain/assessmentContent.ts';
import type { GrowthStageDefinition, GrowthStageLevel } from '../../../domain/types.ts';
import {
  KWS_DURATIONS,
  KWS_EASE,
  VIEWPORT_REVEAL,
} from '../../ui/motionPrimitives.tsx';

interface GrowthJourneyRadialProps {
  currentStage: GrowthStageDefinition;
  mixedStageFlag: boolean;
  mixedStageObservation: string;
}

const DIAL_SIZE = 296;
const DIAL_CENTER = DIAL_SIZE / 2;
const DIAL_RADIUS = 110;
const START_ANGLE_DEG = 140; // opens gracefully from bottom-left
const TOTAL_SWEEP_DEG = 260; // sweeps clockwise to bottom-right

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
): string {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function GrowthJourneyRadial({
  currentStage,
  mixedStageFlag,
  mixedStageObservation,
}: GrowthJourneyRadialProps) {
  const prefersReducedMotion = useReducedMotion();
  const rawId = useId();
  const gradId = `kws-stage-arc-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [inspectedLevel, setInspectedLevel] = useState<GrowthStageLevel>(
    currentStage.level
  );

  const stageProgressRatio =
    (currentStage.level - 1) / (GROWTH_STAGES.length - 1);
  const activeSweepDeg =
    currentStage.level === 1
      ? 20
      : TOTAL_SWEEP_DEG * stageProgressRatio;
  const activeEndDeg = START_ANGLE_DEG + activeSweepDeg;

  const trackPath = describeArc(
    DIAL_CENTER,
    DIAL_CENTER,
    DIAL_RADIUS,
    START_ANGLE_DEG,
    START_ANGLE_DEG + TOTAL_SWEEP_DEG
  );
  const activePath = describeArc(
    DIAL_CENTER,
    DIAL_CENTER,
    DIAL_RADIUS,
    START_ANGLE_DEG,
    activeEndDeg
  );

  const inspectedStage =
    GROWTH_STAGES.find((s) => s.level === inspectedLevel) ?? currentStage;
  const isViewingCurrent = inspectedStage.level === currentStage.level;

  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
      {/* Left: Radial Stage Orbit Visualization */}
      <div className="flex flex-col items-center lg:col-span-5">
        <div
          className="relative select-none"
          style={{ width: DIAL_SIZE, height: DIAL_SIZE - 26 }}
          role="img"
          aria-label={`Growth stage ${currentStage.level} of 5: ${currentStage.name}`}
        >
          <svg
            width={DIAL_SIZE}
            height={DIAL_SIZE - 26}
            viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE - 26}`}
            className="overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--kws-ring-start)" />
                <stop offset="65%" stopColor="var(--kws-accent)" />
                <stop offset="100%" stopColor="var(--kws-gold)" />
              </linearGradient>
            </defs>

            {/* Full 5-stage track arc */}
            <path
              d={trackPath}
              fill="none"
              stroke="var(--kws-surface-subtle)"
              strokeWidth="14"
              strokeLinecap="round"
            />

            {/* Animated progress arc up to respondent's stage */}
            <motion.path
              d={activePath}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="14"
              strokeLinecap="round"
              initial={prefersReducedMotion ? false : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={VIEWPORT_REVEAL}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.9, ease: KWS_EASE }
              }
            />

            {/* Five stage orbital stops */}
            {GROWTH_STAGES.map((stage, idx) => {
              const frac = idx / (GROWTH_STAGES.length - 1);
              const deg = START_ANGLE_DEG + TOTAL_SWEEP_DEG * frac;
              const pos = polarToCartesian(
                DIAL_CENTER,
                DIAL_CENTER,
                DIAL_RADIUS,
                deg
              );
              const labelPos = polarToCartesian(
                DIAL_CENTER,
                DIAL_CENTER,
                DIAL_RADIUS + 29,
                deg
              );
              const isCurrent = stage.level === currentStage.level;
              const isInspected = stage.level === inspectedLevel;
              const isReached = stage.level <= currentStage.level;

              return (
                <g key={stage.level}>
                  {isCurrent && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="17"
                      fill="var(--kws-gold)"
                      opacity="0.22"
                      className={prefersReducedMotion ? '' : 'kws-halo-pulse'}
                    />
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isCurrent ? 11 : isInspected ? 9.5 : 8}
                    fill={
                      isCurrent
                        ? 'var(--kws-gold)'
                        : isReached
                          ? 'var(--kws-accent)'
                          : 'var(--kws-surface)'
                    }
                    stroke={
                      isCurrent
                        ? 'var(--kws-ink)'
                        : isInspected
                          ? 'var(--kws-accent)'
                          : 'var(--kws-border-strong)'
                    }
                    strokeWidth={isCurrent || isInspected ? 2.5 : 1.5}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 3.5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill={
                      isCurrent
                        ? '#14183a'
                        : isReached
                          ? '#ffffff'
                          : 'var(--kws-muted)'
                    }
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {stage.level}
                  </text>
                  <text
                    x={labelPos.x}
                    y={labelPos.y + 3}
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight={isCurrent ? '700' : '500'}
                    fill={
                      isCurrent ? 'var(--kws-ink)' : 'var(--kws-muted)'
                    }
                  >
                    {stage.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Centered active stage readout */}
          <div className="pointer-events-none absolute inset-x-8 top-[68px] flex flex-col items-center text-center">
            <span className="text-xs font-semibold tracking-wide text-[var(--kws-accent)] tabular-nums">
              Stage {currentStage.level} of {GROWTH_STAGES.length}
            </span>
            <p className="mt-1 font-display text-3xl font-bold text-[var(--kws-ink)]">
              {currentStage.name}
            </p>
            <p className="mt-1.5 max-w-[175px] text-xs leading-snug text-[var(--kws-muted)]">
              Where your momentum sits today
            </p>
          </div>
        </div>

        {/* Interactive Stage Peek Selector */}
        <div
          className="mt-2 flex flex-wrap justify-center gap-1.5"
          role="tablist"
          aria-label="Explore the 5 stages"
        >
          {GROWTH_STAGES.map((stage) => {
            const isCurrent = stage.level === currentStage.level;
            const isInspected = stage.level === inspectedLevel;
            return (
              <button
                key={stage.level}
                type="button"
                role="tab"
                aria-selected={isInspected}
                onClick={() => setInspectedLevel(stage.level)}
                className={`min-h-[34px] rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer tabular-nums ${
                  isCurrent
                    ? 'bg-[var(--kws-accent)] text-[var(--kws-accent-fg)] shadow-sm'
                    : isInspected
                      ? 'border border-[var(--kws-accent)] bg-[var(--kws-tint-bg)] text-[var(--kws-accent)]'
                      : 'border border-[var(--kws-border)] bg-[var(--kws-surface)] text-[var(--kws-muted)] hover:border-[var(--kws-border-strong)] hover:text-[var(--kws-ink)]'
                }`}
              >
                {stage.level}. {stage.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Clean Stage Context & Narrative */}
      <div className="space-y-5 lg:col-span-7">
        <div className="rounded-[22px] border border-[var(--kws-border)] bg-[var(--kws-surface)] p-6 shadow-[var(--kws-shadow-card)] sm:p-7">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={inspectedStage.level}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
              transition={{ duration: KWS_DURATIONS.fast, ease: KWS_EASE }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--kws-accent)] tabular-nums">
                  {isViewingCurrent
                    ? `Your current stage · Stage ${inspectedStage.level} of 5`
                    : `Stage ${inspectedStage.level} of 5 overview`}
                </p>
                {!isViewingCurrent && (
                  <button
                    type="button"
                    onClick={() => setInspectedLevel(currentStage.level)}
                    className="text-xs font-semibold text-[var(--kws-accent)] underline underline-offset-4 hover:text-[var(--kws-accent-hover)] cursor-pointer"
                  >
                    Return to my stage ({currentStage.name})
                  </button>
                )}
              </div>

              <h3 className="mt-2 font-display text-2xl font-bold text-[var(--kws-ink)] sm:text-3xl">
                {inspectedStage.name}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-[var(--kws-ink)]">
                {inspectedStage.description}
              </p>

              <div className="mt-5 grid grid-cols-1 gap-4 border-t border-[var(--kws-border)] pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-[var(--kws-muted)]">
                    What this stage centres on
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--kws-ink)]">
                    {inspectedStage.typicalPriority}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--kws-muted)]">
                    How growth happens here
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--kws-ink)]">
                    {inspectedStage.suggestedProgressDirection}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {mixedStageFlag && (
          <div className="rounded-[20px] border border-[var(--kws-border-strong)] bg-[var(--kws-tint-bg)] p-5">
            <p className="text-xs font-semibold text-[var(--kws-gold-ink)]">
              Between stages
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--kws-ink)]">
              {mixedStageObservation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
