import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import {
  ASSESSMENT_SECTIONS,
  PROFESSIONAL_STYLES,
} from '../../domain/assessmentContent.ts';
import type { AssessmentSectionMeta } from '../../domain/types.ts';
import { Button } from '../ui/Button.tsx';
import { Surface } from '../ui/Surface.tsx';

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

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      {/* Hero Split */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
        <div className="flex flex-col justify-between gap-6 lg:col-span-7 lg:py-2">
          <div className="space-y-5">
            <p className="text-sm font-medium text-[var(--kws-muted)]">
              KWS Academy
              <span aria-hidden="true" className="mx-2">
                ·
              </span>
              Professional Discovery Assessment
              <span aria-hidden="true" className="mx-2">
                ·
              </span>
              Media, Marketing &amp; Communications
            </p>

            <h1 className="font-display text-3xl font-bold leading-[1.12] text-[var(--kws-ink)] sm:text-5xl [text-wrap:balance]">
              Discover your professional style and growth path
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-[var(--kws-muted)] sm:text-lg">
              A guided self-discovery experience to help you understand your
              professional style, reflect on your current growth journey, and
              explore your strengths and development areas across media,
              marketing, and communications.
            </p>

            <ul className="space-y-2 pt-1 text-sm text-[var(--kws-ink)]">
              <li className="flex items-start gap-2.5">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kws-success)]"
                  aria-hidden="true"
                />
                <span>
                  No previous industry experience or specialist terminology is
                  required.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kws-success)]"
                  aria-hidden="true"
                />
                <span>
                  Answer honestly based on what feels most accurate — this is
                  for reflection, not an examination.
                </span>
              </li>
            </ul>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={onStartOrResume}>
                {hasStarted && answeredCount > 0
                  ? 'Continue Assessment'
                  : 'Start Assessment'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>

              {hasStarted && answeredCount > 0 && (
                <Button variant="secondary" size="lg" onClick={onRestart}>
                  Start over
                </Button>
              )}

              {lastSubmissionId && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => onViewLastResults(lastSubmissionId)}
                >
                  View previous results
                </Button>
              )}
            </div>

            <p className="text-sm text-[var(--kws-muted)]">
              Move through each section at your own pace and receive your
              personalized results immediately after submitting.
            </p>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="h-full min-h-[260px] overflow-hidden rounded-xl border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)]">
            {!imageError ? (
              <img
                src={HERO_IMAGE_SRC}
                alt="Media and marketing professionals collaborating around storyboards and camera equipment inside a sunlit Lagos studio"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="h-full w-full object-cover aspect-[4/3] lg:aspect-auto"
              />
            ) : (
              <div className="flex h-full min-h-[280px] flex-col justify-end bg-gradient-to-br from-[var(--kws-accent)]/15 via-[var(--kws-surface-subtle)] to-[var(--kws-gold)]/15 p-6">
                <p className="font-display text-lg font-semibold text-[var(--kws-ink)]">
                  Media, Marketing &amp; Communications
                </p>
                <p className="mt-1 text-sm text-[var(--kws-muted)]">
                  Structured self-discovery and human-led consultation with KWS
                  Academy.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Four-Section Assessment Journey */}
      <section
        id="stages"
        className="mt-14 border-t border-[var(--kws-border)] pt-10"
      >
        <div className="mb-6 max-w-2xl">
          <h2 className="font-display text-2xl font-bold text-[var(--kws-ink)]">
            What this discovery experience covers
          </h2>
          <p className="mt-1 text-sm text-[var(--kws-muted)]">
            Four focused sections designed for reflection. Use Back and Continue
            at any point without losing your answers.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((sec) => (
            <Surface key={sec.id} className="flex flex-col justify-between p-5">
              <div>
                <p className="font-mono-tabular text-xs font-medium text-[var(--kws-accent)]">
                  Section {sec.code}
                </p>
                <h3 className="mt-1.5 font-display text-lg font-bold text-[var(--kws-ink)]">
                  {sec.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--kws-muted)]">
                  {sec.instructions.split('.')[0]}.
                </p>
              </div>
            </Surface>
          ))}
        </div>
      </section>

      {/* Six Professional Styles */}
      <section
        id="archetypes"
        className="mt-14 border-t border-[var(--kws-border)] pt-10"
      >
        <div className="mb-6 max-w-2xl">
          <h2 className="font-display text-2xl font-bold text-[var(--kws-ink)]">
            Six professional styles
          </h2>
          <p className="mt-1 text-sm text-[var(--kws-muted)]">
            Most people draw on more than one orientation. Your profile
            highlights where your instincts naturally concentrate.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROFESSIONAL_STYLES.map((style, idx) => (
            <Surface key={style.id} className="p-5">
              <h3 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                0{idx + 1}. {style.name}
              </h3>
              <p className="mt-1 text-xs font-medium text-[var(--kws-accent)]">
                {style.tagline}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--kws-muted)]">
                {style.description}
              </p>
            </Surface>
          ))}
        </div>
      </section>

      {/* What You'll Receive */}
      <section
        id="overview"
        className="mt-14 border-t border-[var(--kws-border)] pt-10"
      >
        <Surface subtle className="p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <h2 className="font-display text-2xl font-bold text-[var(--kws-ink)] [text-wrap:balance]">
                What you receive immediately
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--kws-muted)]">
                Your personalized discovery profile is shown right after
                submission, whether or not you choose to book a follow-up
                conversation with KWS Academy.
              </p>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-7">
              {[
                'Discover your Professional Style and possible blind spot',
                'Understand where you are on your professional growth journey',
                'Explore your strengths and development areas across six capabilities',
                'Practical next-step priorities tailored to your current focus',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm text-[var(--kws-ink)]"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kws-success)]"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Surface>
      </section>
    </div>
  );
}
