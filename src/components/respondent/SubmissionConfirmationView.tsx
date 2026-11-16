import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { PublicRespondentRecord } from '../../services/api.ts';
import { Button } from '../ui/Button.tsx';
import { Surface } from '../ui/Surface.tsx';

interface SubmissionConfirmationViewProps {
  submissionId: string;
  record: PublicRespondentRecord | null;
  onViewResults: () => void;
}

export function SubmissionConfirmationView({
  submissionId,
  record,
  onViewResults,
}: SubmissionConfirmationViewProps) {
  const fullName = record?.contact.fullName.trim();

  return (
    <div className="mx-auto max-w-[680px] px-4 py-12 sm:px-6 sm:py-16">
      <Surface className="p-6 sm:p-8">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--kws-success)]">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Assessment submitted</span>
        </div>

        <h1 className="mt-3 font-display text-2xl font-bold text-[var(--kws-ink)] sm:text-3xl [text-wrap:balance]">
          {fullName
            ? `Thank you, ${fullName}. Your responses are saved.`
            : 'Thank you. Your responses are saved.'}
        </h1>

        <p className="mt-2.5 text-sm leading-relaxed text-[var(--kws-muted)] sm:text-base">
          Your personalized discovery profile is ready. You can review your
          professional style status, reflective growth stage, capability
          overview, and suggested next steps right away.
        </p>

        <div className="mt-5 rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-4 text-xs text-[var(--kws-muted)]">
          <span className="font-semibold text-[var(--kws-ink)]">
            Submission reference:
          </span>{' '}
          <span className="font-mono-tabular">{submissionId}</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onViewResults}>
            View My Results
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </Surface>
    </div>
  );
}
