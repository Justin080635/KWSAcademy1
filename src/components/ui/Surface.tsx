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
      className={`rounded-xl border border-[var(--kws-border)] ${
        subtle ? 'bg-[var(--kws-surface-subtle)]' : 'bg-[var(--kws-surface)]'
      } ${className}`}
    >
      {children}
    </div>
  );
}
