import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';
import { buildAllPillarInsightsFromResults } from '../../domain/pillarInsights.ts';
import type { PillarInsightResult } from '../../domain/types.ts';
import {
  fetchSubmissionById,
  type PublicRespondentRecord,
} from '../../services/api.ts';
import { Button } from '../ui/Button.tsx';
import { CircularProgressRing } from '../ui/CircularProgressRing.tsx';
import { Surface } from '../ui/Surface.tsx';
import { BlurredReportPreview } from './BlurredReportPreview.tsx';

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
  const [loadedRecord, setLoadedRecord] =
    useState<PublicRespondentRecord | null>(
      record && record.id === submissionId ? record : null
    );

  useEffect(() => {
    if (record && record.id === submissionId) {
      setLoadedRecord(record);
      return;
    }
    let active = true;
    fetchSubmissionById(submissionId)
      .then((fetched) => {
        if (active) setLoadedRecord(fetched);
      })
      .catch(() => {
        // Gracefully show confirmation even without live record hydration
      });
    return () => {
      active = false;
    };
  }, [submissionId, record]);

  const activeRec = loadedRecord ?? record;
  const fullName = activeRec?.contact.fullName.trim();

  const insights = useMemo(() => {
    if (!activeRec) return null;
    if (activeRec.result.pillarInsights) {
      return activeRec.result.pillarInsights;
    }
    return buildAllPillarInsightsFromResults({
      answers: {
        selections: {},
        otherText: {},
        contact: activeRec.contact,
      },
      professionalStyle: activeRec.result.professionalStyle,
      growthJourney: activeRec.result.growthJourney,
      capabilities: activeRec.result.capabilities,
      nextStep: activeRec.result.nextStep,
    });
  }, [activeRec]);

  const fallbackPartDInsight: PillarInsightResult = {
    insightId: 'part_d_self_directed',
    pillarId: 'profile_next_steps',
    sectionCode: 'D',
    priority: 80,
    patternKey: 'self_directed',
    headline: 'Your discovery is ready.',
    message:
      'You’ve explored how you contribute, reflected on your professional journey and identified areas where you can grow. We’ve brought your responses together into a personal discovery report.',
    curiosityHook:
      'Open your full report below for your complete style breakdown, growth map, and practical priorities.',
    ctaLabel: 'Reveal My Professional Discovery Report',
    primaryMetric: {
      id: 'part_d_completion',
      label: 'Assessment sections',
      value: 4,
      max: 4,
      displayValue: '4 / 4',
      sublabel: 'All discovery pillars completed',
      tone: 'success',
      segments: 4,
    },
    previewSummary: {
      unlockedLabel: 'Complete discovery synthesized',
      unlockedDetail:
        'Your working style, growth stage, six capabilities, and priorities are assembled.',
      obscuredHint:
        'Click below to reveal your complete interactive report immediately.',
      partAConfigApproved:
        activeRec?.result.professionalStyle.status === 'complete',
    },
    isFallback: false,
  };

  const partDInsight = insights?.profileNextSteps ?? fallbackPartDInsight;

  const unlockedHighlights = useMemo(() => {
    if (!insights) return [];
    return [
      {
        sectionLabel: insights.professionalStyle.previewSummary.unlockedLabel,
        value: insights.professionalStyle.previewSummary.unlockedDetail,
      },
      {
        sectionLabel: insights.growthJourney.previewSummary.unlockedLabel,
        value: insights.growthJourney.previewSummary.unlockedDetail,
      },
      {
        sectionLabel: insights.strengthsGrowth.previewSummary.unlockedLabel,
        value: insights.strengthsGrowth.previewSummary.unlockedDetail,
      },
    ];
  }, [insights]);

  return (
    <div className="mx-auto max-w-[820px] px-4 pt-6 pb-8 sm:px-6 sm:py-12">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <Surface className="rounded-[24px] p-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--kws-border)] pb-4">
            <span className="text-xs font-normal text-[var(--kws-muted)]">
              Pillar 4 · All Discovery Sections Complete
            </span>
            <span className="text-xs font-normal tabular-nums text-[var(--kws-muted)]">
              Ref {submissionId}
            </span>
          </div>

          <div className="mt-6">
            <div
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)] shadow-[0_10px_28px_-6px_var(--kws-shadow-accent)] ring-4 ring-[var(--kws-accent)]/15"
              aria-hidden="true"
            >
              <Check className="h-6 w-6 stroke-[2.5]" />
            </div>

            <h1 className="mt-4 text-left font-display text-[28px] font-bold leading-[1.15] tracking-[-0.025em] text-[var(--kws-ink)] sm:text-[32px] [text-wrap:balance]">
              {partDInsight.headline}
            </h1>

            {fullName && (
              <p className="mt-2 text-sm font-medium text-[var(--kws-accent)]">
                Prepared for {fullName}
              </p>
            )}

            <p className="mt-3 max-w-[54ch] text-base leading-[1.6] text-[var(--kws-muted)] sm:text-[17px]">
              {partDInsight.message}
            </p>
          </div>

          {/* Circular Metric Summary Strip (strictly circular visuals; Part C scores kept separate) */}
          <div className="mt-6 border-t border-[var(--kws-border)] pt-6">
            {insights ? (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 sm:gap-4">
                <CircularProgressRing
                  metric={insights.professionalStyle.primaryMetric}
                  size="sm"
                  className="mx-auto"
                />
                <CircularProgressRing
                  metric={insights.growthJourney.primaryMetric}
                  size="sm"
                  className="mx-auto"
                />
                <CircularProgressRing
                  metric={insights.strengthsGrowth.primaryMetric}
                  size="sm"
                  className="mx-auto"
                />
                {insights.strengthsGrowth.secondaryMetric && (
                  <CircularProgressRing
                    metric={insights.strengthsGrowth.secondaryMetric}
                    size="sm"
                    className="mx-auto"
                  />
                )}
              </div>
            ) : (
              <div className="flex justify-center">
                <CircularProgressRing
                  metric={partDInsight.primaryMetric}
                  size="lg"
                />
              </div>
            )}
          </div>

          {/* Preview Invitation */}
          <div className="mt-6">
            <BlurredReportPreview
              stage="profile_next_steps"
              insight={partDInsight}
              unlockedHighlights={unlockedHighlights}
              compact
            />
          </div>

          {partDInsight.curiosityHook && (
            <p className="mt-5 text-xs leading-relaxed text-[var(--kws-muted)] sm:text-sm">
              {partDInsight.curiosityHook}
            </p>
          )}
        </Surface>

        <div className="sticky bottom-0 z-20 -mx-4 mt-4 bg-gradient-to-t from-[var(--kws-bg)] via-[var(--kws-bg)]/95 to-transparent px-4 pt-6 pb-[calc(16px+env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mt-6 sm:bg-none sm:p-0">
          <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-4">
            <Button
              size="lg"
              allowWrap
              onClick={onViewResults}
              className="w-full min-h-[56px] justify-between px-6 sm:w-auto sm:justify-center"
            >
              <span className="text-left sm:text-center">
                {partDInsight.ctaLabel}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Button>
            <p className="text-center text-xs text-[var(--kws-muted)] sm:text-left">
              Immediate access—independent of any consultation preference
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
