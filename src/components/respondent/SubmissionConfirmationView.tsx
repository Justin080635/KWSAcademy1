import { motion, useReducedMotion } from 'motion/react';
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
  const prefersReducedMotion = useReducedMotion();
  const fullName = record?.contact.fullName.trim();

  return (
    <div className="mx-auto max-w-[680px] px-4 py-12 sm:px-6 sm:py-16">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <Surface className="overflow-hidden p-6 sm:p-8">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--kws-success)]">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Discovery assessment complete</span>
          </div>

          <h1 className="mt-3 font-display text-2xl font-bold text-[var(--kws-ink)] sm:text-3xl [text-wrap:balance]">
            {fullName
              ? `Well done, ${fullName}. Your responses are saved.`
              : 'Well done. Your responses are saved.'}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-[var(--kws-muted)] sm:text-base">
            Your personalized discovery profile is ready to explore—bringing
            together your natural working style, provisional growth stage,
            six capability dimensions, and practical next-step priorities.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--kws-border)] pt-5 text-xs text-[var(--kws-muted)]">
            <span>Submission reference</span>
            <span className="font-mono-tabular font-medium text-[var(--kws-ink)]">
              {submissionId}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={onViewResults}
              className="w-full sm:w-auto"
            >
              View My Discovery Results
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </Surface>
      </motion.div>
    </div>
  );
}
