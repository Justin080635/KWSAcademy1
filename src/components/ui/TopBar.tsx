import type { AppRoute } from '../../state/useAssessmentSession.ts';
import { Button } from './Button.tsx';

interface TopBarProps {
  route: AppRoute;
  hasStarted: boolean;
  lastSubmissionId: string | null;
  onNavigate: (route: AppRoute, hash?: string) => void;
  onStartOrResume: () => void;
}

export function TopBar({
  route,
  hasStarted,
  lastSubmissionId,
  onNavigate,
  onStartOrResume,
}: TopBarProps) {
  const isAdmin = route.area === 'admin';

  const ctaLabel = isAdmin
    ? 'Assessment Home'
    : route.view === 'assessment'
      ? 'Assessment Overview'
      : lastSubmissionId && route.view !== 'results'
        ? 'View Results'
        : hasStarted
          ? 'Continue Assessment'
          : 'Start Assessment';

  const handlePrimaryAction = () => {
    if (isAdmin) {
      onNavigate({ area: 'respondent', view: 'welcome' });
      return;
    }
    if (route.view === 'assessment') {
      onNavigate({ area: 'respondent', view: 'welcome' });
      return;
    }
    if (lastSubmissionId && route.view !== 'results') {
      onNavigate({
        area: 'respondent',
        view: 'results',
        submissionId: lastSubmissionId,
      });
      return;
    }
    onStartOrResume();
  };

  return (
    <header className="border-b border-[var(--kws-border)] bg-[var(--kws-surface)]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 lg:gap-8 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate({ area: 'respondent', view: 'welcome' });
          }}
          className="font-display text-lg font-bold tracking-tight text-[var(--kws-ink)] whitespace-nowrap shrink-0"
        >
          KWS Academy
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-medium text-[var(--kws-muted)]"
        >
          <a
            href="/#overview"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ area: 'respondent', view: 'welcome' }, 'overview');
            }}
            className="hover:text-[var(--kws-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Overview
          </a>
          <a
            href="/#stages"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ area: 'respondent', view: 'welcome' }, 'stages');
            }}
            className="hover:text-[var(--kws-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Four Sections
          </a>
          <a
            href="/#archetypes"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ area: 'respondent', view: 'welcome' }, 'archetypes');
            }}
            className="hover:text-[var(--kws-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Professional Styles
          </a>
          <a
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ area: 'admin', view: 'overview' });
            }}
            className={`hover:text-[var(--kws-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              isAdmin ? 'text-[var(--kws-accent)] font-semibold' : ''
            }`}
          >
            Staff Portal
          </a>
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <Button variant="primary" size="md" onClick={handlePrimaryAction}>
            {ctaLabel}
          </Button>
        </div>
      </div>
    </header>
  );
}
