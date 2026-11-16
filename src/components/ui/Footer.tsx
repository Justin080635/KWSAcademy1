import type { AppRoute, ThemePreference } from '../../state/useAssessmentSession.ts';

interface FooterProps {
  theme: ThemePreference;
  onThemeChange: (pref: ThemePreference) => void;
  onNavigate: (route: AppRoute) => void;
}

export function Footer({ theme, onThemeChange, onNavigate }: FooterProps) {
  return (
    <footer className="border-t border-[var(--kws-border)] bg-[var(--kws-surface)] mt-auto">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-6 text-sm text-[var(--kws-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-[var(--kws-ink)]">
            KWS Academy
          </span>
          <span aria-hidden="true">·</span>
          <span>Professional Discovery Assessment</span>
          <span aria-hidden="true">·</span>
          <span>Ikeja, Lagos</span>
        </div>

        <div className="flex flex-wrap items-center gap-5">
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
                className={`rounded-md px-2.5 py-1 capitalize font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  theme === mode
                    ? 'bg-[var(--kws-surface)] text-[var(--kws-ink)] shadow-xs'
                    : 'text-[var(--kws-muted)] hover:text-[var(--kws-ink)]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <a
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ area: 'admin', view: 'overview' });
            }}
            className="text-xs font-medium text-[var(--kws-muted)] hover:text-[var(--kws-ink)] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
          >
            Staff Portal
          </a>
        </div>
      </div>
    </footer>
  );
}
