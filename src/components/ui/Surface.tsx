import type { ReactNode } from 'react';

interface SurfaceProps {
  children: ReactNode;
  className?: string;
  subtle?: boolean;
  id?: string;
}

export function Surface({
  children,
  className = '',
  subtle = false,
  id,
}: SurfaceProps) {
  return (
    <div
      id={id}
      className={`rounded-[22px] border border-[var(--kws-border)] ${
        subtle
          ? 'bg-[var(--kws-surface-subtle)]'
          : 'bg-[var(--kws-surface)] shadow-[var(--kws-shadow-card)]'
      } ${className}`}
    >
      {children}
    </div>
  );
}
