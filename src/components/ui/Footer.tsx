import { useEffect, useRef } from 'react';
import type { AppRoute, ThemePreference } from '../../state/useAssessmentSession.ts';

interface FooterProps {
  theme: ThemePreference;
  onThemeChange: (pref: ThemePreference) => void;
  onNavigate: (route: AppRoute) => void;
}

export function Footer({ theme, onThemeChange, onNavigate }: FooterProps) {
  const clickCountRef = useRef(0);
  const resetTimerRef = useRef<number | null>(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopyrightClick = () => {
    clickCountRef.current += 1;
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      resetTimerRef.current = null;
      onNavigate({ area: 'admin', view: 'overview' });
      return;
    }
    resetTimerRef.current = window.setTimeout(() => {
      clickCountRef.current = 0;
      resetTimerRef.current = null;
    }, 2500);
  };

  return (
    <footer className="mt-auto border-t border-[var(--kws-border)] bg-[var(--kws-surface)]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-6 text-xs text-[var(--kws-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-sm lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 leading-relaxed">
          <button
            type="button"
            onClick={handleCopyrightClick}
            className="select-none bg-transparent p-0 text-left font-medium text-[var(--kws-ink)] focus-visible:outline-offset-4 cursor-default"
          >
            © {currentYear} KWS Academy
          </button>
          <span>Self-Discovery</span>
          <span>Ikeja, Lagos</span>
        </div>

        <div className="flex items-center">
          <div
            role="group"
            aria-label="Appearance mode"
            className="inline-flex items-center rounded-full border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-0.5 text-xs"
          >
            {(['light', 'dark', 'system'] as ThemePreference[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onThemeChange(mode)}
                className={`min-h-[30px] rounded-full px-3 py-1 capitalize font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  theme === mode
                    ? 'bg-[var(--kws-surface)] text-[var(--kws-ink)] shadow-xs'
                    : 'text-[var(--kws-muted)] hover:text-[var(--kws-ink)]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
