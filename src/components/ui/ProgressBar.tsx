interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  accent?: 'primary' | 'gold';
}

export function ProgressBar({
  value,
  max,
  label,
  accent = 'primary',
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, Math.round((value / safeMax) * 100)));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={value}
      className="h-2 w-full overflow-hidden rounded-full bg-[var(--kws-border)]"
    >
      <div
        className={`h-full transition-all duration-300 ease-out ${
          accent === 'gold'
            ? 'bg-[var(--kws-gold)]'
            : 'bg-[var(--kws-accent)]'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
