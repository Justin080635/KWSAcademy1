import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  MessageSquare,
  Printer,
  RotateCcw,
  Share2,
} from 'lucide-react';
import {
  GROWTH_STAGES,
  PROFESSIONAL_STYLES,
} from '../../domain/assessmentContent.ts';
import type { PilotFeedback, StyleId } from '../../domain/types.ts';
import {
  ApiError,
  fetchSubmissionById,
  getSubmissionAccessToken,
  requestConsultation,
  savePilotFeedback,
  sendSubmissionTelemetry,
  type PublicRespondentRecord,
} from '../../services/api.ts';
import { Button } from '../ui/Button.tsx';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import { Surface } from '../ui/Surface.tsx';

interface ResultsViewProps {
  submissionId: string;
  initialRecord: PublicRespondentRecord | null;
  onRecordLoaded: (record: PublicRespondentRecord) => void;
  onStartNew: () => void;
  onBackHome: () => void;
}

const FIT_OPTIONS: Array<'Yes' | 'Partly' | 'No'> = ['Yes', 'Partly', 'No'];

function formatPublicShareSummary(
  record: PublicRespondentRecord,
  feedback: PilotFeedback
): string {
  const { result, contact, durationMinutes } = record;
  const cityState = [contact.city.trim(), contact.state.trim()]
    .filter(Boolean)
    .join(', ');

  const styleLine =
    result.professionalStyle.status === 'complete'
      ? result.professionalStyle.leadTitle
      : 'Pending final style mapping configuration';

  return [
    'KWS ACADEMY DISCOVERY SUMMARY',
    `Reference: ${record.id}`,
    `Name: ${contact.fullName.trim()}`,
    `City & State: ${cityState}`,
    `Minutes taken: ${durationMinutes}`,
    `Professional Style: ${styleLine}`,
    `Growth Stage (provisional): ${result.growthJourney.indicativeStage.name}${
      result.growthJourney.mixedStageFlag ? ' (mixed-stage pattern)' : ''
    }`,
    'Capabilities (Understanding / Experience):',
    ...result.capabilities.map(
      (c) =>
        `- ${c.name}: Understanding ${
          c.understandingScore === 1 ? 'Aligned' : 'Worth revisiting'
        }, Experience ${c.experienceScore}/4 (${c.experienceLabel})`
    ),
    'Development Priorities:',
    ...result.developmentPriorities.map((p, i) => `${i + 1}. ${p.title}`),
    `FEEDBACK – style fits: ${feedback.archetypeFits || '-'} | stage fits: ${
      feedback.stageFits || '-'
    }`,
    `Notes: ${(feedback.notes || '').trim()}`,
  ].join('\n');
}

