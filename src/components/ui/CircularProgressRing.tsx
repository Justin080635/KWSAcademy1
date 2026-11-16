import { motion, useReducedMotion } from 'motion/react';
import type { CircularMetricSpec, CircularMetricTone } from '../../domain/types.ts';

interface CircularProgressRingProps {
  metric: CircularMetricSpec;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'stacked' | 'inline';
  showLabel?: boolean;
  className?: string;
}

const SIZE_CONFIG: Record<
  'sm' | 'md' | 'lg',
  { px: number; stroke: number; valueClass: string }
> = {
  sm: { px: 52, stroke: 4.5, valueClass: 'text-xs' },
  md: { px: 88, stroke: 6, valueClass: 'text-base' },
  lg: { px: 108, stroke: 7, valueClass: 'text-lg' },
};

const TONE_STROKE: Record<CircularMetricTone, string> = {
  accent: 'var(--kws-accent)',
  gold: 'var(--kws-gold)',
  success: 'var(--kws-success)',
  muted: 'var(--kws-muted)',
};

export function CircularProgressRing({
  metric,
  size = 'md',
  layout = 'stacked',
  showLabel = true,
  className = '',
}: CircularProgressRingProps) {
  const prefersReducedMotion = useReducedMotion();
  const cfg = SIZE_CONFIG[size];
  const center = cfg.px / 2;
  const radius = center - cfg.stroke;
  const circumference = 2 * Math.PI * radius;

  const safeMax = Math.max(1, metric.max);
  const clampedValue = Math.max(0, Math.min(safeMax, metric.value));
  const ratio = clampedValue / safeMax;
  const dashOffset = circumference * (1 - ratio);
  const strokeColor = TONE_STROKE[metric.tone] ?? TONE_STROKE.accent;

  const segmentsCount =
    metric.segments && metric.segments > 1 && metric.segments <= 12
      ? metric.segments
      : null;

  const filledSegments = segmentsCount
    ? Math.round(ratio * segmentsCount)
    : 0;

  return (
    <div
      className={`flex ${
        layout === 'inline'
          ? 'flex-row items-center gap-3.5 text-left'
          : 'flex-col items-center text-center'
      } ${className}`}
    >
      <div
        role="img"
        aria-label={`${metric.label}: ${metric.displayValue}. ${metric.sublabel}`}
        className="relative shrink-0"
        style={{ width: cfg.px, height: cfg.px }}
      >
        <svg
          width={cfg.px}
          height={cfg.px}
          viewBox={`0 0 ${cfg.px} ${cfg.px}`}
          className="-rotate-90 transform"
          aria-hidden="true"
        >
          {segmentsCount ? (
            Array.from({ length: segmentsCount }, (_, idx) => {
              const gapArc = size === 'sm' ? 4 : 6;
              const sliceLength = circumference / segmentsCount;
              const segArc = Math.max(2, sliceLength - gapArc);
              const rotationDeg = (idx / segmentsCount) * 360;
              const isFilled = idx < filledSegments;

              return (
                <motion.circle
                  key={idx}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={isFilled ? strokeColor : 'var(--kws-border)'}
                  strokeWidth={cfg.stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${segArc} ${circumference}`}
                  transform={`rotate(${rotationDeg} ${center} ${center})`}
                  initial={
                    prefersReducedMotion
                      ? false
                      : { opacity: isFilled ? 0.35 : 1 }
                  }
                  animate={{ opacity: 1 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.25,
                          delay: idx * 0.04,
                          ease: [0.16, 1, 0.3, 1],
                        }
                  }
                />
              );
            })
          ) : (
            <>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="var(--kws-border)"
                strokeWidth={cfg.stroke}
                strokeDasharray={metric.isPending ? '4 4' : undefined}
              />
              <motion.circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={strokeColor}
                strokeWidth={cfg.stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={
                  prefersReducedMotion
                    ? false
                    : { strokeDashoffset: circumference }
                }
                animate={{ strokeDashoffset: dashOffset }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.65, ease: [0.16, 1, 0.3, 1] }
                }
              />
            </>
          )}
        </svg>

        <div className="absolute inset-0 flex items-center justify-center px-1.5">
          <span
            className={`font-mono-tabular font-bold leading-none text-[var(--kws-ink)] ${cfg.valueClass}`}
          >
            {metric.displayValue}
          </span>
        </div>
      </div>

      {showLabel && (
        <div className={layout === 'inline' ? 'min-w-0 flex-1' : 'mt-2 max-w-[180px]'}>
          <p className="text-xs font-semibold leading-snug text-[var(--kws-ink)]">
            {metric.label}
          </p>
          {metric.sublabel && (
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--kws-muted)]">
              {metric.sublabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
