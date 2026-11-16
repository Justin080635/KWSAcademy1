import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  animate,
  motion,
  useInView,
  useReducedMotion,
} from 'motion/react';

export const KWS_EASE = [0.16, 1, 0.3, 1] as const;

export const KWS_SPRING = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 30,
  mass: 0.85,
};

export const KWS_DURATIONS = {
  fast: 0.16,
  base: 0.22,
  reveal: 0.45,
  hero: 0.62,
} as const;

export const VIEWPORT_REVEAL = {
  once: true,
  amount: 'some' as const,
};

interface RevealBlockProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  scale?: number;
  viewport?: boolean;
}

export function RevealBlock({
  children,
  className = '',
  delay = 0,
  y = 12,
  scale = 0.99,
  viewport = true,
}: RevealBlockProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y, scale }}
      animate={viewport ? undefined : { opacity: 1, y: 0, scale: 1 }}
      whileInView={viewport ? { opacity: 1, y: 0, scale: 1 } : undefined}
      viewport={viewport ? VIEWPORT_REVEAL : undefined}
      transition={{
        duration: KWS_DURATIONS.reveal,
        delay,
        ease: KWS_EASE,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedCountValueProps {
  displayValue: string;
  viewportReveal?: boolean;
  className?: string;
}

/**
 * Briefly animates leading numeric digits (e.g. "4" or "3/4") up to their
 * exact final value upon reveal, while strictly honoring reduced motion and
 * never altering non-numeric display strings.
 */
export function AnimatedCountValue({
  displayValue,
  viewportReveal = false,
  className = '',
}: AnimatedCountValueProps) {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 'some' });

  const match = displayValue.match(/^(\d+)(\/\d+)?$/);
  const targetNum = match ? Number(match[1]) : null;
  const suffix = match?.[2] ?? '';

  const [shownNum, setShownNum] = useState<number | null>(() =>
    prefersReducedMotion || targetNum === null ? targetNum : 0
  );

  const shouldRun = !viewportReveal || inView;

  useEffect(() => {
    if (targetNum === null || prefersReducedMotion) {
      setShownNum(targetNum);
      return;
    }
    if (!shouldRun) return;
    if (targetNum === 0) {
      setShownNum(0);
      return;
    }

    const controls = animate(0, targetNum, {
      duration: 0.62,
      ease: KWS_EASE,
      onUpdate(latest) {
        setShownNum(Math.round(latest));
      },
      onComplete() {
        setShownNum(targetNum);
      },
    });

    return () => controls.stop();
  }, [targetNum, shouldRun, prefersReducedMotion]);

  if (targetNum === null || prefersReducedMotion || shownNum === null) {
    return <span ref={ref} className={className}>{displayValue}</span>;
  }

  return (
    <span ref={ref} className={className}>
      {shownNum}
      {suffix}
    </span>
  );
}
