import { useEffect, useId, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';
import type { CircularMetricSpec, CircularMetricTone } from '../../domain/types.ts';

interface CircularProgressRingProps {
  metric: CircularMetricSpec;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'stacked' | 'inline';
  showLabel?: boolean;
  viewportReveal?: boolean;
  surface?: 'default' | 'onDark';
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

const RING_REVEAL_DURATION_SEC = 2.05;
const RING_EASE_OUT = [0.22, 1, 0.36, 1] as const;

// Completed rings are remembered per route + metric signature so scrolling away,
// parent re-renders, or returning to the results page will not replay animations.
const completedRingKeys = new Set<string>();

function parseDisplayValue(displayValue: string): {
  prefix: string;
  targetNum: number | null;
  suffix: string;
} {
  const match = displayValue.match(/^(\D*?)(\d+)(.*)$/);
  if (!match) {
    return { prefix: '', targetNum: null, suffix: '' };
  }
  return {
    prefix: match[1] ?? '',
    targetNum: Number(match[2]),
    suffix: match[3] ?? '',
  };
}

export function CircularProgressRing({
  metric,
  size = 'md',
  layout = 'stacked',
  showLabel = true,
  viewportReveal = false,
  surface = 'default',
  className = '',
}: CircularProgressRingProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const rawGradientId = useId();
  const gradientId = `kws-ring-${rawGradientId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const cfg = SIZE_CONFIG[size];
  const center = cfg.px / 2;
  const radius = center - cfg.stroke;
  const circumference = 2 * Math.PI * radius;

  const safeMax = Math.max(1, metric.max);
  const clampedValue = Math.max(0, Math.min(safeMax, metric.value));
  const ratio = clampedValue / safeMax;

  const tone: CircularMetricTone = metric.tone ?? 'accent';
  const isGold = tone === 'gold';
  const isSuccess = tone === 'success';
  const isMuted = tone === 'muted';
  const isOnDark = surface === 'onDark';
  const trackStroke = isOnDark
    ? 'rgba(255, 255, 255, 0.2)'
    : 'var(--kws-surface-subtle)';
  const stopStartColor = isGold
    ? 'var(--kws-gold-bright)'
    : isSuccess
      ? 'var(--kws-success)'
      : isMuted
        ? 'var(--kws-border-strong)'
        : isOnDark
          ? '#f0b8dc'
          : 'var(--kws-ring-start)';
  const stopEndColor = isGold
    ? 'var(--kws-gold)'
    : isSuccess
      ? 'var(--kws-success)'
      : isMuted
        ? 'var(--kws-muted)'
        : isOnDark
          ? '#df9ec7'
          : 'var(--kws-ring-end)';

  const segmentsCount =
    metric.segments && metric.segments > 1 && metric.segments <= 12
      ? metric.segments
      : null;

  const filledSegments = segmentsCount
    ? Math.round(ratio * segmentsCount)
    : 0;

  const gapArc = size === 'sm' ? 4 : 7;
  const sliceLength = segmentsCount ? circumference / segmentsCount : 0;
  const segArc = segmentsCount ? Math.max(2, sliceLength - gapArc) : 0;

  const { prefix, targetNum, suffix } = parseDisplayValue(metric.displayValue);
  const routeKey =
    typeof window !== 'undefined' ? window.location.pathname : 'ssr';
  const ringKey = `${routeKey}::${metric.id}::${clampedValue}::${safeMax}::${surface}`;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const continuousCircleRef = useRef<SVGCircleElement | null>(null);
  const segmentRefs = useRef<Array<SVGCircleElement | null>>([]);

  const inView = useInView(containerRef, { once: true, amount: 'some' });
  const shouldStart = !viewportReveal || inView;

  const isCompletedRef = useRef<boolean>(
    prefersReducedMotion || completedRingKeys.has(ringKey)
  );
  const isAnimatingRef = useRef<boolean>(false);
  const currentProgressRef = useRef<number>(
    isCompletedRef.current ? 1 : 0
  );
  const lastRingKeyRef = useRef<string>(ringKey);

  if (lastRingKeyRef.current !== ringKey) {
    lastRingKeyRef.current = ringKey;
    const alreadyDone = prefersReducedMotion || completedRingKeys.has(ringKey);
    isCompletedRef.current = alreadyDone;
    isAnimatingRef.current = false;
    currentProgressRef.current = alreadyDone ? 1 : 0;
  }

  const [shownNum, setShownNum] = useState<number | null>(() => {
    if (targetNum === null) return null;
    return isCompletedRef.current ? targetNum : 0;
  });

  useEffect(() => {
    const applySvgProgress = (p: number) => {
      if (segmentsCount) {
        const filledProgress = p * filledSegments;
        for (let idx = 0; idx < filledSegments; idx += 1) {
          const el = segmentRefs.current[idx];
          if (!el) continue;
          const segFill = Math.max(0, Math.min(1, filledProgress - idx));
          const segOffset = segArc * (1 - segFill);
          const segOpacity = segFill > 0.01 ? 1 : 0;
          el.setAttribute('stroke-dashoffset', String(segOffset));
          el.setAttribute('stroke-opacity', String(segOpacity));
        }
      } else if (continuousCircleRef.current) {
        const currentRatio = ratio * p;
        const nextOffset = circumference * (1 - currentRatio);
        const nextOpacity = currentRatio > 0.001 ? 1 : 0;
        continuousCircleRef.current.setAttribute(
          'stroke-dashoffset',
          String(nextOffset)
        );
        continuousCircleRef.current.setAttribute(
          'stroke-opacity',
          String(nextOpacity)
        );
      }
    };

    if (prefersReducedMotion || completedRingKeys.has(ringKey)) {
      isCompletedRef.current = true;
      isAnimatingRef.current = false;
      currentProgressRef.current = 1;
      applySvgProgress(1);
      if (targetNum !== null) {
        setShownNum(targetNum);
      }
      return;
    }

    if (isCompletedRef.current) {
      applySvgProgress(1);
      if (targetNum !== null) {
        setShownNum(targetNum);
      }
      return;
    }

    if (!shouldStart) {
      currentProgressRef.current = 0;
      applySvgProgress(0);
      if (targetNum !== null) {
        setShownNum(0);
      }
      return;
    }

    if (ratio <= 0 || (segmentsCount !== null && filledSegments <= 0)) {
      isCompletedRef.current = true;
      isAnimatingRef.current = false;
      currentProgressRef.current = 1;
      completedRingKeys.add(ringKey);
      applySvgProgress(0);
      if (targetNum !== null) {
        setShownNum(targetNum);
      }
      return;
    }

    if (isAnimatingRef.current) {
      return;
    }

    isAnimatingRef.current = true;
    currentProgressRef.current = 0;
    applySvgProgress(0);
    if (targetNum !== null) {
      setShownNum(0);
    }

    let lastRenderedNum = 0;
    const controls = animate(0, 1, {
      duration: RING_REVEAL_DURATION_SEC,
      ease: RING_EASE_OUT,
      onUpdate(latest) {
        const clampedP = Math.max(0, Math.min(1, latest));
        currentProgressRef.current = clampedP;
        applySvgProgress(clampedP);
        if (targetNum !== null) {
          const nextNum = Math.round(clampedP * targetNum);
          if (nextNum !== lastRenderedNum) {
            lastRenderedNum = nextNum;
            setShownNum(nextNum);
          }
        }
      },
      onComplete() {
        isAnimatingRef.current = false;
        isCompletedRef.current = true;
        currentProgressRef.current = 1;
        completedRingKeys.add(ringKey);
        applySvgProgress(1);
        if (targetNum !== null) {
          setShownNum(targetNum);
        }
      },
    });

    return () => {
      controls.stop();
      if (!isCompletedRef.current) {
        isAnimatingRef.current = false;
      }
    };
  }, [
    ringKey,
    shouldStart,
    prefersReducedMotion,
    ratio,
    circumference,
    segmentsCount,
    filledSegments,
    segArc,
    targetNum,
  ]);

  const renderProgress = isCompletedRef.current ? 1 : currentProgressRef.current;
  const renderRatio = ratio * renderProgress;
  const renderDashOffset = circumference * (1 - renderRatio);
  const renderStrokeOpacity = renderRatio > 0.001 ? 1 : 0;

  const formattedDisplay =
    targetNum === null || prefersReducedMotion || shownNum === null
      ? metric.displayValue
      : `${prefix}${shownNum}${suffix}`;

  const valueTextSize =
    size === 'lg' && metric.displayValue.length > 6
      ? 'text-lg'
      : size === 'md' && metric.displayValue.length > 6
        ? 'text-sm'
        : cfg.valueClass;

  return (
    <div
      ref={containerRef}
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
              <stop offset="0%" stopColor={stopStartColor} />
              <stop offset="100%" stopColor={stopEndColor} />
            </linearGradient>
          </defs>

          {segmentsCount ? (
            <>
              {Array.from({ length: segmentsCount }, (_, idx) => {
                const rotationDeg = (idx / segmentsCount) * 360;
                return (
                  <circle
                    key={`track-${idx}`}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={trackStroke}
                    strokeWidth={cfg.stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${segArc} ${circumference}`}
                    transform={`rotate(${rotationDeg} ${center} ${center})`}
                  />
                );
              })}
              {Array.from({ length: filledSegments }, (_, idx) => {
                const rotationDeg = (idx / segmentsCount) * 360;
                const segFill = Math.max(
                  0,
                  Math.min(1, renderProgress * filledSegments - idx)
                );
                const segOffset = segArc * (1 - segFill);
                const segOpacity = segFill > 0.01 ? 1 : 0;

                return (
                  <circle
                    key={`fill-${idx}`}
                    ref={(el) => {
                      segmentRefs.current[idx] = el;
                    }}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={cfg.stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${segArc} ${circumference}`}
                    strokeDashoffset={segOffset}
                    strokeOpacity={segOpacity}
                    transform={`rotate(${rotationDeg} ${center} ${center})`}
                  />
                );
              })}
            </>
          ) : (
            <>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={trackStroke}
                strokeWidth={cfg.stroke}
              />
              <circle
                ref={continuousCircleRef}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={cfg.stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={renderDashOffset}
                strokeOpacity={renderStrokeOpacity}
              />
            </>
          )}
        </svg>

        <div className="absolute inset-0 flex items-center justify-center px-2">
          <span
            className={`font-display font-bold leading-none tabular-nums ${
              isOnDark ? 'text-white' : 'text-[var(--kws-ink)]'
            } ${valueTextSize}`}
          >
            {formattedDisplay}
          </span>
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
