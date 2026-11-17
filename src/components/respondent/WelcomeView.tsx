import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  ChevronDown,
  Compass,
  Layers,
  ListChecks,
  MessageCircle,
  Minus,
  Plus,
  Route,
  TrendingUp,
} from 'lucide-react';
import { ASSESSMENT_SECTIONS } from '../../domain/assessmentContent.ts';
import type { AssessmentSectionMeta } from '../../domain/types.ts';
import { Button } from '../ui/Button.tsx';
import { JourneyDotsPill } from '../ui/JourneyIndicator.tsx';
import { KWS_EASE } from '../ui/motionPrimitives.tsx';

interface WelcomeViewProps {
  hasStarted: boolean;
  answeredCount: number;
  lastSubmissionId: string | null;
  sections?: AssessmentSectionMeta[];
  onStartOrResume: () => void;
  onRestart: () => void;
  onViewLastResults: (id: string) => void;
}

const DISCOVER_IMAGE_SRC =
  '/src/assets/images/kws_discover_studio_1794833870475.jpg';

const DISCOVER_DESCRIPTIONS = [
  'How you naturally step in when ideas, people, and plans are moving.',
  'Where you sit right now along five steps of building a creative career.',
  'What you know and what you’ve actually done across six core media areas.',
];

const GAIN_CAROUSEL_ITEMS = [
  {
    id: 'gain-style',
    title: 'Your Professional Style',
    description:
      'How you naturally handle ideas, creative work, people, plans, and opportunities.',
    Icon: Compass,
  },
  {
    id: 'gain-journey',
    title: 'Your Growth Journey',
    description:
      'Where you stand right now on your path, and what will move you forward next.',
    Icon: TrendingUp,
  },
  {
    id: 'gain-strengths',
    title: 'Your Strengths & Growth Areas',
    description:
      'What you know and what you’ve done across six core areas, shown side by side.',
    Icon: BarChart3,
  },
  {
    id: 'gain-priorities',
    title: 'What to Focus On Next',
    description:
      'Two or three practical things worth your energy, explained in plain language.',
    Icon: ListChecks,
  },
  {
    id: 'gain-next-steps',
    title: 'Practical Next Steps',
    description:
      'Ideas you can try right away—with zero pressure to sign up for anything.',
    Icon: Route,
  },
  {
    id: 'gain-consultation',
    title: 'An Optional Chat',
    description:
      'A chance to talk your results through with KWS Academy if you’d like to.',
    Icon: MessageCircle,
  },
] as const;

const FAQ_ITEMS = [
  {
    question: 'Do I need industry experience?',
    answer:
      'Not at all. Go with your gut on everyday situations—no industry jargon required.',
  },
  {
    question: 'Are there right or wrong answers?',
    answer:
      'No. There is no pass or fail here, and no trick answers. Just pick what feels closest to how you really work.',
  },
  {
    question: 'What will I see at the end?',
    answer:
      'Your working style, where you are on your path, your six strengths, and a few simple ideas for what to try next.',
  },
  {
    question: 'Do I have to wait or sign up to see my profile?',
    answer:
      'Never. Your full results appear straight away as soon as you finish.',
  },
  {
    question: 'Is this an exam or a career guarantee?',
    answer:
      'No—it’s a mirror, not a test. It helps you spot your strengths and momentum without grading you or promising jobs.',
  },
] as const;

const DISCOVER_ICONS = [Compass, TrendingUp, Layers];

