import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { CircularMetricSpec, CircularMetricTone } from '../../domain/types.ts';
import {
  AnimatedCountValue,
  KWS_EASE,
  VIEWPORT_REVEAL,
} from './motionPrimitives.tsx';

interface CircularProgressRingProps {
  metric: CircularMetricSpec;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'stacked' | 'inline';
  showLabel?: boolean;
  viewportReveal?: boolean;
  className?: string;
}

const SIZE_CONFIG: Record<
  'sm' | 'md' | 'lg',
  { px: number; stroke: number; valueClass: string }
> = {
  sm: { px: 52, stroke: 4.5, valueClass: 'text-xs' },
  md: { px: 96, stroke: 7.5, valueClass: 'text-lg' },
  lg: { px: 120, stroke: 9, valueClass: 'text-2xl' },
};

export function CircularProgressRing({
  metric,
  size = 'md',
  layout = 'stacked',
  showLabel = true,
  viewportReveal = false,
  className = '',
}: CircularProgressRingProps) {
  const prefersReducedMotion = useReducedMotion();
  const rawGradientId = useId();
  const gradientId = `kws-ring-${rawGradientId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const cfg = SIZE_CONFIG[size];
  const center = cfg.px / 2;
  const radius = center - cfg.stroke;
  const circumference = 2 * Math.PI * radius;

  const safeMax = Math.max(1, metric.max);
  const clampedValue = Math.max(0, Math.min(safeMax, metric.value));
  const ratio = clampedValue / safeMax;
  const dashOffset = circumference * (1 - ratio);

  const tone: CircularMetricTone = metric.tone ?? 'accent';
  const isGold = tone === 'gold';

  const segmentsCount =
    metric.segments && metric.segments > 1 && metric.segments <= 12
      ? metric.segments
      : null;

  const filledSegments = segmentsCount
    ? Math.round(ratio * segmentsCount)
    : 0;

  const valueTextSize =
    size === 'lg' && metric.displayValue.length > 6
      ? 'text-lg'
      : size === 'md' && metric.displayValue.length > 6
        ? 'text-sm'
        : cfg.valueClass;

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
          <defs>
            <linearGradient
              id={gradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop
                offset="0%"
                stopColor={isGold ? '#ffd166' : 'var(--kws-ring-start)'}
              />
              <stop
                offset="100%"
                stopColor={isGold ? 'var(--kws-gold)' : 'var(--kws-ring-end)'}
              />
            </linearGradient>
          </defs>

          {segmentsCount ? (
            Array.from({ length: segmentsCount }, (_, idx) => {
              const gapArc = size === 'sm' ? 4 : 7;
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
                  stroke={
                    isFilled
                      ? `url(#${gradientId})`
                      : 'var(--kws-surface-subtle)'
                  }
                  strokeWidth={cfg.stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${segArc} ${circumference}`}
                  transform={`rotate(${rotationDeg} ${center} ${center})`}
                  initial={
                    prefersReducedMotion
                      ? false
                      : { opacity: isFilled ? 0.25 : 1 }
                  }
                  animate={viewportReveal ? undefined : { opacity: 1 }}
                  whileInView={viewportReveal ? { opacity: 1 } : undefined}
                  viewport={viewportReveal ? VIEWPORT_REVEAL : undefined}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.34,
                          delay: idx * 0.06,
                          ease: KWS_EASE,
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
                stroke="var(--kws-surface-subtle)"
                strokeWidth={cfg.stroke}
              />
              <motion.circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={cfg.stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={
                  prefersReducedMotion
                    ? false
                    : { strokeDashoffset: circumference }
                }
                animate={
                  viewportReveal ? undefined : { strokeDashoffset: dashOffset }
                }
                whileInView={
                  viewportReveal ? { strokeDashoffset: dashOffset } : undefined
                }
                viewport={viewportReveal ? VIEWPORT_REVEAL : undefined}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.78, ease: KWS_EASE }
                }
              />
            </>
          )}
        </svg>

        <div className="absolute inset-0 flex items-center justify-center px-2">
          <AnimatedCountValue
            displayValue={metric.displayValue}
            viewportReveal={viewportReveal}
            className={`font-display font-bold leading-none tabular-nums text-[var(--kws-ink)] ${valueTextSize}`}
          />
        </div>
      </div>

      {showLabel && (
        <div
          className={
            layout === 'inline' ? 'min-w-0 flex-1' : 'mt-2.5 max-w-[200px]'
          }
        >
          <p className="text-xs font-semibold leading-snug text-[var(--kws-ink)] sm:text-sm">
            {metric.label}
          </p>
          {metric.sublabel && (
            <p className="mt-0.5 text-xs leading-snug text-[var(--kws-muted)]">
              {metric.sublabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
