import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap shrink-0 rounded-lg transition-all duration-150 ease-out cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.99]';

  const sizing =
    size === 'lg'
      ? 'px-6 py-3 text-base min-h-[46px]'
      : 'px-4 py-2 text-sm min-h-[40px]';

  const variants = {
    primary:
      'bg-[var(--kws-accent)] text-[var(--kws-accent-fg)] hover:bg-[var(--kws-accent-hover)] shadow-xs',
    secondary:
      'bg-[var(--kws-surface)] text-[var(--kws-ink)] border border-[var(--kws-border-strong)] hover:border-[var(--kws-accent)] hover:bg-[var(--kws-surface-subtle)]',
    ghost:
      'bg-transparent text-[var(--kws-muted)] hover:text-[var(--kws-ink)] hover:bg-[var(--kws-surface-subtle)]',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${sizing} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
