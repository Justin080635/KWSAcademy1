import { Check, Lock } from 'lucide-react';
import type {
  AssessmentSectionId,
  PillarInsightResult,
} from '../../domain/types.ts';

interface UnlockedReportHighlight {
  sectionLabel: string;
  value: string;
}

interface BlurredReportPreviewProps {
  stage: AssessmentSectionId;
  insight: PillarInsightResult;
  unlockedHighlights?: UnlockedReportHighlight[];
  compact?: boolean;
}

const STAGE_PROGRESS_COPY: Record<
  AssessmentSectionId,
  { unlockedCountLabel: string }
> = {
  professional_style: {
    unlockedCountLabel: 'Pillar 1 of 4 captured',
  },
  growth_journey: {
    unlockedCountLabel: 'Pillars 1 & 2 of 4 captured',
  },
  strengths_growth: {
    unlockedCountLabel: 'Pillars 1, 2 & 3 of 4 captured',
  },
  profile_next_steps: {
    unlockedCountLabel: '4 of 4 pillars assembled',
  },
};

export function BlurredReportPreview({
  stage,
  insight,
  unlockedHighlights = [],
  compact = false,
}: BlurredReportPreviewProps) {
  const stageCopy = STAGE_PROGRESS_COPY[stage];

  const rows: UnlockedReportHighlight[] =
    unlockedHighlights.length > 0
      ? unlockedHighlights
      : [
          {
            sectionLabel: insight.previewSummary.unlockedLabel,
            value: insight.previewSummary.unlockedDetail,
          },
        ];

  return (
    <div
      className={
        compact
          ? 'border-t border-[var(--kws-border)] pt-6'
          : 'rounded-[24px] border border-[var(--kws-border)] bg-[var(--kws-surface)] p-5 sm:p-6'
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--kws-ink)]">
          Developing discovery report
        </p>
        <span className="text-xs font-normal tabular-nums text-[var(--kws-muted)]">
          {stageCopy.unlockedCountLabel}
        </span>
      </div>

      {/* Unlocked signals captured cleanly */}
      <div className="mt-3.5 space-y-2.5">
        {rows.map((row) => (
          <div
            key={`${row.sectionLabel}-${row.value}`}
            className="flex items-start gap-2.5 text-sm leading-relaxed"
          >
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--kws-tint-bg)] text-[var(--kws-accent)]">
              <Check className="h-3 w-3 stroke-[2.5]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-[var(--kws-ink)]">
                {row.sectionLabel}:
              </span>{' '}
              <span className="text-[var(--kws-muted)]">{row.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Soft frosted locked preview card with dashed border & filled lock circle */}
      <div className="mt-5 flex flex-col items-center justify-center rounded-[20px] border border-dashed border-[var(--kws-accent)]/35 bg-gradient-to-br from-[var(--kws-tint-bg)] via-[var(--kws-surface)]/80 to-[var(--kws-surface-subtle)]/80 px-5 py-6 text-center backdrop-blur-md">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[image:var(--kws-gradient-btn)] text-[var(--kws-accent-fg)] shadow-[0_8px_20px_-6px_rgba(43,59,196,0.38)]">
          <Lock className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-semibold text-[var(--kws-ink)]">
          Full discovery revealed at the end
        </p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--kws-muted)] sm:text-sm">
          {insight.previewSummary.obscuredHint}
        </p>
      </div>
    </div>
  );
}