export function ResultsView({
  submissionId,
  initialRecord,
  onRecordLoaded,
  onStartNew,
  onBackHome,
}: ResultsViewProps) {
  const [record, setRecord] = useState<PublicRespondentRecord | null>(
    initialRecord && initialRecord.id === submissionId ? initialRecord : null
  );
  const [loading, setLoading] = useState<boolean>(!record);
  const [error, setError] = useState<string | null>(null);

  const [expandedStyle, setExpandedStyle] = useState(true);
  const [selectedExplorerStyle, setSelectedExplorerStyle] =
    useState<StyleId>('STORYTELLER');
  const [showStyleExplorer, setShowStyleExplorer] = useState(
    () => record?.result.professionalStyle.status === 'incomplete_configuration'
  );
  const [expandedGrowth, setExpandedGrowth] = useState(false);
  const [inspectedStageLevel, setInspectedStageLevel] = useState<number | null>(
    null
  );
  const [expandedCapabilities, setExpandedCapabilities] = useState<
    Record<string, boolean>
  >({});
  const [expandedPriorities, setExpandedPriorities] = useState<
    Record<string, boolean>
  >({});

  const [feedback, setFeedback] = useState<PilotFeedback>(() => ({
    archetypeFits: record?.feedback.archetypeFits ?? '',
    stageFits: record?.feedback.stageFits ?? '',
    notes: record?.feedback.notes ?? '',
  }));
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackSavedMsg, setFeedbackSavedMsg] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [requestingConsultation, setRequestingConsultation] = useState(false);
  const [consultationMsg, setConsultationMsg] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (record && record.id === submissionId) {
      const token = getSubmissionAccessToken(submissionId);
      if (token) {
        void sendSubmissionTelemetry(submissionId, token, [
          { eventType: 'results_viewed' },
        ]).catch(() => undefined);
      }
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);

    fetchSubmissionById(submissionId)
      .then((fetched) => {
        if (!active) return;
        setRecord(fetched);
        setShowStyleExplorer(
          fetched.result.professionalStyle.status === 'incomplete_configuration'
        );
        if (fetched.result.professionalStyle.leadingStyles[0]) {
          setSelectedExplorerStyle(
            fetched.result.professionalStyle.leadingStyles[0].styleId
          );
        }
        setFeedback({
          archetypeFits: fetched.feedback.archetypeFits ?? '',
          stageFits: fetched.feedback.stageFits ?? '',
          notes: fetched.feedback.notes ?? '',
        });
        onRecordLoaded(fetched);
      })
      .catch((err) => {
        if (!active) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : 'Unable to load your assessment results.';
        setError(msg);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [submissionId, record, onRecordLoaded]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-6">
        <Surface className="space-y-4 p-6">
          <div className="h-6 w-48 animate-pulse rounded bg-[var(--kws-surface-subtle)]" />
          <div className="h-10 w-80 animate-pulse rounded bg-[var(--kws-surface-subtle)]" />
          <div className="h-24 w-full animate-pulse rounded bg-[var(--kws-surface-subtle)]" />
        </Surface>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-12 sm:px-6">
        <Surface className="p-6 text-center">
          <AlertCircle
            className="mx-auto h-8 w-8 text-[var(--kws-danger)]"
            aria-hidden="true"
          />
          <h1 className="mt-3 font-display text-2xl font-bold text-[var(--kws-ink)]">
            Results not available
          </h1>
          <p className="mt-2 text-sm text-[var(--kws-muted)]">
            {error || 'We could not find a submission with that reference.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={onBackHome}>
              Back to overview
            </Button>
            <Button onClick={onStartNew}>Start assessment</Button>
          </div>
        </Surface>
      </div>
    );
  }

  const { result, contact } = record;
  const { professionalStyle, growthJourney, capabilities, developmentPriorities, nextStep } =
    result;
  const plainTextSummary = formatPublicShareSummary(record, feedback);

  const handleSaveFeedback = async () => {
    setSavingFeedback(true);
    setFeedbackSavedMsg(null);
    setFeedbackError(null);
    try {
      const updated = await savePilotFeedback(record.id, feedback);
      setRecord(updated);
      onRecordLoaded(updated);
      setFeedbackSavedMsg('Thank you — your feedback has been saved.');
    } catch (err) {
      setFeedbackError(
        err instanceof ApiError
          ? err.message
          : 'Could not save feedback. Please try again.'
      );
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(plainTextSummary);
      setCopyStatus('Copied summary to clipboard.');
    } catch {
      setCopyStatus(
        'Could not copy automatically. Select and copy from the summary box below.'
      );
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'KWS Academy Discovery Summary',
          text: plainTextSummary,
        });
        setCopyStatus('Shared discovery summary.');
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    await handleCopySummary();
  };

  const inspectedStyleDef =
    PROFESSIONAL_STYLES.find((s) => s.id === selectedExplorerStyle) ??
    PROFESSIONAL_STYLES[0];
  const activeStageMapLevel =
    inspectedStageLevel ?? growthJourney.roundedStageLevel;
  const inspectedStageDef =
    GROWTH_STAGES.find((s) => s.level === activeStageMapLevel) ??
    growthJourney.indicativeStage;

  return (
    <div className="mx-auto max-w-[920px] space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <header className="space-y-3 border-b border-[var(--kws-border)] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-[var(--kws-muted)]">
            Personalised Discovery Report
            {contact.fullName.trim() && (
              <>
                <span aria-hidden="true" className="mx-2">
                  ·
                </span>
                <span className="font-semibold text-[var(--kws-ink)]">
                  {contact.fullName.trim()}
                </span>
              </>
            )}
          </p>
          <p className="font-mono-tabular text-xs text-[var(--kws-muted)]">
            Ref {record.id}
          </p>
        </div>

        <h1 className="font-display text-3xl font-bold text-[var(--kws-ink)] sm:text-4xl">
          Your discovery reflections
        </h1>

        <p className="max-w-3xl text-sm leading-relaxed text-[var(--kws-muted)]">
          {result.disclaimer}
        </p>
      </header>

      {/* A. Professional Style */}
      <Surface className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
              Section A · Your Professional Style
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-[var(--kws-accent)] sm:text-3xl">
              {professionalStyle.status === 'complete'
                ? professionalStyle.leadTitle
                : 'Awaiting final style mapping'}
            </h2>
          </div>

          {professionalStyle.status === 'complete' && (
            <button
              type="button"
              aria-expanded={expandedStyle}
              onClick={() => setExpandedStyle((prev) => !prev)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--kws-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--kws-ink)] hover:border-[var(--kws-accent)] cursor-pointer"
            >
              {expandedStyle ? 'Hide details' : 'Explore details'}
              {expandedStyle ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {professionalStyle.status === 'incomplete_configuration' ? (
          <div className="mt-4 space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface-subtle)] p-4 text-sm">
              <Info
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--kws-accent)]"
                aria-hidden="true"
              />
              <div className="space-y-1.5">
                <p className="font-semibold text-[var(--kws-ink)]">
                  Style scoring configuration incomplete
                </p>
                <p className="leading-relaxed text-[var(--kws-muted)]">
                  {professionalStyle.configurationMessage}
                </p>
                <p className="text-xs text-[var(--kws-muted)]">
                  {professionalStyle.reflectionPrompt}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 text-base text-[var(--kws-ink)]">
              {professionalStyle.summary}
            </p>

            {expandedStyle && (
              <div className="mt-6 space-y-5 border-t border-[var(--kws-border)] pt-5">
                {professionalStyle.leadingStyles.map((style) => (
                  <div key={style.styleId} className="space-y-2.5">
                    <p className="text-sm leading-relaxed text-[var(--kws-ink)]">
                      <strong className="font-semibold">{style.name}.</strong>{' '}
                      {style.description}
                    </p>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                        Likely professional contributions
                      </p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-[var(--kws-muted)]">
                        {style.likelyContributions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-sm text-[var(--kws-muted)]">
                      <strong className="font-semibold text-[var(--kws-ink)]">
                        Watch-out to balance:
                      </strong>{' '}
                      {style.blindSpot}
                    </p>
                  </div>
                ))}

                {professionalStyle.secondaryStyle && (
                  <p className="text-sm text-[var(--kws-muted)]">
                    <strong className="font-semibold text-[var(--kws-ink)]">
                      Secondary orientation:
                    </strong>{' '}
                    {professionalStyle.secondaryStyle.name} —{' '}
                    {professionalStyle.secondaryStyle.tagline.toLowerCase()}.
                  </p>
                )}

                <div className="rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-4 text-sm">
                  <p className="font-semibold text-[var(--kws-ink)]">
                    Reflection prompt
                  </p>
                  <p className="mt-1 text-[var(--kws-muted)]">
                    {professionalStyle.reflectionPrompt}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Interactive Six-Style Explorer */}
        <div className="mt-6 border-t border-[var(--kws-border)] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                Explore All Six Professional Styles
              </p>
              <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
                Select any style below to compare how each orientation approaches work, contribution, and balance.
              </p>
            </div>
            <button
              type="button"
              aria-expanded={showStyleExplorer}
              onClick={() => setShowStyleExplorer((prev) => !prev)}
              className="print:hidden inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[var(--kws-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--kws-ink)] hover:border-[var(--kws-accent)] cursor-pointer"
            >
              {showStyleExplorer ? 'Collapse explorer' : 'Compare all 6 styles'}
              {showStyleExplorer ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>

          {showStyleExplorer && (
            <div className="mt-4 space-y-4">
              <div
                role="tablist"
                aria-label="Six professional styles"
                className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
              >
                {PROFESSIONAL_STYLES.map((styleDef) => {
                  const isActiveTab = selectedExplorerStyle === styleDef.id;
                  const isLeadingMatch = professionalStyle.leadingStyles.some(
                    (l) => l.styleId === styleDef.id
                  );
                  return (
                    <button
                      key={styleDef.id}
                      type="button"
                      role="tab"
                      aria-selected={isActiveTab}
                      onClick={() => setSelectedExplorerStyle(styleDef.id)}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                        isActiveTab
                          ? 'border-[var(--kws-accent)] bg-[var(--kws-surface-subtle)] text-[var(--kws-ink)] ring-1 ring-[var(--kws-accent)]'
                          : 'border-[var(--kws-border)] bg-[var(--kws-surface)] text-[var(--kws-muted)] hover:border-[var(--kws-border-strong)] hover:text-[var(--kws-ink)]'
                      }`}
                    >
                      <span className="block truncate text-xs font-semibold text-[var(--kws-ink)]">
                        {styleDef.name}
                      </span>
                      {isLeadingMatch && (
                        <span className="mt-0.5 block text-[11px] font-medium text-[var(--kws-accent)]">
                          Your lead style
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                    {inspectedStyleDef.name}
                  </h3>
                  <span className="text-xs font-medium text-[var(--kws-muted)]">
                    {inspectedStyleDef.tagline}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--kws-ink)]">
                  {inspectedStyleDef.description}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                      Likely contributions
                    </p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-[var(--kws-muted)]">
                      {inspectedStyleDef.likelyContributions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <p className="font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                        Watch-out
                      </p>
                      <p className="mt-1 text-[var(--kws-ink)]">
                        {inspectedStyleDef.blindSpot}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                        Reflection prompt
                      </p>
                      <p className="mt-1 text-[var(--kws-muted)]">
                        {inspectedStyleDef.reflectionPrompt}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Surface>

      {/* B. Growth Journey */}
      <Surface className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
              Section B · Your Growth Journey (Provisional)
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-[var(--kws-accent)] sm:text-3xl">
              {growthJourney.indicativeStage.name}
            </h2>
          </div>

          <button
            type="button"
            aria-expanded={expandedGrowth}
            onClick={() => setExpandedGrowth((prev) => !prev)}
            className="print:hidden inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--kws-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--kws-ink)] hover:border-[var(--kws-accent)] cursor-pointer"
          >
            {expandedGrowth ? 'Hide reflection notes' : 'Open deeper explanation'}
            {expandedGrowth ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Interactive 5-Stage Growth Map */}
        <div
          className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-5"
          aria-label={`Growth stage: ${growthJourney.indicativeStage.name}`}
        >
          {GROWTH_STAGES.map((stage) => {
            const isCurrent = stage.level === growthJourney.roundedStageLevel;
            const isInspected = stage.level === activeStageMapLevel;
            return (
              <button
                key={stage.level}
                type="button"
                onClick={() => setInspectedStageLevel(stage.level)}
                className={`rounded-lg border p-2.5 text-left transition-colors cursor-pointer ${
                  isInspected
                    ? 'border-[var(--kws-accent)] bg-[var(--kws-surface-subtle)] ring-1 ring-[var(--kws-accent)]'
                    : isCurrent
                      ? 'border-[var(--kws-accent)]/50 bg-[var(--kws-surface)]'
                      : 'border-[var(--kws-border)] bg-[var(--kws-surface)] hover:border-[var(--kws-border-strong)]'
                }`}
              >
                <div
                  className={`h-1.5 w-full rounded-full ${
                    isCurrent
                      ? 'bg-[var(--kws-accent)]'
                      : stage.level < growthJourney.roundedStageLevel
                        ? 'bg-[var(--kws-accent)]/35'
                        : 'bg-[var(--kws-border)]'
                  }`}
                />
                <p className="mt-2 font-mono-tabular text-[11px] text-[var(--kws-muted)]">
                  Stage {stage.level}
                  {isCurrent ? ' · Current' : ''}
                </p>
                <p className="text-xs font-semibold text-[var(--kws-ink)]">
                  {stage.name}
                </p>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-base text-[var(--kws-ink)]">
          {inspectedStageLevel && inspectedStageLevel !== growthJourney.roundedStageLevel ? (
            <>
              <span className="font-semibold">
                Stage {inspectedStageDef.level} ({inspectedStageDef.name}):
              </span>{' '}
              {inspectedStageDef.description} Typical focus:{' '}
              {inspectedStageDef.typicalPriority}
            </>
          ) : (
            growthJourney.indicativeStage.description
          )}
        </p>

        <p className="mt-2 text-sm text-[var(--kws-muted)]">
          {growthJourney.supportingPatternSummary}
        </p>

        {growthJourney.mixedStageFlag && (
          <div className="mt-4 rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-3.5 text-sm text-[var(--kws-muted)]">
            <strong className="font-semibold text-[var(--kws-ink)]">
              Mixed-stage pattern noted:
            </strong>{' '}
            Your responses span more than one stage. That is common when
            practical experience and professional visibility are moving at
            different paces—no single stage is better than another.
          </div>
        )}

        {expandedGrowth && (
          <dl className="mt-5 space-y-3 border-t border-[var(--kws-border)] pt-4 text-sm">
            <div>
              <dt className="font-semibold text-[var(--kws-ink)]">
                Typical focus at your current stage
              </dt>
              <dd className="mt-0.5 text-[var(--kws-muted)]">
                {growthJourney.indicativeStage.typicalPriority}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--kws-ink)]">
                Suggested progress direction
              </dt>
              <dd className="mt-0.5 text-[var(--kws-muted)]">
                {growthJourney.suggestedProgressDirection}
              </dd>
            </div>
            {growthJourney.biggestChallengeText && (
              <div>
                <dt className="font-semibold text-[var(--kws-ink)]">
                  What you noted as your current challenge
                </dt>
                <dd className="mt-0.5 text-[var(--kws-muted)]">
                  {growthJourney.biggestChallengeText}
                </dd>
              </div>
            )}
            {growthJourney.twelveMonthProgressText && (
              <div>
                <dt className="font-semibold text-[var(--kws-ink)]">
                  Most meaningful progress in 12 months
                </dt>
                <dd className="mt-0.5 text-[var(--kws-muted)]">
                  {growthJourney.twelveMonthProgressText}
                </dd>
              </div>
            )}
          </dl>
        )}
      </Surface>

      {/* C. Six Capabilities (Understanding & Experience kept strictly separate) */}
      <Surface className="p-6 sm:p-8">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
            Section C · Strengths &amp; Growth Areas
          </p>
          <p className="text-sm text-[var(--kws-muted)]">
            Situational understanding and practical experience are shown
            separately for each capability area so you can see where conceptual
            clarity and hands-on application support each other.
          </p>
        </div>

        {/* Two-Dimension Visual Overview (SVG track per capability, click to inspect) */}
        <div
          aria-label="Two-dimension capability comparison"
          className="mt-5 rounded-xl border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 text-xs text-[var(--kws-muted)]">
            <span className="font-semibold text-[var(--kws-ink)]">
              At-a-glance capability comparison
            </span>
            <span>
              Understanding indicator kept separate from 0–4 practical experience
            </span>
          </div>
          <div className="space-y-2">
            {capabilities.map((cap) => {
              const isAligned = cap.understandingScore === 1;
              return (
                <button
                  key={`chart-${cap.pillarId}`}
                  type="button"
                  onClick={() =>
                    setExpandedCapabilities((prev) => ({
                      ...prev,
                      [cap.pillarId]: !prev[cap.pillarId],
                    }))
                  }
                  className="grid w-full grid-cols-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--kws-surface)] sm:grid-cols-12 cursor-pointer"
                >
                  <span className="truncate text-xs font-medium text-[var(--kws-ink)] sm:col-span-5">
                    {cap.name}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] sm:col-span-3">
                    <span
                      aria-hidden="true"
                      className={`inline-block h-2 w-2 rounded-full ${
                        isAligned
                          ? 'bg-[var(--kws-success)]'
                          : 'bg-[var(--kws-gold)]'
                      }`}
                    />
                    <span
                      className={
                        isAligned
                          ? 'font-medium text-[var(--kws-success)]'
                          : 'text-[var(--kws-muted)]'
                      }
                    >
                      {isAligned ? 'Aligned' : 'Explore clarity'}
                    </span>
                  </span>
                  <div className="flex items-center gap-2.5 sm:col-span-4">
                    <svg
                      viewBox="0 0 120 10"
                      className="h-2.5 flex-1"
                      aria-hidden="true"
                    >
                      {[0, 1, 2, 3].map((seg) => (
                        <rect
                          key={seg}
                          x={seg * 31}
                          y={1}
                          width={27}
                          height={8}
                          rx={2}
                          fill={
                            seg < cap.experienceScore
                              ? 'var(--kws-gold)'
                              : 'var(--kws-border)'
                          }
                        />
                      ))}
                    </svg>
                    <span className="w-8 text-right font-mono-tabular text-xs font-semibold text-[var(--kws-ink)]">
                      {cap.experienceScore}/4
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {capabilities.map((cap) => {
            const isOpen = Boolean(expandedCapabilities[cap.pillarId]);
            return (
              <div
                key={cap.pillarId}
                className="space-y-3 border-t border-[var(--kws-border)] pt-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-[var(--kws-ink)]">
                    {cap.name}
                  </h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setExpandedCapabilities((prev) => ({
                        ...prev,
                        [cap.pillarId]: !prev[cap.pillarId],
                      }))
                    }
                    className="print:hidden shrink-0 rounded px-2 py-1 text-xs font-semibold text-[var(--kws-accent)] hover:underline cursor-pointer"
                  >
                    {isOpen ? 'Less' : 'Interpret'}
                  </button>
                </div>

                {/* Dimension 1: Understanding */}
                <div className="flex items-center gap-2 text-xs">
                  {cap.understandingScore === 1 ? (
                    <>
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-[var(--kws-success)]"
                        aria-hidden="true"
                      />
                      <span className="font-medium text-[var(--kws-success)]">
                        Understanding: aligned with sound practice
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle
                        className="h-4 w-4 shrink-0 text-[var(--kws-gold-ink)]"
                        aria-hidden="true"
                      />
                      <span className="font-medium text-[var(--kws-muted)]">
                        Understanding: helpful area to explore further
                      </span>
                    </>
                  )}
                </div>

                {/* Dimension 2: Practical Experience */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="w-20 shrink-0 text-[var(--kws-muted)]">
                      Experience
                    </span>
                    <div className="flex-1">
                      <ProgressBar
                        value={cap.experienceScore}
                        max={4}
                        label={`${cap.name} practical experience`}
                        accent="gold"
                      />
                    </div>
                    <span className="w-9 text-right font-mono-tabular font-semibold text-[var(--kws-ink)]">
                      {cap.experienceScore}/4
                    </span>
                  </div>
                  <p className="text-xs text-[var(--kws-muted)]">
                    {cap.experienceLabel}
                  </p>
                </div>

                {isOpen && (
                  <p className="rounded-lg bg-[var(--kws-surface-subtle)] p-3 text-xs leading-relaxed text-[var(--kws-ink)]">
                    {cap.constructiveInterpretation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Surface>

      {/* D. Development Priorities */}
      <Surface className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
          Development Priorities
        </p>
        <p className="mt-1 text-sm text-[var(--kws-muted)]">
          Open any priority below for supportive context and a practical next
          step.
        </p>

        <div className="mt-4 divide-y divide-[var(--kws-border)]">
          {developmentPriorities.map((priority, idx) => {
            const isOpen = Boolean(expandedPriorities[priority.id]);
            return (
              <div key={priority.id} className="py-3.5 first:pt-1 last:pb-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setExpandedPriorities((prev) => ({
                      ...prev,
                      [priority.id]: !prev[priority.id],
                    }))
                  }
                  className="flex w-full items-center justify-between gap-4 text-left cursor-pointer"
                >
                  <span className="font-display text-base font-bold text-[var(--kws-ink)]">
                    0{idx + 1}. {priority.title}
                  </span>
                  {isOpen ? (
                    <ChevronUp
                      className="h-4 w-4 shrink-0 text-[var(--kws-muted)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-[var(--kws-muted)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
                {isOpen && (
                  <div className="mt-2.5 space-y-2 text-sm">
                    <p className="text-[var(--kws-muted)]">
                      {priority.explanation}
                    </p>
                    <p className="font-medium text-[var(--kws-ink)]">
                      Practical next step: {priority.practicalNextStep}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Surface>

      {/* E. Next Steps */}
      <Surface className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
          Next Steps
        </p>
        <h2 className="mt-2 font-display text-xl font-bold text-[var(--kws-ink)]">
          {nextStep.headline}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--kws-ink)]">
          {nextStep.description}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--kws-muted)]">
          {nextStep.invitationNote}
        </p>

        {!nextStep.wantsConsultation && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--kws-border)] pt-4">
            <Button
              variant="secondary"
              loading={requestingConsultation}
              onClick={async () => {
                setRequestingConsultation(true);
                setConsultationMsg(null);
                try {
                  const updated = await requestConsultation(record.id, 'book');
                  setRecord(updated);
                  onRecordLoaded(updated);
                  setConsultationMsg(
                    'Consultation request recorded. KWS Academy will follow up using your saved contact details.'
                  );
                } catch (err) {
                  setConsultationMsg(
                    err instanceof ApiError
                      ? err.message
                      : 'Unable to update consultation preference right now.'
                  );
                } finally {
                  setRequestingConsultation(false);
                }
              }}
            >
              Request a consultation
            </Button>
          </div>
        )}

        {consultationMsg && (
          <p className="mt-3 text-xs font-medium text-[var(--kws-success)]">
            {consultationMsg}
          </p>
        )}
      </Surface>

      {/* Feedback & Share Summary */}
      <Surface className="p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-[var(--kws-ink)]">
          Help us improve this assessment
        </h2>
        <p className="mt-1 text-sm text-[var(--kws-muted)]">
          Your responses are saved under reference{' '}
          <span className="font-mono-tabular font-medium text-[var(--kws-ink)]">
            {record.id}
          </span>
          . Optional reflection below helps KWS Academy refine the experience.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-[var(--kws-ink)]">
              Did the assessment questions reflect how you think about work?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FIT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setFeedback((prev) => ({ ...prev, archetypeFits: opt }));
                    setFeedbackSavedMsg(null);
                  }}
                  className={`min-h-[40px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                    feedback.archetypeFits === opt
                      ? 'border-[var(--kws-accent)] bg-[var(--kws-accent)] text-[var(--kws-accent-fg)]'
                      : 'border-[var(--kws-border-strong)] bg-[var(--kws-surface)] text-[var(--kws-ink)] hover:border-[var(--kws-accent)]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--kws-ink)]">
              Does the growth stage fit your situation?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FIT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setFeedback((prev) => ({ ...prev, stageFits: opt }));
                    setFeedbackSavedMsg(null);
                  }}
                  className={`min-h-[40px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                    feedback.stageFits === opt
                      ? 'border-[var(--kws-accent)] bg-[var(--kws-accent)] text-[var(--kws-accent-fg)]'
                      : 'border-[var(--kws-border-strong)] bg-[var(--kws-surface)] text-[var(--kws-ink)] hover:border-[var(--kws-accent)]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label
            htmlFor="kws-feedback-notes"
            className="block text-sm font-semibold text-[var(--kws-ink)]"
          >
            Anything confusing, repetitive or missing?
          </label>
          <textarea
            id="kws-feedback-notes"
            rows={3}
            value={feedback.notes}
            onChange={(e) => {
              setFeedback((prev) => ({ ...prev, notes: e.target.value }));
              setFeedbackSavedMsg(null);
            }}
            placeholder="Share any observations about the questions or your results..."
            className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2.5 text-sm text-[var(--kws-ink)] focus:border-[var(--kws-accent)]"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={handleSaveFeedback}
            loading={savingFeedback}
          >
            Save feedback
          </Button>
          {feedbackSavedMsg && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--kws-success)]">
              <Check className="h-4 w-4" aria-hidden="true" />
              {feedbackSavedMsg}
            </span>
          )}
          {feedbackError && (
            <span className="text-sm text-[var(--kws-danger)]">
              {feedbackError}
            </span>
          )}
        </div>

        <div className="mt-6 border-t border-[var(--kws-border)] pt-6 print:hidden">
          <h3 className="font-display text-base font-bold text-[var(--kws-ink)]">
            Share or save a copy of your summary
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={handleCopySummary}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy my summary
            </Button>
            <Button variant="secondary" onClick={handleNativeShare}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(plainTextSummary)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-4 py-2 text-sm font-semibold text-[var(--kws-ink)] hover:border-[var(--kws-accent)] hover:bg-[var(--kws-surface-subtle)] transition-colors whitespace-nowrap shrink-0"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Share via WhatsApp
            </a>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print / Save PDF
            </Button>
            <Button variant="ghost" onClick={onStartNew}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              New assessment
            </Button>
          </div>
          {copyStatus && (
            <p className="mt-2 text-xs text-[var(--kws-muted)]">{copyStatus}</p>
          )}
          <textarea
            readOnly
            aria-label="Plain text discovery summary"
            rows={5}
            value={plainTextSummary}
            className="mt-3 w-full rounded-lg border border-[var(--kws-border)] bg-[var(--kws-bg)] p-3 font-mono-tabular text-xs text-[var(--kws-muted)]"
          />
        </div>
      </Surface>
    </div>
  );
}
