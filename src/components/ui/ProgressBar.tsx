import { motion, useReducedMotion } from 'motion/react';

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  accent?: 'primary' | 'gold' | 'success';
}

export function ProgressBar({
  value,
  max,
  label,
  accent = 'primary',
}: ProgressBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.max(0, Math.min(1, value / safeMax));

  const fillColor =
    accent === 'gold'
      ? 'bg-[var(--kws-gold)]'
      : accent === 'success'
        ? 'bg-[var(--kws-success)]'
        : 'bg-[var(--kws-accent)]';

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={value}
      className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--kws-border)]"
    >
      <motion.div
        className={`h-full w-full origin-left rounded-full ${fillColor}`}
        initial={false}
        animate={{ scaleX: ratio }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 260, damping: 28, mass: 0.8 }
        }
      />
    </div>
  );
}
