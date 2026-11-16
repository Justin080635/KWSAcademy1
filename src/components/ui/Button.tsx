import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  allowWrap?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  allowWrap = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const base = `group inline-flex items-center justify-center gap-2 font-semibold ${
    allowWrap ? 'whitespace-normal text-center leading-snug' : 'whitespace-nowrap'
  } shrink-0 rounded-full transition-[transform,box-shadow,background-color,border-color,color,opacity,filter] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none active:scale-[0.975]`;

  const sizing =
    size === 'lg'
      ? 'px-7 py-3.5 text-base min-h-[48px]'
      : size === 'sm'
        ? 'px-4 py-2 text-xs min-h-[36px]'
        : 'px-5 py-2.5 text-sm min-h-[42px]';

  const variants = {
    primary:
      'bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)] shadow-[0_10px_24px_-8px_var(--kws-shadow-accent)] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_28px_-8px_var(--kws-shadow-accent)]',
    secondary:
      'bg-[var(--kws-surface)] text-[var(--kws-ink)] border border-[var(--kws-border-strong)] hover:-translate-y-0.5 hover:border-[var(--kws-accent)] hover:bg-[var(--kws-tint-bg)]/55 hover:shadow-xs',
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