function BrandAbstractArtwork({
  prefersReducedMotion,
}: {
  prefersReducedMotion: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 82% 18%, rgba(232, 206, 156, 0.34) 0%, rgba(147, 58, 115, 0.42) 32%, transparent 64%), radial-gradient(circle at 18% 82%, rgba(95, 27, 71, 0.92) 0%, rgba(41, 33, 42, 0.98) 70%), linear-gradient(145deg, #29212a 0%, #4b1538 48%, #5f1b47 100%)',
      }}
    >
      {/* Layered geometric & organic brand forms in burgundy, mauve & champagne */}
      <svg
        viewBox="0 0 600 620"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        fill="none"
      >
        <defs>
          <linearGradient id="kws-art-arch" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8ce9c" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#e8d5e0" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#5f1b47" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="kws-art-petal" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#f7f1f4" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#c6a46a" stopOpacity="0.16" />
          </linearGradient>
          <radialGradient id="kws-art-orb" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e8ce9c" stopOpacity="0.72" />
            <stop offset="52%" stopColor="#c6a46a" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#5f1b47" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft ambient warm glow upper-right */}
        <circle cx="445" cy="145" r="220" fill="url(#kws-art-orb)" />

        {/* Large abstract architectural curves */}
        <path
          d="M-40 500 C 80 340, 220 220, 420 210 C 540 204, 620 270, 640 360 L 640 650 L -40 650 Z"
          fill="url(#kws-art-petal)"
        />
        <path
          d="M110 640 C 120 430, 250 280, 445 275 C 535 273, 595 315, 620 390 L 620 640 Z"
          fill="#5f1b47"
          fillOpacity="0.48"
        />

        {/* Intersecting sculptural rings */}
        <circle
          cx="295"
          cy="285"
          r="158"
          stroke="url(#kws-art-arch)"
          strokeWidth="1.8"
        />
        <circle
          cx="295"
          cy="285"
          r="112"
          stroke="#e8d5e0"
          strokeOpacity="0.28"
          strokeWidth="1.4"
        />

        {/* Rotating subtle dotted orbital arcs (hidden or static under reduced motion) */}
        <g
          className={prefersReducedMotion ? '' : 'kws-orbit-cw'}
          style={{ transformOrigin: '295px 285px' }}
        >
          <circle
            cx="295"
            cy="285"
            r="192"
            stroke="#e8ce9c"
            strokeOpacity="0.34"
            strokeWidth="2"
            strokeDasharray="4 14"
            strokeLinecap="round"
          />
          <circle cx="295" cy="93" r="5" fill="#e8ce9c" fillOpacity="0.88" />
          <circle cx="295" cy="477" r="4" fill="#e8d5e0" fillOpacity="0.72" />
        </g>

        <g
          className={prefersReducedMotion ? '' : 'kws-orbit-ccw'}
          style={{ transformOrigin: '295px 285px' }}
        >
          <circle
            cx="295"
            cy="285"
            r="134"
            stroke="#f7f1f4"
            strokeOpacity="0.24"
            strokeWidth="1.5"
            strokeDasharray="12 12"
            strokeLinecap="round"
          />
          <circle cx="161" cy="285" r="4" fill="#c6a46a" fillOpacity="0.85" />
        </g>

        {/* Central abstract four-petal prism symbolizing the four parts */}
        <g transform="translate(295 285)">
          <rect
            x="-46"
            y="-46"
            width="92"
            height="92"
            rx="28"
            transform="rotate(45)"
            fill="#f7f1f4"
            fillOpacity="0.1"
            stroke="#e8ce9c"
            strokeOpacity="0.48"
            strokeWidth="1.5"
          />
          <circle cx="0" cy="-22" r="7" fill="#e8ce9c" fillOpacity="0.92" />
          <circle cx="22" cy="0" r="5.5" fill="#e8d5e0" fillOpacity="0.72" />
          <circle cx="0" cy="22" r="5.5" fill="#e8d5e0" fillOpacity="0.58" />
          <circle cx="-22" cy="0" r="5.5" fill="#c6a46a" fillOpacity="0.75" />
        </g>
      </svg>

      {/* Subtle fine grain overlay */}
      <div className="kws-welcome-grain pointer-events-none absolute inset-0" />
    </div>
  );
}

