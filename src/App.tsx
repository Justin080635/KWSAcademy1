import { useState } from 'react';
import { AdminPortal } from './components/admin/AdminPortal.tsx';
import { AssessmentQuestionView } from './components/respondent/AssessmentQuestionView.tsx';
import { ResultsView } from './components/respondent/ResultsView.tsx';
import { SubmissionConfirmationView } from './components/respondent/SubmissionConfirmationView.tsx';
import { WelcomeView } from './components/respondent/WelcomeView.tsx';
import { Footer } from './components/ui/Footer.tsx';
import { TopBar } from './components/ui/TopBar.tsx';
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
          : 'A network error prevented submission. Your answers are preserved—please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--kws-bg)] text-[var(--kws-ink)]">
      <TopBar
        route={route}
        hasStarted={hasStarted}
        lastSubmissionId={draft.lastSubmissionId}
        onNavigate={navigate}
        onStartOrResume={startAssessment}
      />

      <main className="flex-1">
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
        ) : route.view === 'confirmation' ? (
          <SubmissionConfirmationView
            submissionId={route.submissionId}
            record={activeSubmission}
            onViewResults={() =>
              navigate({
                area: 'respondent',
                view: 'results',
                submissionId: route.submissionId,
              })
            }
          />
        ) : route.view === 'results' ? (
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
      </main>

      <Footer
        theme={theme}
        onThemeChange={setTheme}
        onNavigate={navigate}
      />
    </div>
  );
}
