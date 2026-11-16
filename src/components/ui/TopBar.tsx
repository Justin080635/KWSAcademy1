import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import type { AppRoute } from '../../state/useAssessmentSession.ts';
import { Button } from './Button.tsx';
import { KWS_DURATIONS, KWS_EASE } from './motionPrimitives.tsx';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const isAdmin = route.area === 'admin';

  const handlePrimaryAction = () => {
    setMenuOpen(false);
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

  const navigateAndClose = (nextRoute: AppRoute, hash?: string) => {
    setMenuOpen(false);
    onNavigate(nextRoute, hash);
  };

  const renderCtaContent = () => {
    if (isAdmin) {
      return (
        <>
          <span className="sm:hidden">Home</span>
          <span className="hidden sm:inline">Discovery Home</span>
        </>
      );
    }
    if (route.view === 'assessment') {
      return (
        <>
          <span className="sm:hidden">Overview</span>
          <span className="hidden sm:inline">Discovery Overview</span>
        </>
      );
    }
    if (lastSubmissionId && route.view !== 'results') {
      return 'See My Profile';
    }
    if (hasStarted) {
      return (
        <>
          <span>Continue</span>
          <span className="hidden min-[380px]:inline"> discovery</span>
        </>
      );
    }
    return (
      <>
        <span>Start</span>
        <span className="hidden min-[380px]:inline"> discovering</span>
      </>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--kws-border)]/75 bg-[var(--kws-surface)]/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-[52px] max-w-[1200px] items-center justify-between gap-3 px-4 py-2 sm:px-6 sm:py-2.5 lg:gap-8 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigateAndClose({ area: 'respondent', view: 'welcome' });
          }}
          className="font-display text-base font-bold tracking-tight text-[var(--kws-ink)] whitespace-nowrap shrink-0 sm:text-lg"
        >
          KWS Academy
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-6 text-sm font-medium text-[var(--kws-muted)]"
        >
          <a
            href="/#overview"
            onClick={(e) => {
              e.preventDefault();
              navigateAndClose({ area: 'respondent', view: 'welcome' }, 'overview');
            }}
            className="hover:text-[var(--kws-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Overview
          </a>
          <a
            href="/#stages"
            onClick={(e) => {
              e.preventDefault();
              navigateAndClose({ area: 'respondent', view: 'welcome' }, 'stages');
            }}
            className="hover:text-[var(--kws-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            What You’ll Discover
          </a>
          <a
            href="/#faq"
            onClick={(e) => {
              e.preventDefault();
              navigateAndClose({ area: 'respondent', view: 'welcome' }, 'faq');
            }}
            className="hover:text-[var(--kws-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Good to Know
          </a>
        </nav>

        {/* Zone 3: Primary action + compact menu button for mobile/tablet */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="md"
            onClick={handlePrimaryAction}
            className="min-h-[38px] px-4 py-1.5 text-xs sm:min-h-[40px] sm:px-4 sm:text-sm"
          >
            {renderCtaContent()}
          </Button>
          <button
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] text-[var(--kws-ink)] transition-colors hover:bg-[var(--kws-surface-subtle)] cursor-pointer lg:hidden"
          >
            {menuOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.nav
            key="mobile-nav"
            aria-label="Mobile navigation"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            transition={{ duration: KWS_DURATIONS.fast, ease: KWS_EASE }}
            className="border-t border-[var(--kws-border)] bg-[var(--kws-surface)] px-4 py-3 sm:px-6 lg:hidden"
          >
            <div className="mx-auto flex max-w-[1200px] flex-col gap-1 text-sm font-medium">
              <a
                href="/#overview"
                onClick={(e) => {
                  e.preventDefault();
                  navigateAndClose({ area: 'respondent', view: 'welcome' }, 'overview');
                }}
                className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-[var(--kws-muted)] hover:bg-[var(--kws-surface-subtle)] hover:text-[var(--kws-ink)]"
              >
                Overview
              </a>
              <a
                href="/#stages"
                onClick={(e) => {
                  e.preventDefault();
                  navigateAndClose({ area: 'respondent', view: 'welcome' }, 'stages');
                }}
                className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-[var(--kws-muted)] hover:bg-[var(--kws-surface-subtle)] hover:text-[var(--kws-ink)]"
              >
                What You’ll Discover
              </a>
              <a
                href="/#faq"
                onClick={(e) => {
                  e.preventDefault();
                  navigateAndClose({ area: 'respondent', view: 'welcome' }, 'faq');
                }}
                className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-[var(--kws-muted)] hover:bg-[var(--kws-surface-subtle)] hover:text-[var(--kws-ink)]"
              >
                Good to Know
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
