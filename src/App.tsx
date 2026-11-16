import { useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AdminPortal } from './components/admin/AdminPortal.tsx';
import { AssessmentQuestionView } from './components/respondent/AssessmentQuestionView.tsx';
import { ResultsView } from './components/respondent/ResultsView.tsx';
import { WelcomeView } from './components/respondent/WelcomeView.tsx';
import { Footer } from './components/ui/Footer.tsx';
import { TopBar } from './components/ui/TopBar.tsx';
import { KWS_DURATIONS, KWS_EASE } from './components/ui/motionPrimitives.tsx';
import {
  ApiError,
  finalizeDraftSubmission,
  submitAssessment,
} from './services/api.ts';
import { useAssessmentSession } from './state/useAssessmentSession.ts';

export default function App() {
  const {
    route,
    navigate,
    theme,
    setTheme,
    draft,
    activeSections,
    activeQuestions,
    steps,
    activeSubmission,
    setActiveSubmission,
    hasStarted,
    answeredCount,
    startAssessment,
    restartAssessment,
    setStepIndex,
    selectOption,
    setOtherText,
    updateContact,
    completeWithSubmission,
    emitTelemetry,
    emitAbandonmentBeacon,
  } = useAssessmentSession();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmitAssessment = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    const elapsedMs = draft.startedAt ? Date.now() - draft.startedAt : 60000;
    const durationMinutes = Math.max(1, Math.round(elapsedMs / 60000));

    try {
      let record;
      if (draft.backendSubmissionId && draft.backendAccessToken) {
        try {
          record = await finalizeDraftSubmission(
            draft.backendSubmissionId,
            draft.backendAccessToken,
            {
              submitNonce: draft.submitNonce,
              answers: draft.answers,
              attribution: draft.attribution,
              durationMinutes,
            }
          );
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            record = await submitAssessment({
              idempotencyKey: draft.idempotencyKey,
              submitNonce: draft.submitNonce,
              answers: draft.answers,
              attribution: draft.attribution,
              durationMinutes,
            });
          } else {
            throw err;
          }
        }
      } else {
        record = await submitAssessment({
          idempotencyKey: draft.idempotencyKey,
          submitNonce: draft.submitNonce,
          answers: draft.answers,
          attribution: draft.attribution,
          durationMinutes,
        });
      }
      completeWithSubmission(record);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : 'That didn’t go through, but your answers are safe. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const pageTransitionKey =
    route.area === 'admin'
      ? `admin-${route.view}`
      : route.view === 'confirmation' || route.view === 'results'
        ? `respondent-results-${route.submissionId}`
        : `respondent-${route.view}`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col bg-[var(--kws-bg)] text-[var(--kws-ink)]">
        <TopBar
          route={route}
          hasStarted={hasStarted}
          lastSubmissionId={draft.lastSubmissionId}
          onNavigate={navigate}
          onStartOrResume={startAssessment}
        />

        <main className="flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pageTransitionKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: KWS_DURATIONS.fast, ease: KWS_EASE }}
            >
              {route.area === 'admin' ? (
                <AdminPortal route={route} onNavigate={navigate} />
              ) : route.view === 'assessment' ? (
                <AssessmentQuestionView
                  stepIndex={draft.stepIndex}
                  answers={draft.answers}
                  sections={activeSections}
                  steps={steps}
                  questions={activeQuestions}
                  isSubmitting={isSubmitting}
                  submitError={submitError}
                  onSelectOption={selectOption}
                  onChangeOtherText={setOtherText}
                  onUpdateContact={updateContact}
                  onStepChange={setStepIndex}
                  onSubmit={handleSubmitAssessment}
                  onExitToWelcome={() =>
                    navigate({ area: 'respondent', view: 'welcome' })
                  }
                  onEmitTelemetry={emitTelemetry}
                  onAbandonmentBeacon={emitAbandonmentBeacon}
                />
              ) : route.view === 'confirmation' || route.view === 'results' ? (
                <ResultsView
                  submissionId={route.submissionId}
                  initialRecord={activeSubmission}
                  onRecordLoaded={setActiveSubmission}
                  onStartNew={restartAssessment}
                  onBackHome={() =>
                    navigate({ area: 'respondent', view: 'welcome' })
                  }
                />
              ) : (
                <WelcomeView
                  hasStarted={hasStarted}
                  answeredCount={answeredCount}
                  lastSubmissionId={draft.lastSubmissionId}
                  sections={activeSections}
                  onStartOrResume={startAssessment}
                  onRestart={restartAssessment}
                  onViewLastResults={(id) =>
                    navigate({
                      area: 'respondent',
                      view: 'results',
                      submissionId: id,
                    })
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <Footer
          theme={theme}
          onThemeChange={setTheme}
          onNavigate={navigate}
        />
      </div>
    </MotionConfig>
  );
}
