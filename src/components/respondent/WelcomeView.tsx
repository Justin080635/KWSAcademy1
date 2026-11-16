import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Compass,
  Layers,
  ListChecks,
  MessageCircle,
  Minus,
  Plus,
  Route,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { ASSESSMENT_SECTIONS } from '../../domain/assessmentContent.ts';
import type { AssessmentSectionMeta } from '../../domain/types.ts';
import { Button } from '../ui/Button.tsx';
import {
  KWS_DURATIONS,
  KWS_EASE,
  VIEWPORT_REVEAL,
} from '../ui/motionPrimitives.tsx';

interface WelcomeViewProps {
  hasStarted: boolean;
  answeredCount: number;
  lastSubmissionId: string | null;
  sections?: AssessmentSectionMeta[];
  onStartOrResume: () => void;
  onRestart: () => void;
  onViewLastResults: (id: string) => void;
}

const HERO_IMAGE_SRC = '/src/assets/images/hero_kws_discovery_1794821662726.jpg';
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

export function WelcomeView({
  hasStarted,
  answeredCount,
  lastSubmissionId,
  sections = ASSESSMENT_SECTIONS,
  onStartOrResume,
  onRestart,
  onViewLastResults,
}: WelcomeViewProps) {
  const [heroImageError, setHeroImageError] = useState(false);
  const [discoverImageError, setDiscoverImageError] = useState(false);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);
  const [isCarouselPressed, setIsCarouselPressed] = useState(false);
  const [isCarouselFocused, setIsCarouselFocused] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const prefersReducedMotion = useReducedMotion();

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
      {/* 1. HERO: Split layout with circular dashed visual & clean floating geometry */}
      <section
        aria-label="Introduction"
        className="bg-[var(--kws-bg)] pt-8 pb-14 sm:pt-12 sm:pb-16 lg:pt-16 lg:pb-24"
      >
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
          {/* Left: Headline, warm intro & Start button */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0.85, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: KWS_DURATIONS.reveal, ease: KWS_EASE }}
            className="space-y-6 lg:col-span-6"
          >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[var(--kws-muted)] sm:text-sm">
              <span className="font-semibold text-[var(--kws-ink)]">
                KWS Academy
              </span>
              <span aria-hidden="true">·</span>
              <span>Ikeja, Lagos</span>
            </p>

            <h1 className="font-display text-[clamp(2.125rem,5vw,3.55rem)] font-bold leading-[1.06] tracking-tight text-[var(--kws-ink)] [text-wrap:balance]">
              Discover how you work and where you’re headed
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-[var(--kws-muted)] sm:text-lg">
              Answer a few everyday scenarios, reflect on your journey, and see
              where your strengths sit across media, marketing, and
              communications.
            </p>

            <div className="space-y-3 pt-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  size="lg"
                  onClick={onStartOrResume}
                  className="w-full sm:w-auto"
                >
                  {primaryCtaLabel}
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Button>

                {lastSubmissionId && (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => onViewLastResults(lastSubmissionId)}
                    className="w-full sm:w-auto"
                  >
                    See my profile
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--kws-muted)] sm:text-sm">
                <span>
                  No experience needed. Go with your gut. There are no wrong
                  answers.
                </span>
                {hasStarted && answeredCount > 0 && (
                  <button
                    type="button"
                    onClick={onRestart}
                    className="min-h-[36px] font-semibold text-[var(--kws-accent)] underline-offset-4 hover:underline cursor-pointer"
                  >
                    Start over
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Right: Clean circular dashed visual & decorative palette accents (zero internal style leaks) */}
          <motion.div
            initial={
              prefersReducedMotion ? false : { opacity: 0.85, y: 14, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: KWS_DURATIONS.reveal,
              delay: prefersReducedMotion ? 0 : 0.06,
              ease: KWS_EASE,
            }}
            className="lg:col-span-6"
          >
            <div className="relative mx-auto flex max-w-[460px] flex-col items-center sm:px-6 sm:py-6">
              {/* Subtle ambient burgundy & champagne halo behind hero frame */}
              <div
                aria-hidden="true"
                className="kws-ambient-breathe pointer-events-none absolute inset-4 rounded-full opacity-80 blur-2xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(95,27,71,0.16) 0%, rgba(198,164,106,0.16) 46%, transparent 74%)',
                }}
              />

              {/* Decorative floating dots & circles strictly in KWS palette tints */}
              <span
                aria-hidden="true"
                className="kws-float-slow pointer-events-none absolute top-4 left-6 h-3.5 w-3.5 rounded-full bg-[var(--kws-gold)]/85 shadow-xs sm:top-6 sm:left-10"
              />
              <span
                aria-hidden="true"
                style={{ animationDelay: '-1.8s' }}
                className="kws-float-slow-alt pointer-events-none absolute top-10 right-6 h-5 w-5 rounded-full border-2 border-[var(--kws-accent)]/40 sm:right-10"
              />
              <span
                aria-hidden="true"
                style={{ animationDelay: '-2.6s' }}
                className="kws-float-slow pointer-events-none absolute bottom-12 left-4 h-2.5 w-2.5 rounded-full bg-[var(--kws-accent)]/55 sm:bottom-14 sm:left-6"
              />
              <span
                aria-hidden="true"
                style={{ animationDelay: '-0.9s' }}
                className="kws-float-slow-alt pointer-events-none absolute right-6 bottom-16 h-4 w-4 rounded-full bg-[var(--kws-mauve)] sm:right-8 sm:bottom-20"
              />
              <span
                aria-hidden="true"
                style={{ animationDelay: '-3.1s' }}
                className="kws-float-slow pointer-events-none hidden sm:block absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[var(--kws-accent)]/55"
              />
              <span
                aria-hidden="true"
                style={{ animationDelay: '-1.4s' }}
                className="kws-float-slow-alt pointer-events-none hidden sm:block absolute -bottom-1 left-[42%] h-3 w-3 rounded-full border-2 border-[var(--kws-gold)]/75"
              />

              <div className="group relative flex h-[284px] w-[284px] items-center justify-center rounded-full p-4 sm:h-[360px] sm:w-[360px] sm:p-5 lg:h-[392px] lg:w-[392px]">
                {/* Outer clockwise rotating dotted SVG ring + orbital accent dots */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 400 400"
                  className={`pointer-events-none absolute inset-0 h-full w-full ${
                    prefersReducedMotion ? '' : 'kws-orbit-cw'
                  }`}
                >
                  <circle
                    cx="200"
                    cy="200"
                    r="192"
                    fill="none"
                    stroke="var(--kws-accent)"
                    strokeOpacity="0.45"
                    strokeWidth="2.2"
                    strokeDasharray="3 10"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="200"
                    cy="8"
                    r="5"
                    fill="var(--kws-accent)"
                  />
                  <circle
                    cx="200"
                    cy="392"
                    r="4"
                    fill="var(--kws-gold)"
                  />
                </svg>

                {/* Inner counter-clockwise rotating champagne dashed ring */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 400 400"
                  className={`pointer-events-none absolute inset-2.5 h-[calc(100%-20px)] w-[calc(100%-20px)] ${
                    prefersReducedMotion ? '' : 'kws-orbit-ccw'
                  }`}
                >
                  <circle
                    cx="200"
                    cy="200"
                    r="192"
                    fill="none"
                    stroke="var(--kws-gold)"
                    strokeOpacity="0.58"
                    strokeWidth="1.6"
                    strokeDasharray="14 10 4 10"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="8"
                    cy="200"
                    r="3.5"
                    fill="var(--kws-gold)"
                  />
                </svg>

                <div className="kws-light-sweep relative h-full w-full overflow-hidden rounded-full border-2 border-[var(--kws-surface)] bg-[var(--kws-surface-subtle)] shadow-[var(--kws-shadow-card)] ring-1 ring-[var(--kws-border-strong)]">
                  {!heroImageError ? (
                    <img
                      src={HERO_IMAGE_SRC}
                      alt="Media and marketing professionals collaborating around storyboards and camera equipment inside a sunlit Lagos studio"
                      referrerPolicy="no-referrer"
                      draggable={false}
                      onError={() => setHeroImageError(true)}
                      className="h-full w-full object-cover object-[50%_38%] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.035]"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-[image:var(--kws-gradient-band)] p-6 text-center text-white">
                      <Sparkles
                        className="h-7 w-7 text-[var(--kws-gold-bright)]"
                        aria-hidden="true"
                      />
                      <p className="mt-2 font-display text-base font-bold">
                        Media, Marketing &amp; Communications
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. SLIM FULL-WIDTH GRADIENT BAND: Three outputs */}
      <section
        aria-label="What your profile covers"
        className="w-full bg-[image:var(--kws-gradient-band)] text-white"
      >
        <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
            {discoverThreeSections.map((sec, idx) => {
              const Icon = DISCOVER_ICONS[idx % DISCOVER_ICONS.length];
              return (
                <motion.div
                  key={sec.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT_REVEAL}
                  transition={{
                    duration: KWS_DURATIONS.reveal,
                    delay: prefersReducedMotion ? 0 : idx * 0.06,
                    ease: KWS_EASE,
                  }}
                  className="flex items-center gap-3.5 sm:justify-center"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-[var(--kws-gold-bright)] ring-1 ring-white/25">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-display text-base font-bold tracking-tight text-white sm:text-[17px]">
                    {sec.title}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. "What you'll discover": Vertical list of 3 items + rounded-square image frame with dashed border */}
      <section
        id="stages"
        className="bg-[var(--kws-surface)] py-14 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-7">
              <h2 className="font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-bold leading-[1.12] tracking-tight text-[var(--kws-ink)] [text-wrap:balance]">
                What you’ll discover
              </h2>

              <div className="mt-8 space-y-4 sm:space-y-5">
                {discoverThreeSections.map((sec, idx) => {
                  const Icon = DISCOVER_ICONS[idx % DISCOVER_ICONS.length];
                  return (
                    <motion.div
                      key={sec.id}
                      initial={
                        prefersReducedMotion
                          ? false
                          : { opacity: 0, y: 12, scale: 0.99 }
                      }
                      whileInView={{ opacity: 1, y: 0, scale: 1 }}
                      viewport={VIEWPORT_REVEAL}
                      transition={{
                        duration: KWS_DURATIONS.reveal,
                        delay: prefersReducedMotion ? 0 : idx * 0.06,
                        ease: KWS_EASE,
                      }}
                      className="group flex items-start gap-4 rounded-[22px] border border-[var(--kws-border)] bg-[var(--kws-bg)] p-5 transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-[var(--kws-border-strong)] hover:shadow-[var(--kws-shadow-card)] sm:gap-5 sm:p-6"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)] shadow-xs ring-1 ring-[var(--kws-gold)]/25 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <h3 className="font-display text-lg font-bold leading-snug text-[var(--kws-ink)] sm:text-xl">
                          {sec.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-[var(--kws-muted)] sm:text-[15px]">
                          {DISCOVER_DESCRIPTIONS[idx] ?? sec.instructions}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <motion.div
              initial={
                prefersReducedMotion
                  ? false
                  : { opacity: 0, y: 14, scale: 0.985 }
              }
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={VIEWPORT_REVEAL}
              transition={{ duration: KWS_DURATIONS.reveal, ease: KWS_EASE }}
              className="lg:col-span-5"
            >
              <div className="mx-auto max-w-[440px] rounded-[24px] border-2 border-dashed border-[var(--kws-accent)]/40 bg-[var(--kws-tint-bg)] p-3 sm:p-4">
                <div className="kws-light-sweep aspect-square w-full overflow-hidden rounded-[16px] border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] shadow-[var(--kws-shadow-card)]">
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
            </motion.div>
          </div>
        </div>
      </section>

      {/* 4. "What you gain": Automatic left-to-right seamless infinite carousel on gradient section */}
      <section
        id="overview"
        aria-label="What you gain"
        className="w-full bg-[image:var(--kws-gradient-band)] py-14 text-white sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-bold leading-[1.12] tracking-tight text-white [text-wrap:balance]">
              What you gain
            </h2>
          </div>
        </div>

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
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setIsCarouselFocused(false);
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          className="kws-carousel-viewport mt-8 overflow-hidden py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--kws-gold)] sm:mt-10"
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
      </section>

      {/* 5. "Good to know": FAQ Accordion */}
      <section
        id="faq"
        aria-label="Good to know"
        className="bg-[var(--kws-bg)] py-14 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-[820px] px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-bold leading-[1.12] tracking-tight text-[var(--kws-ink)] [text-wrap:balance]">
            Good to know
          </h2>

          <div className="mt-7 space-y-3.5 sm:mt-9 sm:space-y-4">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              const panelId = `kws-faq-panel-${idx}`;
              const buttonId = `kws-faq-btn-${idx}`;

              return (
                <div
                  key={item.question}
                  className={`rounded-[22px] border bg-[var(--kws-surface)] transition-all duration-200 ease-out ${
                    isOpen
                      ? 'border-[var(--kws-accent)] ring-2 ring-[var(--kws-accent)]/15 shadow-[var(--kws-shadow-card)]'
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
                        setOpenFaqIndex((prev) => (prev === idx ? null : idx))
                      }
                      className="flex min-h-[60px] w-full items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer sm:px-7 sm:py-5"
                    >
                      <span className="font-display text-base font-bold leading-snug text-[var(--kws-ink)] sm:text-lg">
                        {item.question}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                          isOpen
                            ? 'border-[var(--kws-accent)] bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)]'
                            : 'border-[var(--kws-border-strong)] bg-[var(--kws-surface-subtle)] text-[var(--kws-ink)]'
                        }`}
                      >
                        {isOpen ? (
                          <Minus className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
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
                      <p className="px-5 pb-5 pt-0.5 text-sm leading-relaxed text-[var(--kws-muted)] sm:px-7 sm:pb-6 sm:text-[15px]">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
