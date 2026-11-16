import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowDown,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { PROFESSIONAL_STYLES } from '../../domain/assessmentContent.ts';
import {
  CAPABILITY_DESCRIPTORS,
  CAPABILITY_HONEST_NOTE,
  KWS_PROGRAMME_INFO,
  MIXED_STAGE_STATEMENT,
  STYLE_PERSONAS,
  buildHeroStyleHeadline,
  buildShareCardPayload,
  getCapabilitySignalBadge,
  selectFeaturedCapability,
} from '../../domain/reportDiscovery.ts';
import type {
  PilotFeedback,
  ProfessionalStyleResult,
  StyleId,
} from '../../domain/types.ts';
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
import { CircularProgressRing } from '../ui/CircularProgressRing.tsx';
import { Surface } from '../ui/Surface.tsx';
import {
  KWS_DURATIONS,
  KWS_EASE,
  KWS_SPRING,
  RevealBlock,
  VIEWPORT_REVEAL,
} from '../ui/motionPrimitives.tsx';
import { GrowthJourneyRadial } from './results/GrowthJourneyRadial.tsx';
import { ShareDiscoveryCard } from './results/ShareDiscoveryCard.tsx';
import { CapabilityIcon, StyleEmblem } from './results/StyleEmblem.tsx';

interface ResultsViewProps {
  submissionId: string;
  initialRecord: PublicRespondentRecord | null;
  onRecordLoaded: (record: PublicRespondentRecord) => void;
  onStartNew: () => void;
  onBackHome: () => void;
}

const FIT_OPTIONS: Array<'Yes' | 'Partly' | 'No'> = ['Yes', 'Partly', 'No'];

const REPORT_CHAPTERS = [
  { id: 'section-reveal', label: '1. Reveal' },
  { id: 'section-style', label: '2. Style' },
  { id: 'section-journey', label: '3. Journey' },
  { id: 'section-capabilities', label: '4. Capabilities' },
  { id: 'section-opportunities', label: '5. Opportunities' },
  { id: 'section-next-steps', label: '6. Next Steps' },
  { id: 'section-share', label: '7. Share Card' },
] as const;

function buildStyleSummaryLabel(style: ProfessionalStyleResult): string {
  if (style.status !== 'complete' || style.leadingStyles.length === 0) {
    return 'Profile in progress';
  }
  const first = style.leadingStyles[0];
  const second = style.leadingStyles[1] ?? style.secondaryStyle;
  if (style.pattern === 'co_leading' && style.leadingStyles.length >= 2) {
    return `${first.name} & ${second?.name ?? ''}`;
  }
  if (style.pattern === 'broad' || style.pattern === 'clustered') {
    return 'Broad multi-style profile';
  }
  return second ? `${first.name} (with a streak of ${second.name})` : first.name;
}

/**
 * Public PII-free plain text summary.
 * Excludes email, WhatsApp phone number, financial readiness, affordability,
 * consultation intent, and raw question responses.
 */
export function formatPublicShareSummary(
  record: PublicRespondentRecord,
  feedback: PilotFeedback
): string {
  const { result, contact } = record;
  const firstName = contact.fullName.trim().split(/\s+/)[0] || contact.fullName.trim();
  const card = buildShareCardPayload(record);

  return [
    'KWS ACADEMY · MY PROFESSIONAL DISCOVERY',
    ...(firstName ? [`Name: ${firstName}`] : []),
    `Working Style: ${buildStyleSummaryLabel(result.professionalStyle)}`,
    `Growth Stage: Stage ${result.growthJourney.indicativeStage.level} of 5 · ${
      result.growthJourney.indicativeStage.name
    }${result.growthJourney.mixedStageFlag ? ' (moving across stages)' : ''}`,
    `Highlighted Capability: ${card.capabilityInsight}`,
    'Focus Areas:',
    ...result.developmentPriorities.map((p, i) => `${i + 1}. ${p.title}`),
    ...(feedback.archetypeFits || feedback.stageFits
      ? [
          `Reflection check – style resonance: ${
            feedback.archetypeFits || '-'
          } | stage resonance: ${feedback.stageFits || '-'}`,
        ]
      : []),
    `Ref: ${record.id}`,
  ].join('\n');
}