export function WelcomeView({
  hasStarted,
  answeredCount,
  lastSubmissionId,
  sections = ASSESSMENT_SECTIONS,
  onStartOrResume,
  onRestart,
  onViewLastResults,
}: WelcomeViewProps) {
  const [discoverImageError, setDiscoverImageError] = useState(false);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);
  const [isCarouselPressed, setIsCarouselPressed] = useState(false);
  const [isCarouselFocused, setIsCarouselFocused] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [openDetails, setOpenDetails] = useState<{
    stages: boolean;
    overview: boolean;
    faq: boolean;
  }>({
    stages: false,
    overview: false,
    faq: false,
  });
  const prefersReducedMotion = Boolean(useReducedMotion());
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const detailsSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    if (hash === 'stages' || hash === 'overview' || hash === 'faq') {
      setOpenDetails((prev) => ({ ...prev, [hash]: true }));
      window.setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({
          behavior: prefersReducedMotion ? 'instant' : 'smooth',
          block: 'start',
        });
      }, 60);
    } else {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'instant' : 'smooth',
      });
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'stages' || hash === 'overview' || hash === 'faq') {
        setOpenDetails((prev) => ({ ...prev, [hash]: true }));
        window.setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView({
            behavior: prefersReducedMotion ? 'instant' : 'smooth',
            block: 'start',
          });
        }, 60);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!isCarouselPressed) return;
    const handleRelease = () => setIsCarouselPressed(false);
    window.addEventListener('pointerup', handleRelease);
    window.addEventListener('pointercancel', handleRelease);
    return () => {
      window.removeEventListener('pointerup', handleRelease);
      window.removeEventListener('pointercancel', handleRelease);
    };
  }, [isCarouselPressed]);

  const primaryCtaLabel =
    hasStarted && answeredCount > 0 ? 'Continue discovery' : 'Start discovering';

  const discoverThreeSections = sections.slice(0, 3);
  const isCarouselPaused =
    isCarouselHovered || isCarouselPressed || isCarouselFocused;

  const renderCarouselSet = (prefix: string, ariaHidden: boolean) => (
    <div
      aria-hidden={ariaHidden || undefined}
      className="flex shrink-0 items-stretch gap-4 pr-4 sm:gap-6 sm:pr-6"
    >
      {GAIN_CAROUSEL_ITEMS.map((item) => {
        const Icon = item.Icon;
        return (
          <article
            key={`${prefix}-${item.id}`}
            className="group flex w-[75vw] max-w-[330px] shrink-0 flex-col justify-between rounded-[22px] border border-[var(--kws-border)] bg-[var(--kws-surface)] p-6 text-[var(--kws-ink)] shadow-[0_18px_40px_-14px_rgba(41,33,42,0.36)] transition-[transform,box-shadow,border-color] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:border-[var(--kws-border-strong)] sm:w-[340px] sm:p-7"
          >
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)] shadow-xs ring-1 ring-[var(--kws-gold)]/25 transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold leading-snug text-[var(--kws-ink)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--kws-muted)]">
                {item.description}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="w-full overflow-x-clip">
      {/* SVG organic curved seam clip-paths (always rendered cleanly for responsive CSS matching) */}
      <svg
        width="0"
        height="0"
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <defs>
          <clipPath id="kws-welcome-seam-left" clipPathUnits="objectBoundingBox">
            <path d="M 0.05 0 L 0.955 0 Q 1 0 1 0.045 L 1 0.31 C 1 0.385 0.895 0.395 0.895 0.50 C 0.895 0.605 1 0.615 1 0.69 L 1 0.955 Q 1 1 0.955 1 L 0.05 1 Q 0 1 0 0.955 L 0 0.045 Q 0 0 0.05 0 Z" />
          </clipPath>
          <clipPath id="kws-welcome-seam-right" clipPathUnits="objectBoundingBox">
            <path d="M 0.045 0 L 0.95 0 Q 1 0 1 0.045 L 1 0.955 Q 1 1 0.95 1 L 0.045 1 Q 0 1 0 0.955 L 0 0.69 C 0 0.615 0.105 0.605 0.105 0.50 C 0.105 0.395 0 0.385 0 0.31 L 0 0.045 Q 0 0 0.045 0 Z" />
          </clipPath>
          <clipPath id="kws-welcome-mobile-strip" clipPathUnits="objectBoundingBox">
            <path d="M 0.065 0 L 0.935 0 Q 1 0 1 0.115 L 1 0.885 Q 1 1 0.935 1 L 0.72 1 C 0.64 1 0.62 0.87 0.50 0.87 C 0.38 0.87 0.36 1 0.28 1 L 0.065 1 Q 0 1 0 0.885 L 0 0.115 Q 0 0 0.065 0 Z" />
          </clipPath>
          <clipPath id="kws-welcome-mobile-card" clipPathUnits="objectBoundingBox">
            <path d="M 0.065 0 L 0.28 0 C 0.36 0 0.38 0.055 0.50 0.055 C 0.62 0.055 0.64 0 0.72 0 L 0.935 0 Q 1 0 1 0.06 L 1 0.94 Q 1 1 0.935 1 L 0.065 1 Q 0 1 0 0.94 L 0 0.06 Q 0 0 0.065 0 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* 1. FIRST VIEW: Fits one mobile screen (100dvh, ~390x800) & split curved desktop container */}
      <section
        aria-label="Introduction"
        className="flex min-h-[calc(100dvh-53px)] flex-col justify-between bg-[var(--kws-bg)] md:min-h-[calc(100dvh-57px)] md:justify-center md:px-6 md:py-6 lg:px-8 lg:py-8"
      >
        <div className="mx-auto w-full max-w-[1160px] px-3 pt-2 md:px-0 md:pt-0">
          {/* Outer rounded dark frame splitting visual panel + glowing content panel */}
          <div className="relative rounded-[28px] bg-[var(--kws-frame)] p-2 shadow-[var(--kws-frame-shadow)] md:grid md:min-h-[568px] md:grid-cols-2 md:gap-3 md:rounded-[36px] md:p-3 lg:min-h-[600px]">
            {/* Visual Panel: Top strip on mobile (~22dvh), Left curved panel on desktop */}
            <div className="kws-clip-mobile-strip kws-clip-desktop-left relative h-[20dvh] min-h-[140px] max-h-[195px] overflow-hidden rounded-[22px] md:h-auto md:min-h-full md:max-h-none md:rounded-[28px]">
              <BrandAbstractArtwork prefersReducedMotion={prefersReducedMotion} />

              {/* Frosted-glass caption chip (desktop bottom-left, existing reassurance line) */}
              <div className="pointer-events-none absolute right-14 bottom-5 left-5 hidden md:inline-flex">
                <p className="rounded-full border border-white/25 bg-white/14 px-4 py-2 text-xs leading-snug text-white/95 backdrop-blur-sm">
                  No experience needed. Go with your gut. There are no wrong answers.
                </p>
              </div>
            </div>

            {/* Mobile horizontal 4-dot pill nested in the concave horizontal seam */}
            <div className="relative z-20 -my-3.5 flex justify-center md:hidden">
              <JourneyDotsPill
                orientation="horizontal"
                activeIndex={0}
                completedCount={0}
                ariaLabel="Four-part discovery journey: step 1 of 4"
              />
            </div>

            {/* Desktop vertical 4-dot pill nested in the curved vertical waist seam */}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 hidden -translate-x-1/2 items-center justify-center md:flex">
              <JourneyDotsPill
                orientation="vertical"
                activeIndex={0}
                completedCount={0}
                ariaLabel="Four-part discovery journey: step 1 of 4"
              />
            </div>

            {/* Content Panel: Glowing multi-stop gradient + fine grain + slow sheen */}
            <motion.div
              initial={
                prefersReducedMotion ? false : { opacity: 0.01, y: 12 }
              }
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36, ease: KWS_EASE }}
              className="kws-clip-mobile-card kws-clip-desktop-right kws-welcome-glow-panel kws-welcome-sheen relative flex flex-col justify-center overflow-hidden rounded-[22px] px-4 pt-6 pb-4 sm:px-7 sm:pt-7 sm:pb-5 md:rounded-[28px] md:py-10 md:pr-10 md:pl-16 lg:pr-12 lg:pl-[74px]"
            >
              <div className="kws-welcome-grain pointer-events-none absolute inset-0" />

              <div className="relative z-10 flex flex-col">
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-display text-[22px] font-bold leading-[1.12] tracking-tight text-[var(--kws-ink)] [text-wrap:balance] sm:text-[28px] md:text-[clamp(1.85rem,3vw,2.65rem)] md:leading-[1.08]"
                >
                  Discover how you work and where you’re headed
                </h1>

                <p className="mt-2 max-w-[46ch] text-[13px] leading-[1.45] text-[var(--kws-muted)] sm:mt-2.5 sm:text-sm md:mt-3.5 md:text-base md:leading-relaxed">
                  Answer a few everyday scenarios, reflect on your journey, and
                  see where your strengths sit across media, marketing, and
                  communications.
                </p>

                {/* Three compact frosted-glass discovery rows */}
                <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5 md:mt-6 md:space-y-3">
                  {discoverThreeSections.map((sec, idx) => {
                    const Icon = DISCOVER_ICONS[idx % DISCOVER_ICONS.length];
                    return (
                      <li
                        key={sec.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/75 bg-white/62 px-3 py-2 text-[var(--kws-ink)] shadow-[0_4px_14px_-6px_rgba(41,33,42,0.09)] backdrop-blur-sm dark:border-white/12 dark:bg-white/[0.06] md:px-4 md:py-2.5"
                      >
                        <span
                          aria-hidden="true"
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)] shadow-xs ring-1 ring-[var(--kws-gold)]/30 md:h-8 md:w-8"
                        >
                          <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        </span>
                        <span className="font-display text-[13px] font-semibold leading-snug text-[var(--kws-ink)] sm:text-sm md:text-[15px]">
                          {sec.title}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {/* Desktop full-width primary Start pill button */}
                <div className="mt-7 hidden md:block">
                  <Button
                    size="lg"
                    allowWrap
                    onClick={onStartOrResume}
                    className="w-full min-h-[56px] justify-between px-7 text-base"
                  >
                    <span>{primaryCtaLabel}</span>
                    <ArrowRight
                      className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Gentle desktop scroll cue below the split container */}
          <div className="mt-5 hidden justify-center md:flex">
            <button
              type="button"
              aria-label="Scroll to additional information"
              onClick={() =>
                detailsSectionRef.current?.scrollIntoView({
                  behavior: prefersReducedMotion ? 'instant' : 'smooth',
                  block: 'start',
                })
              }
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--kws-border)] bg-[var(--kws-surface)] text-[var(--kws-muted)] transition-colors hover:border-[var(--kws-border-strong)] hover:text-[var(--kws-ink)] cursor-pointer"
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Mobile sticky bottom Start button with soft top fade and safe-area padding */}
        <div className="sticky bottom-0 z-20 mt-auto bg-gradient-to-t from-[var(--kws-bg)] via-[var(--kws-bg)]/95 to-transparent px-3 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:hidden">
          <Button
            size="lg"
            allowWrap
            onClick={onStartOrResume}
            className="w-full min-h-[56px] justify-between px-6 text-base"
          >
            <span>{primaryCtaLabel}</span>
            <ArrowRight
              className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Button>
        </div>
      </section>

      {/* BELOW FIRST VIEW: Secondary links + Collapsible sections (closed by default) */}
      <div
        ref={detailsSectionRef}
        className="border-t border-[var(--kws-border)] bg-[var(--kws-bg)] py-8 sm:py-12"
      >
        <div className="mx-auto max-w-[1000px] space-y-4 px-4 sm:px-6 lg:px-8">
          {(lastSubmissionId || (hasStarted && answeredCount > 0)) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--kws-border)] bg-[var(--kws-surface)] px-5 py-3.5 text-sm">
              <span className="text-xs text-[var(--kws-muted)] sm:text-sm">
                No experience needed. Go with your gut. There are no wrong
                answers.
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {lastSubmissionId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onViewLastResults(lastSubmissionId)}
                  >
                    See my profile
                  </Button>
                )}
                {hasStarted && answeredCount > 0 && (
                  <button
                    type="button"
                    onClick={onRestart}
                    className="min-h-[36px] text-xs font-semibold text-[var(--kws-accent)] underline-offset-4 hover:underline cursor-pointer sm:text-sm"
                  >
                    Start over
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 2. Collapsible: What you'll discover */}
          <section
            id="stages"
            className="overflow-hidden rounded-[22px] border border-[var(--kws-border)] bg-[var(--kws-surface)]"
          >
            <h2>
              <button
                type="button"
                aria-expanded={openDetails.stages}
                aria-controls="kws-collapse-stages"
                onClick={() =>
                  setOpenDetails((prev) => ({ ...prev, stages: !prev.stages }))
                }
                className="flex min-h-[64px] w-full items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer sm:px-7 sm:py-5"
              >
                <span className="font-display text-lg font-bold text-[var(--kws-ink)] sm:text-xl">
                  What you’ll discover
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    openDetails.stages
                      ? 'border-[var(--kws-accent)] bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)]'
                      : 'border-[var(--kws-border-strong)] bg-[var(--kws-surface-subtle)] text-[var(--kws-ink)]'
                  }`}
                >
                  {openDetails.stages ? (
                    <Minus className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </span>
              </button>
            </h2>

            <div
              id="kws-collapse-stages"
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                openDetails.stages
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-1 items-center gap-8 border-t border-[var(--kws-border)] px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-12">
                  <div className="space-y-4 lg:col-span-7">
                    {discoverThreeSections.map((sec, idx) => {
                      const Icon = DISCOVER_ICONS[idx % DISCOVER_ICONS.length];
                      return (
                        <div
                          key={sec.id}
                          className="flex items-start gap-4 rounded-[18px] border border-[var(--kws-border)] bg-[var(--kws-bg)] p-4 sm:p-5"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)] shadow-xs ring-1 ring-[var(--kws-gold)]/25">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <h3 className="font-display text-base font-bold leading-snug text-[var(--kws-ink)] sm:text-lg">
                              {sec.title}
                            </h3>
                            <p className="text-sm leading-relaxed text-[var(--kws-muted)]">
                              {DISCOVER_DESCRIPTIONS[idx] ?? sec.instructions}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="lg:col-span-5">
                    <div className="mx-auto max-w-[380px] rounded-[22px] border-2 border-dashed border-[var(--kws-accent)]/40 bg-[var(--kws-tint-bg)] p-3">
                      <div className="kws-light-sweep aspect-square w-full overflow-hidden rounded-[14px] border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] shadow-[var(--kws-shadow-card)]">
                        {!discoverImageError ? (
                          <img
                            src={DISCOVER_IMAGE_SRC}
                            alt="Creative strategists reviewing campaign storyboards and notes at a sunlit wooden desk"
                            referrerPolicy="no-referrer"
                            draggable={false}
                            onError={() => setDiscoverImageError(true)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-[image:var(--kws-gradient-band)] p-8 text-center text-white">
                            <Briefcase
                              className="h-8 w-8 text-[var(--kws-gold-bright)]"
                              aria-hidden="true"
                            />
                            <p className="mt-3 font-display text-lg font-bold">
                              KWS Academy Self-Discovery
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Collapsible: What you gain */}
          <section
            id="overview"
            className="overflow-hidden rounded-[22px] border border-[var(--kws-border)] bg-[var(--kws-surface)]"
          >
            <h2>
              <button
                type="button"
                aria-expanded={openDetails.overview}
                aria-controls="kws-collapse-overview"
                onClick={() =>
                  setOpenDetails((prev) => ({
                    ...prev,
                    overview: !prev.overview,
                  }))
                }
                className="flex min-h-[64px] w-full items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer sm:px-7 sm:py-5"
              >
                <span className="font-display text-lg font-bold text-[var(--kws-ink)] sm:text-xl">
                  What you gain
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    openDetails.overview
                      ? 'border-[var(--kws-accent)] bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)]'
                      : 'border-[var(--kws-border-strong)] bg-[var(--kws-surface-subtle)] text-[var(--kws-ink)]'
                  }`}
                >
                  {openDetails.overview ? (
                    <Minus className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </span>
              </button>
            </h2>

            <div
              id="kws-collapse-overview"
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                openDetails.overview
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="bg-[image:var(--kws-gradient-band)] py-8 text-white">
                  <div
                    role="region"
                    aria-label="What you gain carousel"
                    tabIndex={0}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== 'touch') {
                        setIsCarouselHovered(true);
                      }
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType !== 'touch') {
                        setIsCarouselHovered(false);
                      }
                    }}
                    onPointerDown={() => setIsCarouselPressed(true)}
                    onPointerUp={() => setIsCarouselPressed(false)}
                    onPointerCancel={() => setIsCarouselPressed(false)}
                    onFocusCapture={() => setIsCarouselFocused(true)}
                    onBlurCapture={(e) => {
                      if (
                        !e.currentTarget.contains(e.relatedTarget as Node | null)
                      ) {
                        setIsCarouselFocused(false);
                      }
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                    className="kws-carousel-viewport overflow-hidden py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--kws-gold)]"
                  >
                    {prefersReducedMotion ? (
                      <div className="mx-auto flex max-w-[1200px] items-stretch gap-4 px-4 sm:gap-6 sm:px-6 lg:px-8">
                        {renderCarouselSet('static', false)}
                      </div>
                    ) : (
                      <div
                        className="kws-carousel-track"
                        data-paused={isCarouselPaused ? 'true' : 'false'}
                      >
                        {renderCarouselSet('primary', false)}
                        {renderCarouselSet('duplicate', true)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Collapsible: Good to know */}
          <section
            id="faq"
            className="overflow-hidden rounded-[22px] border border-[var(--kws-border)] bg-[var(--kws-surface)]"
          >
            <h2>
              <button
                type="button"
                aria-expanded={openDetails.faq}
                aria-controls="kws-collapse-faq"
                onClick={() =>
                  setOpenDetails((prev) => ({ ...prev, faq: !prev.faq }))
                }
                className="flex min-h-[64px] w-full items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer sm:px-7 sm:py-5"
              >
                <span className="font-display text-lg font-bold text-[var(--kws-ink)] sm:text-xl">
                  Good to know
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    openDetails.faq
                      ? 'border-[var(--kws-accent)] bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)]'
                      : 'border-[var(--kws-border-strong)] bg-[var(--kws-surface-subtle)] text-[var(--kws-ink)]'
                  }`}
                >
                  {openDetails.faq ? (
                    <Minus className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </span>
              </button>
            </h2>

            <div
              id="kws-collapse-faq"
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                openDetails.faq
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="space-y-3 border-t border-[var(--kws-border)] px-5 py-6 sm:px-7">
                  {FAQ_ITEMS.map((item, idx) => {
                    const isOpen = openFaqIndex === idx;
                    const panelId = `kws-faq-panel-${idx}`;
                    const buttonId = `kws-faq-btn-${idx}`;

                    return (
                      <div
                        key={item.question}
                        className={`rounded-[18px] border bg-[var(--kws-bg)] transition-all duration-200 ease-out ${
                          isOpen
                            ? 'border-[var(--kws-accent)] ring-2 ring-[var(--kws-accent)]/15'
                            : 'border-[var(--kws-border)] hover:border-[var(--kws-border-strong)]'
                        }`}
                      >
                        <h3>
                          <button
                            id={buttonId}
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            onClick={() =>
                              setOpenFaqIndex((prev) =>
                                prev === idx ? null : idx
                              )
                            }
                            className="flex min-h-[56px] w-full items-center justify-between gap-4 px-4 py-3.5 text-left cursor-pointer sm:px-6 sm:py-4"
                          >
                            <span className="font-display text-base font-bold leading-snug text-[var(--kws-ink)] sm:text-lg">
                              {item.question}
                            </span>
                            <span
                              aria-hidden="true"
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                                isOpen
                                  ? 'border-[var(--kws-accent)] bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)]'
                                  : 'border-[var(--kws-border-strong)] bg-[var(--kws-surface)] text-[var(--kws-ink)]'
                              }`}
                            >
                              {isOpen ? (
                                <Minus className="h-3.5 w-3.5" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                            </span>
                          </button>
                        </h3>

                        <div
                          id={panelId}
                          role="region"
                          aria-labelledby={buttonId}
                          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                            isOpen
                              ? 'grid-rows-[1fr] opacity-100'
                              : 'grid-rows-[0fr] opacity-0'
                          }`}
                        >
                          <div className="overflow-hidden">
                            <p className="px-4 pb-4 pt-0.5 text-sm leading-relaxed text-[var(--kws-muted)] sm:px-6 sm:pb-5 sm:text-[15px]">
                              {item.answer}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
