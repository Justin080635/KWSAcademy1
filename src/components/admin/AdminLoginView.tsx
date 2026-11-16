import { useState, type FormEvent } from 'react';
import { AlertCircle, KeyRound, Lock, Mail } from 'lucide-react';
import type { StorageBoundaryStatus } from '../../domain/types.ts';
import { ApiError, loginAdmin } from '../../services/api.ts';
import { Button } from '../ui/Button.tsx';
import { Surface } from '../ui/Surface.tsx';

interface AdminLoginViewProps {
  authConfigured: boolean;
  accountSignInEnabled: boolean;
  allowlistEnabled: boolean;
  storageStatus: StorageBoundaryStatus | null;
  onAuthenticated: () => void;
  onReturnToAssessment: () => void;
}

export function AdminLoginView({
  authConfigured,
  accountSignInEnabled,
  allowlistEnabled,
  storageStatus,
  onAuthenticated,
  onReturnToAssessment,
}: AdminLoginViewProps) {
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRequired = accountSignInEnabled || allowlistEnabled;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || submitting) return;
    if (emailRequired && !email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await loginAdmin(passcode, email);
      onAuthenticated();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to sign in. Please verify your staff credentials.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[540px] px-4 py-12 sm:px-6 sm:py-16">
      <Surface className="p-6 sm:p-8">
        <div className="flex items-center gap-2.5 text-sm font-medium text-[var(--kws-muted)]">
          <Lock className="h-4 w-4 text-[var(--kws-accent)]" aria-hidden="true" />
          <span>KWS Academy Staff Portal</span>
        </div>

        <h1 className="mt-3 font-display text-2xl font-bold text-[var(--kws-ink)]">
          Staff sign-in
        </h1>
        <p className="mt-1.5 text-sm text-[var(--kws-muted)]">
          Private access to discovery analytics, respondent profiles,
          consultation follow-up management, and filtered CSV/Excel/JSON
          exports.
        </p>

        {!authConfigured ? (
          <div className="mt-6 space-y-4">
            <div
              role="alert"
              className="rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface-subtle)] p-4 text-sm"
            >
              <p className="font-semibold text-[var(--kws-ink)]">
                Staff authentication is not yet configured
              </p>
              <p className="mt-1.5 leading-relaxed text-[var(--kws-muted)]">
                To protect respondent data, staff login requires server-side
                credentials or staff account entries in the runtime environment
                rather than hardcoded frontend keys.
              </p>
              <div className="mt-3 space-y-1 rounded-md border border-[var(--kws-border)] bg-[var(--kws-surface)] p-3 font-mono-tabular text-xs text-[var(--kws-ink)]">
                <p>KWS_ADMIN_PASSCODE=your-admin-passcode</p>
                <p>KWS_ADVISOR_PASSCODE=your-advisor-passcode</p>
                <p>KWS_VIEWER_PASSCODE=your-viewer-passcode</p>
                <p>KWS_STAFF_ALLOWLIST=staff1@kws.org,staff2@kws.org</p>
                <p>KWS_SESSION_SECRET=random-signing-secret</p>
              </div>
              {storageStatus && (
                <p className="mt-3 text-xs text-[var(--kws-muted)]">
                  Storage boundary: {storageStatus.description}
                </p>
              )}
            </div>

            <Button variant="secondary" onClick={onReturnToAssessment}>
              Return to assessment
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="kws-staff-email"
                className="block text-sm font-semibold text-[var(--kws-ink)]"
              >
                Staff email{' '}
                {!emailRequired && (
                  <span className="font-normal text-[var(--kws-muted)]">
                    (optional for audit label)
                  </span>
                )}
              </label>
              <div className="relative mt-1.5">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--kws-muted)]"
                  aria-hidden="true"
                />
                <input
                  id="kws-staff-email"
                  type="email"
                  autoComplete="email"
                  required={emailRequired}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@kwsacademy.org"
                  className="w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] py-2.5 pl-9 pr-3.5 text-base text-[var(--kws-ink)] focus:border-[var(--kws-accent)]"
                />
              </div>
              {allowlistEnabled && (
                <p className="mt-1 text-xs text-[var(--kws-muted)]">
                  Staff allowlist is active: your email must be on the
                  authorized list.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="kws-staff-passcode"
                className="block text-sm font-semibold text-[var(--kws-ink)]"
              >
                Staff passcode
              </label>
              <div className="relative mt-1.5">
                <input
                  id="kws-staff-passcode"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter staff passcode"
                  className="w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-base text-[var(--kws-ink)] focus:border-[var(--kws-accent)]"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-[var(--kws-danger)]/40 bg-[var(--kws-danger-surface)] p-3 text-sm text-[var(--kws-danger)]"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button variant="ghost" onClick={onReturnToAssessment}>
                Back to assessment
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                disabled={!passcode.trim() || (emailRequired && !email.trim())}
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Sign in
              </Button>
            </div>
          </form>
        )}
      </Surface>
    </div>
  );
}
