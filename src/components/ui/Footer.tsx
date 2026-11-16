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
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-6 text-sm text-[var(--kws-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={handleCopyrightClick}
            className="select-none bg-transparent p-0 text-left font-medium text-[var(--kws-ink)] focus-visible:outline-offset-4 cursor-default"
          >
            © {currentYear} KWS Academy
          </button>
          <span aria-hidden="true">·</span>
          <span>Professional Discovery Assessment</span>
          <span aria-hidden="true">·</span>
          <span>Ikeja, Lagos</span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div
            role="group"
            aria-label="Appearance mode"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--kws-border)] bg-[var(--kws-bg)] p-0.5 text-xs"
          >
            {(['light', 'dark', 'system'] as ThemePreference[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onThemeChange(mode)}
                className={`min-h-[34px] rounded-md px-3 py-1 capitalize font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
