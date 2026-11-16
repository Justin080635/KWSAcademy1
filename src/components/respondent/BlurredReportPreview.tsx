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
  { unlockedCountLabel: string; lockedItems: Array<{ title: string; teaser: string }> }
> = {
  professional_style: {
    unlockedCountLabel: 'Pillar 1 of 4 captured',
    lockedItems: [
      {
        title: 'Growth Stage & Momentum Alignment',
        teaser:
          'Synthesizing where your current focus sits across the five professional growth stages.',
      },
      {
        title: 'Six-Capability Strengths & Priorities',
        teaser:
          'Mapping situational understanding separately from practical track record across six areas.',
      },
    ],
  },
  growth_journey: {
    unlockedCountLabel: 'Pillars 1 & 2 of 4 captured',
    lockedItems: [
      {
        title: 'Six-Capability Comparison Matrix',
        teaser:
          'Pinpointing where conceptual judgment is ahead of hands-on practice—and vice versa.',
      },
      {
        title: 'Tailored Next-Step Roadmap',
        teaser:
          'Connecting your 12-month focus with concrete weekly actions tailored to your orientation.',
      },
    ],
  },
  strengths_growth: {
    unlockedCountLabel: 'Pillars 1, 2 & 3 of 4 captured',
    lockedItems: [
      {
        title: 'Integrated Personalised Priorities',
        teaser:
          'Assembling your top development priorities alongside practical 30-day actions.',
      },
      {
        title: 'Full Working Style & Stage Blueprint',
        teaser:
          'Connecting your natural strengths with your current growth focus in one shareable report.',
      },
    ],
  },
  profile_next_steps: {
    unlockedCountLabel: '4 of 4 pillars assembled',
    lockedItems: [
      {
        title: 'Complete Style, Stage & Six-Capability Report',
        teaser:
          'Full breakdowns, blind spots to balance, reflection prompts, and immediate practical next steps.',
      },
    ],
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
      className={`rounded-xl border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] ${
        compact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--kws-border)] pb-2.5">
        <p className="text-xs font-semibold text-[var(--kws-ink)]">
          Developing discovery report
        </p>
        <span className="font-mono-tabular text-[11px] font-medium text-[var(--kws-accent)]">
          {stageCopy.unlockedCountLabel}
        </span>
      </div>

      {/* Unlocked signals captured cleanly */}
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div
            key={`${row.sectionLabel}-${row.value}`}
            className="flex items-start gap-2.5 text-xs"
          >
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--kws-success)]"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-[var(--kws-ink)]">
                {row.sectionLabel}:
              </span>{' '}
              <span className="text-[var(--kws-muted)]">{row.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Partially obscured / blurred upcoming findings */}
      <div className="relative mt-3.5 overflow-hidden rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface)] p-3">
        <div
          aria-hidden="true"
          className="pointer-events-none select-none space-y-2.5 blur-[4px] opacity-60"
        >
          {stageCopy.lockedItems.map((item) => (
            <div key={item.title} className="space-y-0.5">
              <p className="font-display text-xs font-bold text-[var(--kws-ink)]">
                {item.title}
              </p>
              <p className="text-[11px] leading-snug text-[var(--kws-muted)]">
                {item.teaser}
              </p>
            </div>
          ))}
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--kws-surface)]/72 px-4 text-center backdrop-blur-[1px]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--kws-ink)]">
            <Lock
              className="h-3.5 w-3.5 shrink-0 text-[var(--kws-accent)]"
              aria-hidden="true"
            />
            <span>Full discovery revealed at the end</span>
          </div>
          <p className="mt-1 max-w-md text-[11px] leading-snug text-[var(--kws-muted)]">
            {insight.previewSummary.obscuredHint}
          </p>
        </div>
      </div>
    </div>
  );
}
