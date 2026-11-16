import { useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';
import {
  ASSESSMENT_SECTIONS,
  PROFESSIONAL_STYLES,
} from '../../domain/assessmentContent.ts';
import type { AssessmentSectionMeta } from '../../domain/types.ts';
import { Button } from '../ui/Button.tsx';

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

const DISCOVERY_HIGHLIGHTS = [
  {
    index: '01',
    title: 'Working style',
    detail: '9 everyday workplace scenarios',
  },
  {
    index: '02',
    title: 'Growth stage',
    detail: '6 reflections on direction & goals',
  },
  {
    index: '03',
    title: 'Six capabilities',
    detail: 'Understanding paired with experience',
  },
  {
    index: '04',
    title: 'Immediate report',
    detail: 'Results shown right on submission',
  },
];

export function WelcomeView({
  hasStarted,
  answeredCount,
  lastSubmissionId,
  sections = ASSESSMENT_SECTIONS,
  onStartOrResume,
  onRestart,
  onViewLastResults,
}: WelcomeViewProps) {
  const [imageError, setImageError] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const heroMediaRef = useRef<HTMLDivElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: heroMediaRef,
    offset: ['start end', 'end start'],
  });

  const imageScale = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? [1, 1] : [1.05, 1]
  );

  const primaryCtaLabel =
    hasStarted && answeredCount > 0
      ? 'Continue Assessment'
      : 'Start Assessment';

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-12 sm:px-6 sm:pt-10 sm:pb-16 lg:px-8 lg:pt-14 lg:pb-20">
      {/* Editorial Hero */}
      <section aria-label="Introduction" className="pb-10 sm:pb-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
          {/* Primary Value Proposition & CTA (Immediately visible above the fold on mobile & desktop) */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0.9, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5 lg:col-span-6"
          >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[var(--kws-muted)] sm:text-sm">
              <span className="font-semibold text-[var(--kws-ink)]">
                KWS Academy
              </span>
              <span aria-hidden="true">·</span>
              <span>Ikeja, Lagos</span>
              <span aria-hidden="true">·</span>
              <span>Professional Discovery Assessment</span>
            </p>

            <h1 className="font-display text-[clamp(2rem,5vw,3.45rem)] font-bold leading-[1.06] text-[var(--kws-ink)] [text-wrap:balance]">
              Discover your professional style and growth path
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-[var(--kws-muted)] sm:text-lg">
              A structured self-discovery experience to uncover how you
              naturally work, clarify where you are on your growth journey, and
              pinpoint practical priorities across media, marketing, and
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
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>

                {lastSubmissionId && (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => onViewLastResults(lastSubmissionId)}
                    className="w-full sm:w-auto"
                  >
                    View previous results
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--kws-muted)] sm:text-sm">
                <span>10–12 minutes · Built for reflection, not an exam</span>
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

          {/* Editorial Studio Frame (Clean photography without scrim overlays) */}
          <motion.div
            ref={heroMediaRef}
            initial={prefersReducedMotion ? false : { opacity: 0.92, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: prefersReducedMotion ? 0 : 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6"
          >
            <div className="overflow-hidden rounded-2xl border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)]">
              {!imageError ? (
                <div className="aspect-[16/10] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[4/3]">
                  <motion.img
                    style={{ scale: imageScale }}
                    src={HERO_IMAGE_SRC}
                    alt="Media and marketing professionals collaborating around storyboards and camera equipment inside a sunlit Lagos studio"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                    className="h-full w-full object-cover object-[50%_38%] will-change-transform"
                  />
                </div>
              ) : (
                <div className="flex aspect-[16/10] w-full flex-col justify-end bg-[var(--kws-surface-subtle)] p-6 sm:aspect-[4/3]">
                  <p className="font-display text-lg font-semibold text-[var(--kws-ink)]">
                    Media, Marketing &amp; Communications
                  </p>
                  <p className="mt-1 text-sm text-[var(--kws-muted)]">
                    Structured self-discovery and guided reflection with KWS
                    Academy.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-xs text-[var(--kws-muted)]">
              <span>Media, Marketing &amp; Communications Studio</span>
              <span className="font-mono-tabular">
                Self-paced · Immediate report
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Architectural 4-Part Discovery Index (Unboxed hairline grid) */}
      <section
        aria-label="Assessment highlights"
        className="border-y border-[var(--kws-border)]"
      >
        <div className="grid grid-cols-1 divide-y divide-[var(--kws-border)] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {DISCOVERY_HIGHLIGHTS.map((item, idx) => (
            <motion.div
              key={item.index}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.3,
                delay: prefersReducedMotion ? 0 : idx * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`py-4 sm:py-6 ${
                idx > 1 ? 'sm:border-t sm:border-[var(--kws-border)] lg:border-t-0' : ''
              } ${idx % 2 === 1 ? 'sm:pl-6' : ''} ${
                idx > 0 ? 'lg:pl-6' : ''
              } ${idx < 3 ? 'lg:pr-6' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-4 sm:block">
                <span className="font-mono-tabular text-xs font-semibold text-[var(--kws-accent)]">
                  {item.index}
                </span>
                <p className="font-display text-base font-bold text-[var(--kws-ink)] sm:mt-1.5">
                  {item.title}
                </p>
              </div>
              <p className="mt-1 text-sm text-[var(--kws-muted)]">
                {item.detail}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Four-Section Assessment Journey (Asymmetric Split + Unboxed Editorial List) */}
      <section
        id="stages"
        className="py-12 sm:py-16 lg:py-20"
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4 lg:sticky lg:top-24 lg:col-span-5 lg:self-start"
          >
            <p className="font-mono-tabular text-xs font-semibold text-[var(--kws-accent)]">
              Four-part structure
            </p>
            <h2 className="font-display text-2xl font-bold leading-snug text-[var(--kws-ink)] sm:text-3xl [text-wrap:balance]">
              What this discovery experience covers
            </h2>
            <p className="text-sm leading-relaxed text-[var(--kws-muted)] sm:text-base">
              Move through four focused sections with full Back and Continue
              control. Every answer saves as you go—no specialist jargon or
              prior industry background required.
            </p>
          </motion.div>

          <div className="divide-y divide-[var(--kws-border)] border-y border-[var(--kws-border)] lg:col-span-7">
            {sections.map((sec, idx) => (
              <motion.div
                key={sec.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.34,
                  delay: prefersReducedMotion ? 0 : idx * 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex flex-col gap-2 py-5 sm:flex-row sm:items-baseline sm:gap-8 sm:py-6"
              >
                <span className="font-mono-tabular w-24 shrink-0 text-xs font-semibold text-[var(--kws-accent)]">
                  Section {sec.code}
                </span>
                <div className="min-w-0 space-y-1">
                  <h3 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                    {sec.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--kws-muted)]">
                    {sec.instructions.split('.')[0]}.
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Six Professional Styles (Unboxed Editorial Matrix) */}
      <section
        id="archetypes"
        className="border-t border-[var(--kws-border)] py-12 sm:py-16 lg:py-20"
      >
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 max-w-2xl sm:mb-10"
        >
          <p className="font-mono-tabular text-xs font-semibold text-[var(--kws-accent)]">
            Working orientations
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-[var(--kws-ink)] sm:text-3xl [text-wrap:balance]">
            Six professional styles
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--kws-muted)] sm:text-base">
            Most people draw on more than one orientation. Your profile
            highlights where your instincts naturally concentrate.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {PROFESSIONAL_STYLES.map((style, idx) => (
            <motion.article
              key={style.id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{
                duration: 0.34,
                delay: prefersReducedMotion ? 0 : (idx % 3) * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="border-t border-[var(--kws-border)] pt-5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                  {style.name}
                </h3>
                <span className="font-mono-tabular text-xs font-medium text-[var(--kws-muted)]">
                  0{idx + 1}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--kws-accent)]">
                {style.tagline}
              </p>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--kws-muted)]">
                {style.description}
              </p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Authoritative Closing Anchor Band */}
      <section id="overview" className="pt-2">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl bg-[#14183a] p-6 text-[#eef0fa] sm:p-10 lg:p-12 dark:border dark:border-[var(--kws-border)] dark:bg-[var(--kws-surface)] dark:text-[var(--kws-ink)]"
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="space-y-4 lg:col-span-5">
              <p className="font-mono-tabular text-xs font-semibold text-[var(--kws-gold)]">
                Immediate discovery report
              </p>
              <h2 className="font-display text-2xl font-bold leading-snug sm:text-3xl [text-wrap:balance]">
                What you receive immediately
              </h2>
              <p className="text-sm leading-relaxed text-[#c9cee8] dark:text-[var(--kws-muted)] sm:text-base">
                Your personalized discovery profile opens right after
                submission, whether or not you request a consultation with KWS
                Academy.
              </p>
              <div className="pt-2">
                <Button
                  size="lg"
                  onClick={onStartOrResume}
                  className="w-full bg-white text-[#14183a] hover:bg-[#ebeef7] sm:w-auto dark:bg-[var(--kws-accent)] dark:text-[var(--kws-accent-fg)] dark:hover:bg-[var(--kws-accent-hover)]"
                >
                  {primaryCtaLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            <ul className="divide-y divide-white/15 border-y border-white/15 lg:col-span-7 dark:divide-[var(--kws-border)] dark:border-[var(--kws-border)]">
              {[
                'Your Professional Style and natural watch-out to balance',
                'Your provisional Growth Journey stage and 12-month focus',
                'Understanding vs. hands-on experience across six core pillars',
                'Concrete next-step priorities tailored to your current stage',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 py-3.5 text-sm leading-relaxed sm:py-4 sm:text-base"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kws-gold)]"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