export function ResultsView({
  submissionId,
  initialRecord,
  onRecordLoaded,
  onStartNew,
  onBackHome,
}: ResultsViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const [record, setRecord] = useState<PublicRespondentRecord | null>(
    initialRecord && initialRecord.id === submissionId ? initialRecord : null
  );
  const [loading, setLoading] = useState<boolean>(!record);
  const [error, setError] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<string>('section-reveal');

  const [selectedExplorerStyle, setSelectedExplorerStyle] =
    useState<StyleId>('STORYTELLER');
  const [showAllStyles, setShowAllStyles] = useState(false);

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
  const [consultationError, setConsultationError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (record && record.id === submissionId) {
      if (record.result.professionalStyle.leadingStyles[0]) {
        setSelectedExplorerStyle(
          record.result.professionalStyle.leadingStyles[0].styleId
        );
      }
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
        setError(
          err instanceof ApiError
            ? err.message
            : 'We couldn’t open this discovery report right now. Please check your link or connection.'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [submissionId, record, onRecordLoaded]);

  useEffect(() => {
    if (!record || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target.id) {
            setActiveChapter(entry.target.id);
          }
        }
      },
      { rootMargin: '-28% 0px -58% 0px', threshold: 0.01 }
    );

    for (const chapter of REPORT_CHAPTERS) {
      const el = document.getElementById(chapter.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [record]);

  const plainTextSummary = useMemo(() => {
    if (!record) return '';
    return formatPublicShareSummary(record, feedback);
  }, [record, feedback]);

  const shareCardPayload = useMemo(() => {
    if (!record) return null;
    return buildShareCardPayload(record);
  }, [record]);

  const privateReportUrl = useMemo(() => {
    if (!record || typeof window === 'undefined') return null;
    const token = getSubmissionAccessToken(record.id);
    if (!token) return null;
    return `${window.location.origin}/results/${encodeURIComponent(
      record.id
    )}?token=${encodeURIComponent(token)}`;
  }, [record]);

  const handleSaveFeedback = async () => {
    if (!record) return;
    setSavingFeedback(true);
    setFeedbackSavedMsg(null);
    setFeedbackError(null);
    try {
      const updated = await savePilotFeedback(record.id, feedback);
      setRecord(updated);
      onRecordLoaded(updated);
      setFeedbackSavedMsg('Saved—thank you for sharing.');
    } catch (err) {
      setFeedbackError(
        err instanceof ApiError
          ? err.message
          : 'Could not save your note right now. Please try again.'
      );
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleConsultationRequest = async (
    preference: 'book' | 'more_info'
  ) => {
    if (!record) return;
    setRequestingConsultation(true);
    setConsultationMsg(null);
    setConsultationError(null);
    try {
      const updated = await requestConsultation(record.id, preference);
      setRecord(updated);
      onRecordLoaded(updated);
      setConsultationMsg(
        preference === 'book'
          ? 'Conversation request noted—someone from KWS Academy will follow up.'
          : 'Information request noted—someone from KWS Academy will share cohort details.'
      );
    } catch (err) {
      setConsultationError(
        err instanceof ApiError
          ? err.message
          : 'That didn’t go through just now—please try again.'
      );
    } finally {
      setRequestingConsultation(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[780px] px-4 py-14 sm:px-6">
        <Surface className="rounded-[24px] p-8 sm:p-12">
          <div className="h-4 w-44 rounded bg-[var(--kws-surface-subtle)]" />
          <div className="mt-4 h-10 w-3/4 rounded bg-[var(--kws-surface-subtle)]" />
          <div className="mt-3 h-4 w-2/3 rounded bg-[var(--kws-surface-subtle)]" />
          <p className="mt-6 text-sm text-[var(--kws-muted)]">
            Opening your discovery report...
          </p>
        </Surface>
      </div>
    );
  }

  if (error || !record || !shareCardPayload) {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-14 sm:px-6">
        <Surface className="rounded-[24px] p-8">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 text-[var(--kws-danger)]"
              aria-hidden="true"
            />
            <div>
              <h1 className="font-display text-2xl font-bold text-[var(--kws-ink)]">
                Couldn’t open your discovery report
              </h1>
              <p className="mt-2 text-sm text-[var(--kws-muted)]">
                {error ?? 'No saved discovery report was found for this link.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="primary" onClick={onBackHome}>
                  Back to welcome
                </Button>
                <Button variant="secondary" onClick={onStartNew}>
                  Start a fresh discovery
                </Button>
              </div>
            </div>
          </div>
        </Surface>
      </div>
    );
  }

  const { result, contact } = record;
  const {
    professionalStyle,
    growthJourney,
    capabilities,
    developmentPriorities,
    nextStep,
  } = result;

  const firstName = contact.fullName.trim().split(/\s+/)[0] || '';
  const heroCopy = buildHeroStyleHeadline(professionalStyle);
  const primaryStyle = professionalStyle.leadingStyles[0] ?? null;
  const secondLeadingStyle =
    professionalStyle.leadingStyles[1] ?? professionalStyle.secondaryStyle ?? null;
  const primaryStyleId: StyleId | 'BROAD' =
    professionalStyle.pattern === 'broad'
      ? 'BROAD'
      : primaryStyle?.styleId ?? 'STORYTELLER';

  const topStyleScoreCount = professionalStyle.styleScores[0]?.count ?? 0;
  const totalPartAPicks = Math.max(
    1,
    professionalStyle.styleScores.reduce((acc, s) => acc + s.count, 0) || 9
  );
  const sortedStyleScores = [...professionalStyle.styleScores].sort(
    (a, b) => b.count - a.count
  );
  const primaryPersona = primaryStyle
    ? STYLE_PERSONAS[primaryStyle.styleId]
    : STYLE_PERSONAS.STORYTELLER;

  // Capabilities hierarchy & totals
  const understandingTotal = capabilities.reduce(
    (acc, c) => acc + c.understandingScore,
    0
  );
  const experienceTotal = capabilities.reduce(
    (acc, c) => acc + c.experienceScore,
    0
  );
  const featuredCapability = selectFeaturedCapability(result);
  const otherCapabilities = capabilities.filter(
    (c) => c.pillarId !== featuredCapability.pillarId
  );

  const explorerStyle =
    PROFESSIONAL_STYLES.find((s) => s.id === selectedExplorerStyle) ??
    PROFESSIONAL_STYLES[0];

  const scrollToSection = (sectionId: string) => {
    setActiveChapter(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  };

  return (
    <div className="bg-[var(--kws-bg)]">
      {/* Compact Sticky Chapter Jump Bar */}
      <nav
        aria-label="Discovery report sections"
        className="sticky top-0 z-20 border-b border-[var(--kws-border)] bg-[var(--kws-surface)]/95 backdrop-blur-md print:hidden"
      >
        <div className="mx-auto flex max-w-[1040px] items-center gap-1 overflow-x-auto px-4 py-2 sm:justify-between sm:px-6">
          {REPORT_CHAPTERS.map((chapter) => {
            const isActive = activeChapter === chapter.id;
            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => scrollToSection(chapter.id)}
                className={`relative shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[var(--kws-accent)]'
                    : 'text-[var(--kws-muted)] hover:text-[var(--kws-ink)]'
                }`}
              >
                {chapter.label}
                {isActive && (
                  <motion.span
                    layoutId="kws-results-chapter-underline"
                    transition={prefersReducedMotion ? { duration: 0 } : KWS_SPRING}
                    className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-[var(--kws-accent)]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* SECTION 1 — OPENING REVEAL HERO */}
      <section
        id="section-reveal"
        className="relative overflow-hidden text-white"
        style={{ backgroundImage: 'var(--kws-gradient-band)' }}
      >
        {/* Subtle radial atmospheric spotlight behind focal reveal */}
        <div
          className={`pointer-events-none absolute inset-0 ${
            prefersReducedMotion ? '' : 'kws-ambient-breathe'
          }`}
          style={{
            background:
              'radial-gradient(circle at 72% 28%, rgba(242, 169, 0, 0.22) 0%, rgba(141, 155, 255, 0.15) 35%, transparent 68%)',
          }}
          aria-hidden="true"
        />
        {/* Subtle calm floating geometric accents */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-12 right-[18%] hidden h-3 w-3 rounded-full bg-[#ffd166]/45 sm:block ${
            prefersReducedMotion ? '' : 'kws-float-slow'
          }`}
        />
        <span
          aria-hidden="true"
          style={{ animationDelay: '-2.2s' }}
          className={`pointer-events-none absolute bottom-10 left-[8%] hidden h-4 w-4 rounded-full border border-white/25 sm:block ${
            prefersReducedMotion ? '' : 'kws-float-slow-alt'
          }`}
        />

        <div className="relative z-10 mx-auto max-w-[1040px] px-4 py-14 sm:px-6 sm:py-20">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-[#c9d2ff]">
            <span className="tracking-wide uppercase">
              KWS Academy · Personal Discovery Report
            </span>
            <span className="tabular-nums text-white/75">
              Ref {record.id}
            </span>
          </div>

          <div className="mt-8 grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <motion.p
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: KWS_DURATIONS.reveal, ease: KWS_EASE }}
                className="text-sm font-semibold text-[#ffd166] sm:text-base"
              >
                {firstName
                  ? `${firstName}, this is what stood out from your answers`
                  : 'This is what stood out from your answers'}
              </motion.p>
              <motion.p
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: KWS_DURATIONS.reveal,
                  delay: prefersReducedMotion ? 0 : 0.05,
                  ease: KWS_EASE,
                }}
                className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#c9d2ff]"
              >
                {heroCopy.eyebrow}
              </motion.p>

              <motion.h1
                initial={
                  prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 10 }
                }
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: KWS_DURATIONS.hero, ease: KWS_EASE }
                }
                className="kws-shimmer-text mt-2 font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-balance sm:text-6xl"
              >
                {heroCopy.primaryTitle}
              </motion.h1>

              <motion.p
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        duration: KWS_DURATIONS.reveal,
                        delay: 0.14,
                        ease: KWS_EASE,
                      }
                }
                className="mt-5 max-w-2xl text-base leading-relaxed text-[#e8ecff] sm:text-lg"
              >
                {heroCopy.subline}
              </motion.p>

              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        duration: KWS_DURATIONS.reveal,
                        delay: 0.2,
                        ease: KWS_EASE,
                      }
                }
                className="mt-8 flex flex-wrap items-center gap-4 print:hidden"
              >
                <button
                  type="button"
                  onClick={() => scrollToSection('section-style')}
                  className="group inline-flex min-h-[44px] items-center gap-2.5 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-[#14183a] shadow-lg transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-[#eef1fb] active:scale-[0.98] cursor-pointer"
                >
                  Explore your full discovery
                  <ArrowDown
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5"
                    aria-hidden="true"
                  />
                </button>
                <span className="text-xs text-white/75">
                  7 guided sections · Ready immediately
                </span>
              </motion.div>
            </div>

            {/* Hero Emblem & Twin Circular Overview Rings */}
            <div className="flex flex-col items-start gap-6 lg:col-span-4 lg:items-end">
              <motion.div
                initial={
                  prefersReducedMotion
                    ? false
                    : { opacity: 0, scale: 0.94, y: 10 }
                }
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: KWS_DURATIONS.hero, delay: 0.12, ease: KWS_EASE }
                }
                className="flex w-full items-center justify-between gap-5 rounded-[24px] border border-white/20 bg-white/10 p-5 shadow-lg backdrop-blur-md transition-transform duration-300 hover:-translate-y-0.5 sm:w-auto lg:w-full lg:flex-col lg:items-center lg:p-6 lg:text-center"
              >
                <StyleEmblem
                  styleId={primaryStyleId}
                  size="lg"
                  tone="onDark"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#ffd166]">
                    Current Growth Stage
                  </p>
                  <p className="mt-0.5 font-display text-2xl font-bold text-white">
                    {growthJourney.indicativeStage.name}
                  </p>
                  <p className="mt-0.5 text-xs text-white/80 tabular-nums">
                    Stage {growthJourney.indicativeStage.level} of 5
                  </p>
                </div>
                {professionalStyle.status === 'complete' && (
                  <div className="hidden border-t border-white/15 pt-4 lg:block lg:w-full">
                    <div className="flex items-center justify-center gap-3 text-xs text-white/85">
                      <span className="tabular-nums font-semibold">
                        Top pull: {topStyleScoreCount} / {totalPartAPicks} scenarios
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — PROFESSIONAL STYLE DEEP-DIVE */}
      <section
        id="section-style"
        className="mx-auto max-w-[1040px] px-4 py-12 sm:px-6 sm:py-16"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[var(--kws-accent)]">
              Section 2 · How You Naturally Work
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[var(--kws-ink)] text-balance sm:text-4xl">
              Your Professional Style
            </h2>
          </div>
          {professionalStyle.status === 'complete' && (
            <p className="text-xs font-medium text-[var(--kws-muted)] tabular-nums">
              Across 9 work scenarios
            </p>
          )}
        </div>

        <RevealBlock className="mt-6">
          <Surface className="rounded-[24px] p-6 sm:p-9">
          {professionalStyle.status === 'complete' && primaryStyle ? (
            <div className="space-y-8">
              {/* Lead Narrative + Emblem */}
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <StyleEmblem styleId={primaryStyleId} size="md" tone="brand" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-display text-2xl font-bold text-[var(--kws-ink)] sm:text-3xl">
                      {professionalStyle.leadTitle}
                    </h3>
                    <span className="text-sm font-medium text-[var(--kws-muted)]">
                      · {primaryStyle.tagline}
                    </span>
                  </div>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--kws-ink)]">
                    {primaryStyle.description}
                  </p>

                  {secondLeadingStyle && (
                    <p className="mt-3 text-sm leading-relaxed text-[var(--kws-muted)]">
                      {professionalStyle.pattern === 'co_leading'
                        ? `Right alongside it sits ${secondLeadingStyle.name}—meaning you move easily between ${primaryStyle.name.toLowerCase()} energy and ${secondLeadingStyle.tagline.toLowerCase()}.`
                        : `Your secondary thread is ${secondLeadingStyle.name} (${secondLeadingStyle.tagline.toLowerCase()}), which adds helpful range to your primary lean.`}
                    </p>
                  )}
                </div>
              </div>

              {/* Conversational "Where this shows up" & "Something to explore" */}
              <div className="grid grid-cols-1 gap-6 border-t border-[var(--kws-border)] pt-7 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-bold text-[var(--kws-ink)]">
                    Where this shows up naturally
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--kws-muted)]">
                    {primaryPersona.whereItShowsUp}
                  </p>
                  <ul className="mt-3.5 space-y-2 text-sm text-[var(--kws-ink)]">
                    {primaryStyle.likelyContributions.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--kws-accent)]"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-5">
                  <div>
                    <h4 className="text-sm font-bold text-[var(--kws-ink)]">
                      Something worth balancing
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--kws-muted)]">
                      {primaryStyle.blindSpot}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--kws-ink)]">
                      {primaryPersona.whatToExplore}
                    </p>
                  </div>

                  <div className="border-t border-[var(--kws-border)] pt-4">
                    <p className="text-xs font-semibold text-[var(--kws-accent)]">
                      A question to sit with
                    </p>
                    <p className="mt-1.5 text-sm italic leading-relaxed text-[var(--kws-ink)]">
                      “{professionalStyle.reflectionPrompt}”
                    </p>
                  </div>
                </div>
              </div>

              {/* All 6 Style Signals rendered purely with Circular Rings (NO horizontal bars!) */}
              <div className="border-t border-[var(--kws-border)] pt-7">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-sm font-bold text-[var(--kws-ink)]">
                    How your scenario instincts spread across all six styles
                  </h4>
                  <span className="text-xs text-[var(--kws-muted)]">
                    Times each instinct came up (out of {totalPartAPicks})
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  {sortedStyleScores.map((item, idx) => {
                    const isLead = professionalStyle.leadingStyles.some(
                      (s) => s.styleId === item.styleId
                    );
                    return (
                      <motion.div
                        key={item.styleId}
                        initial={
                          prefersReducedMotion
                            ? false
                            : { opacity: 0, y: 10, scale: 0.97 }
                        }
                        whileInView={{ opacity: 1, y: 0, scale: 1 }}
                        viewport={VIEWPORT_REVEAL}
                        transition={{
                          duration: KWS_DURATIONS.reveal,
                          delay: prefersReducedMotion ? 0 : idx * 0.04,
                          ease: KWS_EASE,
                        }}
                        className={`flex flex-col items-center rounded-[18px] px-3 py-4 text-center transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 ${
                          isLead
                            ? 'bg-[var(--kws-tint-bg)] shadow-xs'
                            : 'bg-[var(--kws-surface-subtle)]/55'
                        }`}
                      >
                        <CircularProgressRing
                          viewportReveal
                          metric={{
                            id: `style_ring_${item.styleId}`,
                            label: item.name,
                            value: item.count,
                            max: totalPartAPicks,
                            displayValue: `${item.count}`,
                            sublabel: idx === 0 ? 'Top pull' : '',
                            tone: isLead
                              ? 'accent'
                              : item.count > 0
                                ? 'gold'
                                : 'muted',
                          }}
                          size="sm"
                          showLabel={false}
                        />
                        <p
                          className={`mt-2.5 text-xs font-semibold leading-tight ${
                            isLead
                              ? 'text-[var(--kws-accent)]'
                              : 'text-[var(--kws-ink)]'
                          }`}
                        >
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--kws-muted)] tabular-nums">
                          {item.count} of {totalPartAPicks}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Optional Collapsible Reference to All 6 Styles */}
              <div className="border-t border-[var(--kws-border)] pt-4 print:hidden">
                <button
                  type="button"
                  onClick={() => setShowAllStyles((v) => !v)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--kws-accent)] hover:text-[var(--kws-accent-hover)] cursor-pointer"
                >
                  {showAllStyles ? (
                    <>
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      Hide the six-style guide
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      Curious about all six KWS styles? Peek at the guide
                    </>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {showAllStyles && (
                    <motion.div
                      key="six-style-guide"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }
                      }
                      transition={{ duration: KWS_DURATIONS.base, ease: KWS_EASE }}
                      className="mt-4"
                    >
                      <div className="flex flex-wrap gap-2">
                        {PROFESSIONAL_STYLES.map((style) => {
                          const selected = explorerStyle.id === style.id;
                          return (
                            <button
                              key={style.id}
                              type="button"
                              onClick={() => setSelectedExplorerStyle(style.id)}
                              className={`min-h-[34px] rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.97] ${
                                selected
                                  ? 'bg-[var(--kws-accent)] text-[var(--kws-accent-fg)] shadow-xs'
                                  : 'border border-[var(--kws-border)] bg-[var(--kws-surface)] text-[var(--kws-ink)] hover:border-[var(--kws-accent)]'
                              }`}
                            >
                              {style.name}
                            </button>
                          );
                        })}
                      </div>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={explorerStyle.id}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={
                            prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -2 }
                          }
                          transition={{ duration: KWS_DURATIONS.fast, ease: KWS_EASE }}
                          className="mt-3 rounded-[16px] bg-[var(--kws-tint-bg)] p-4"
                        >
                          <p className="text-sm font-bold text-[var(--kws-ink)]">
                            {explorerStyle.name} ·{' '}
                            <span className="font-normal text-[var(--kws-muted)]">
                              {explorerStyle.tagline}
                            </span>
                          </p>
                          <p className="mt-1.5 text-sm text-[var(--kws-muted)]">
                            {explorerStyle.description}
                          </p>
                        </motion.div>
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-base leading-relaxed text-[var(--kws-ink)]">
                {professionalStyle.configurationMessage}
              </p>
              <p className="text-sm text-[var(--kws-muted)]">
                {professionalStyle.reflectionPrompt}
              </p>
            </div>
          )}
          </Surface>
        </RevealBlock>
      </section>

      {/* SECTION 3 — GROWTH JOURNEY (RADIAL STAGE VISUALIZATION) */}
      <section
        id="section-journey"
        className="border-y border-[var(--kws-border)] bg-[var(--kws-tint-bg)]"
      >
        <div className="mx-auto max-w-[1040px] px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[var(--kws-accent)]">
              Section 3 · Your Growth Journey
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[var(--kws-ink)] text-balance sm:text-4xl">
              Where you are on your path
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-[var(--kws-muted)] sm:text-base">
              Tap any stop along the arc to see what comes before and after. No
              stage is “behind”—each one builds something distinct.
            </p>
          </div>

          <div className="mt-8">
            <GrowthJourneyRadial
              currentStage={growthJourney.indicativeStage}
              mixedStageFlag={growthJourney.mixedStageFlag}
              mixedStageObservation={MIXED_STAGE_STATEMENT}
            />
          </div>

          {(growthJourney.biggestChallengeText ||
            growthJourney.twelveMonthProgressText) && (
            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {growthJourney.biggestChallengeText && (
                <div className="rounded-[18px] border border-[var(--kws-border)] bg-[var(--kws-surface)] p-5">
                  <p className="text-xs font-semibold text-[var(--kws-muted)]">
                    What you named as your biggest hurdle
                  </p>
                  <p className="mt-1.5 text-sm font-medium leading-relaxed text-[var(--kws-ink)]">
                    {growthJourney.biggestChallengeText}
                  </p>
                </div>
              )}
              {growthJourney.twelveMonthProgressText && (
                <div className="rounded-[18px] border border-[var(--kws-border)] bg-[var(--kws-surface)] p-5">
                  <p className="text-xs font-semibold text-[var(--kws-muted)]">
                    What would make the next 12 months count
                  </p>
                  <p className="mt-1.5 text-sm font-medium leading-relaxed text-[var(--kws-ink)]">
                    {growthJourney.twelveMonthProgressText}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 4 — CAPABILITIES (ALL 6 AREAS · CIRCULAR GAUGES ONLY) */}
      <section
        id="section-capabilities"
        className="mx-auto max-w-[1040px] px-4 py-12 sm:px-6 sm:py-16"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[var(--kws-accent)]">
              Section 4 · Six Core Capabilities
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[var(--kws-ink)] text-balance sm:text-4xl">
              What you know & what you’ve done
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-[var(--kws-muted)] sm:text-base">
              {CAPABILITY_HONEST_NOTE}
            </p>
          </div>

          {/* Twin Overall Circular Gauges */}
          <div className="flex flex-wrap items-center gap-6 rounded-[20px] border border-[var(--kws-border)] bg-[var(--kws-surface)] px-5 py-4">
            <CircularProgressRing
              viewportReveal
              layout="inline"
              size="sm"
              metric={{
                id: 'overall_understanding',
                label: 'What you know',
                value: understandingTotal,
                max: capabilities.length || 6,
                displayValue: `${understandingTotal}/${capabilities.length || 6}`,
                sublabel: 'Scenario instincts',
                tone: 'accent',
              }}
            />
            <div
              className="hidden h-9 w-px bg-[var(--kws-border)] sm:block"
              aria-hidden="true"
            />
            <CircularProgressRing
              viewportReveal
              layout="inline"
              size="sm"
              metric={{
                id: 'overall_experience',
                label: 'What you’ve done',
                value: experienceTotal,
                max: (capabilities.length || 6) * 4,
                displayValue: `${experienceTotal}/${(capabilities.length || 6) * 4}`,
                sublabel: 'Practical mileage',
                tone: 'gold',
              }}
            />
          </div>
        </div>

        {/* Hierarchical Featured Card: "An area worth building on" */}
        {(() => {
          const badge = getCapabilitySignalBadge(
            featuredCapability.understandingScore,
            featuredCapability.experienceScore
          );
          const desc = CAPABILITY_DESCRIPTORS[featuredCapability.pillarId];
          return (
            <motion.div
              initial={
                prefersReducedMotion
                  ? false
                  : { opacity: 0, y: 12, scale: 0.99 }
              }
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={VIEWPORT_REVEAL}
              transition={{
                duration: KWS_DURATIONS.reveal,
                ease: KWS_EASE,
              }}
              className="mt-8 rounded-[26px] border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] p-6 shadow-md sm:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--kws-accent)]">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>An area worth building on</span>
                </div>
                <span className="text-xs font-semibold text-[var(--kws-muted)]">
                  {badge.label}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--kws-tint-bg)] text-[var(--kws-accent)]">
                      <CapabilityIcon pillarId={featuredCapability.pillarId} />
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-bold text-[var(--kws-ink)] sm:text-2xl">
                        {featuredCapability.name}
                      </h3>
                      <p className="text-xs text-[var(--kws-muted)]">
                        {desc.focusAngle}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-[var(--kws-ink)] sm:text-base">
                    {featuredCapability.constructiveInterpretation}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 rounded-[20px] bg-[var(--kws-tint-bg)] p-4 lg:col-span-5">
                  <CircularProgressRing
                    viewportReveal
                    size="md"
                    metric={{
                      id: `feat_u_${featuredCapability.pillarId}`,
                      label: 'Understanding',
                      value: featuredCapability.understandingScore,
                      max: 1,
                      displayValue: `${featuredCapability.understandingScore}/1`,
                      sublabel:
                        featuredCapability.understandingScore === 1
                          ? 'On the mark'
                          : 'New angle',
                      tone: 'accent',
                    }}
                  />
                  <CircularProgressRing
                    viewportReveal
                    size="md"
                    metric={{
                      id: `feat_e_${featuredCapability.pillarId}`,
                      label: 'Experience',
                      value: featuredCapability.experienceScore,
                      max: 4,
                      displayValue: `${featuredCapability.experienceScore}/4`,
                      sublabel: featuredCapability.experienceLabel,
                      tone: 'gold',
                      segments: 4,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* Remaining 5 Capabilities: Open Compact Two-Column Grid */}
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {otherCapabilities.map((cap, idx) => {
            const badge = getCapabilitySignalBadge(
              cap.understandingScore,
              cap.experienceScore
            );
            return (
              <motion.div
                key={cap.pillarId}
                initial={
                  prefersReducedMotion
                    ? false
                    : { opacity: 0, y: 12, scale: 0.99 }
                }
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={VIEWPORT_REVEAL}
                transition={{
                  duration: KWS_DURATIONS.reveal,
                  delay: prefersReducedMotion ? 0 : (idx % 2) * 0.06,
                  ease: KWS_EASE,
                }}
                className="flex flex-col justify-between rounded-[22px] border border-[var(--kws-border)] bg-[var(--kws-surface)] p-5 transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-[var(--kws-border-strong)] hover:shadow-[var(--kws-shadow-card)] sm:p-6"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--kws-tint-bg)] text-[var(--kws-accent)]">
                        <CapabilityIcon
                          pillarId={cap.pillarId}
                          className="h-4 w-4"
                        />
                      </span>
                      <h3 className="font-display text-lg font-bold leading-snug text-[var(--kws-ink)]">
                        {cap.name}
                      </h3>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-[var(--kws-muted)]">
                      {badge.label}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-[var(--kws-muted)]">
                    {cap.constructiveInterpretation}
                  </p>
                </div>

                {/* Circular Gauges Side-by-Side (NO horizontal bars) */}
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--kws-border)] pt-4">
                  <CircularProgressRing
                    viewportReveal
                    layout="inline"
                    size="sm"
                    metric={{
                      id: `cap_u_${cap.pillarId}`,
                      label: 'Know',
                      value: cap.understandingScore,
                      max: 1,
                      displayValue: `${cap.understandingScore}/1`,
                      sublabel:
                        cap.understandingScore === 1 ? 'On the mark' : 'Explore',
                      tone: 'accent',
                    }}
                  />
                  <CircularProgressRing
                    viewportReveal
                    layout="inline"
                    size="sm"
                    metric={{
                      id: `cap_e_${cap.pillarId}`,
                      label: 'Done',
                      value: cap.experienceScore,
                      max: 4,
                      displayValue: `${cap.experienceScore}/4`,
                      sublabel: cap.experienceLabel,
                      tone: 'gold',
                      segments: 4,
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* SECTION 5 — OPPORTUNITIES FOR DEVELOPMENT */}
      <section
        id="section-opportunities"
        className="border-y border-[var(--kws-border)] bg-[var(--kws-tint-bg)]"
      >
        <div className="mx-auto max-w-[1040px] px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[var(--kws-accent)]">
              Section 5 · Focused Momentum
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[var(--kws-ink)] text-balance sm:text-4xl">
              Three practical places to grow next
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-[var(--kws-muted)] sm:text-base">
              You don’t need to chase everything at once. Here are the three most
              useful levers based on your stage and hands-on experience today.
            </p>
          </div>

          <div className="mt-8 divide-y divide-[var(--kws-border)] rounded-[24px] border border-[var(--kws-border)] bg-[var(--kws-surface)]">
            {developmentPriorities.map((priority, idx) => (
              <motion.div
                key={priority.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT_REVEAL}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        duration: KWS_DURATIONS.reveal,
                        delay: idx * 0.07,
                        ease: KWS_EASE,
                      }
                }
                className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-12 sm:items-start sm:gap-6 sm:p-8"
              >
                <div className="sm:col-span-5">
                  <span className="font-display text-3xl font-extrabold text-[var(--kws-accent)] tabular-nums">
                    0{idx + 1}
                  </span>
                  <h3 className="mt-1 font-display text-xl font-bold text-[var(--kws-ink)]">
                    {priority.title}
                  </h3>
                </div>
                <div className="space-y-2.5 sm:col-span-7">
                  <p className="text-sm leading-relaxed text-[var(--kws-muted)] sm:text-base">
                    {priority.explanation}
                  </p>
                  <p className="text-sm font-semibold leading-relaxed text-[var(--kws-ink)]">
                    Practical step: {priority.practicalNextStep}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6 — PERSONAL NEXT STEPS & OPTIONAL KWS PROGRAMME */}
      <section
        id="section-next-steps"
        className="mx-auto max-w-[1040px] px-4 py-12 sm:px-6 sm:py-16"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-[var(--kws-accent)]">
            Section 6 · Moving Forward
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-[var(--kws-ink)] text-balance sm:text-4xl">
            {nextStep.headline}
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-[var(--kws-muted)] sm:text-base">
            {nextStep.description}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Self-Directed Action Card */}
          <RevealBlock className="rounded-[24px] border border-[var(--kws-border)] bg-[var(--kws-surface)] p-6 sm:p-7 lg:col-span-5">
            <p className="text-xs font-semibold text-[var(--kws-accent)]">
              On your own this month
            </p>
            <h3 className="mt-2 font-display text-xl font-bold text-[var(--kws-ink)]">
              One concrete move to test
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-[var(--kws-muted)]">
              {nextStep.invitationNote}
            </p>
            <p className="mt-4 border-t border-[var(--kws-border)] pt-4 text-sm font-medium leading-relaxed text-[var(--kws-ink)]">
              {growthJourney.suggestedProgressDirection}
            </p>
          </RevealBlock>

          {/* KWS Programme Info & Consultation Status */}
          <RevealBlock
            delay={0.07}
            className="rounded-[24px] border border-[var(--kws-border)] bg-[var(--kws-surface)] p-6 sm:p-7 lg:col-span-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--kws-accent)]">
                Optional structured pathway
              </p>
              <span className="text-xs font-medium text-[var(--kws-muted)]">
                Zero pressure · Take your time
              </span>
            </div>

            <h3 className="mt-2 font-display text-xl font-bold text-[var(--kws-ink)] sm:text-2xl">
              {KWS_PROGRAMME_INFO.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--kws-muted)]">
              If you decide structured coaching, real briefs, and peer feedback
              would accelerate your {growthJourney.indicativeStage.name} stage,
              here are the current programme details:
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 rounded-[18px] bg-[var(--kws-tint-bg)] p-4 text-sm sm:grid-cols-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--kws-muted)]">
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  Duration
                </p>
                <p className="mt-1 font-semibold text-[var(--kws-ink)]">
                  {KWS_PROGRAMME_INFO.duration}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--kws-muted)]">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  Format
                </p>
                <p className="mt-1 font-semibold text-[var(--kws-ink)]">
                  {KWS_PROGRAMME_INFO.format}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--kws-muted)]">
                  <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                  Programme fee
                </p>
                <p className="mt-1 font-semibold tabular-nums text-[var(--kws-ink)]">
                  {KWS_PROGRAMME_INFO.fee}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--kws-muted)]">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  Next cohort
                </p>
                <p className="mt-1 font-semibold text-[var(--kws-ink)]">
                  {KWS_PROGRAMME_INFO.nextCohort}
                </p>
              </div>
            </div>

            {/* Respectful Tailored Consultation Handling (book / more_info / none) */}
            <div className="mt-5 border-t border-[var(--kws-border)] pt-5">
              {nextStep.consultationIntent === 'book' ||
              record.consultationSummary.preference === 'book' ? (
                <div className="flex items-start gap-2.5 text-sm font-medium text-[var(--kws-accent)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Conversation requested—KWS Academy has your note and will
                    reach out about walking through your profile.
                  </span>
                </div>
              ) : nextStep.consultationIntent === 'more_info' ||
                record.consultationSummary.preference === 'more_info' ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 text-sm font-medium text-[var(--kws-accent)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      Programme details requested—we’ve noted your interest in
                      learning more about the January 2027 cohort.
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={requestingConsultation}
                    onClick={() => handleConsultationRequest('book')}
                  >
                    Also request a conversation
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[var(--kws-muted)]">
                    You chose no follow-up right now—your discovery report is
                    yours to keep and revisit anytime.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={requestingConsultation}
                    onClick={() => handleConsultationRequest('book')}
                    className="shrink-0"
                  >
                    Book a chat later
                  </Button>
                </div>
              )}

              {consultationMsg && (
                <p className="mt-3 text-xs font-semibold text-[var(--kws-accent)]">
                  {consultationMsg}
                </p>
              )}
              {consultationError && (
                <p className="mt-2 text-xs text-[var(--kws-danger)]">
                  {consultationError}
                </p>
              )}
            </div>
          </RevealBlock>
        </div>

        {/* Light Quick Feedback Block */}
        <RevealBlock className="mt-6">
          <Surface className="rounded-[24px] p-6 sm:p-7 print:hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                Quick check: did this feel like you?
              </h3>
              <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
                Optional 15-second note—helps us keep the discovery sharp.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-[var(--kws-ink)]">
                Did your style profile feel accurate?
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
                    className={`min-h-[36px] rounded-full border px-4 py-1 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.97] ${
                      feedback.archetypeFits === opt
                        ? 'border-[var(--kws-accent)] bg-[var(--kws-accent)] text-[var(--kws-accent-fg)] shadow-xs'
                        : 'border-[var(--kws-border-strong)] bg-[var(--kws-surface)] text-[var(--kws-ink)] hover:border-[var(--kws-accent)]'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[var(--kws-ink)]">
                Did the growth stage fit where you are?
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
                    className={`min-h-[36px] rounded-full border px-4 py-1 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.97] ${
                      feedback.stageFits === opt
                        ? 'border-[var(--kws-accent)] bg-[var(--kws-accent)] text-[var(--kws-accent-fg)] shadow-xs'
                        : 'border-[var(--kws-border-strong)] bg-[var(--kws-surface)] text-[var(--kws-ink)] hover:border-[var(--kws-accent)]'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="kws-feedback-notes"
                className="block text-xs font-semibold text-[var(--kws-ink)]"
              >
                Anything unclear or missing?
              </label>
              <input
                id="kws-feedback-notes"
                type="text"
                value={feedback.notes}
                onChange={(e) => {
                  setFeedback((prev) => ({ ...prev, notes: e.target.value }));
                  setFeedbackSavedMsg(null);
                }}
                placeholder="Any short thought you’d like to leave..."
                className="mt-1.5 w-full rounded-[12px] border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3.5 py-2 text-sm text-[var(--kws-ink)] focus:border-[var(--kws-accent)]"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveFeedback}
              loading={savingFeedback}
              className="shrink-0"
            >
              Save note
            </Button>
          </div>
          <AnimatePresence>
            {feedbackSavedMsg && (
              <motion.p
                key="feedback-saved"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: KWS_DURATIONS.fast, ease: KWS_EASE }}
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--kws-accent)]"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {feedbackSavedMsg}
              </motion.p>
            )}
          </AnimatePresence>
          {feedbackError && (
            <p className="mt-2 text-xs text-[var(--kws-danger)]">
              {feedbackError}
            </p>
          )}
          </Surface>
        </RevealBlock>
      </section>

      {/* SECTION 7 — SHAREABLE DISCOVERY CARD & EXPORT */}
      <section
        id="section-share"
        className="border-t border-[var(--kws-border)] bg-[var(--kws-tint-bg)]"
      >
        <div className="mx-auto max-w-[1040px] px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-xs font-semibold text-[var(--kws-accent)]">
            Section 7 · Save & Share
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-[var(--kws-ink)] text-balance sm:text-4xl">
            Your Discovery Card
          </h2>

          <RevealBlock className="mt-8">
            <ShareDiscoveryCard
              payload={shareCardPayload}
              leadStyleId={primaryStyleId}
              plainTextSummary={plainTextSummary}
              privateReportUrl={privateReportUrl}
              onStartNew={onStartNew}
            />
          </RevealBlock>
        </div>
      </section>
    </div>
  );
}
