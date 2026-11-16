import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_SECTIONS,
  ASSESSMENT_STEPS,
  buildAssessmentSteps,
} from '../domain/assessmentContent.ts';
import type {
  AssessmentConfigPayload,
  AssessmentSectionId,
  CampaignAttribution,
  QuestionTelemetryInput,
  RespondentAnswers,
} from '../domain/types.ts';
import {
  createDraftSubmission,
  fetchAssessmentConfig,
  saveDraftAnswers,
  sendAbandonmentBeacon,
  sendSubmissionTelemetry,
  type PublicRespondentRecord,
} from '../services/api.ts';

export type AppRoute =
  | { area: 'respondent'; view: 'welcome' }
  | { area: 'respondent'; view: 'assessment' }
  | { area: 'respondent'; view: 'confirmation'; submissionId: string }
  | { area: 'respondent'; view: 'results'; submissionId: string }
  | {
      area: 'admin';
      view:
        | 'overview'
        | 'records'
        | 'analytics'
        | 'communications'
        | 'versions'
        | 'integrations'
        | 'exports';
    }
  | { area: 'admin'; view: 'profile'; submissionId: string };

export type ThemePreference = 'light' | 'dark' | 'system';

const DRAFT_STORAGE_KEY = 'kws_assessment_draft_v3';
const THEME_STORAGE_KEY = 'kws_theme_preference_v1';

interface DraftPayload {
  idempotencyKey: string;
  submitNonce: string;
  backendSubmissionId: string | null;
  backendAccessToken: string | null;
  stepIndex: number;
  startedAt: number | null;
  answers: RespondentAnswers;
  attribution: Partial<CampaignAttribution>;
  lastSubmissionId: string | null;
}

function generateClientId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function captureInitialAttribution(): Partial<CampaignAttribution> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') ?? '',
    utmMedium: params.get('utm_medium') ?? '',
    utmCampaign: params.get('utm_campaign') ?? '',
    utmTerm: params.get('utm_term') ?? '',
    utmContent: params.get('utm_content') ?? '',
    adSet:
      params.get('utm_adset') ??
      params.get('adset') ??
      params.get('ad_set') ??
      '',
    creative:
      params.get('utm_creative') ??
      params.get('creative') ??
      params.get('ad_creative') ??
      '',
    placement: params.get('utm_placement') ?? params.get('placement') ?? '',
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    landingPath: window.location.pathname,
  };
}

const EMPTY_ANSWERS: RespondentAnswers = {
  selections: {},
  otherText: {},
  contact: {
    fullName: '',
    whatsappNumber: '',
    email: '',
    city: '',
    state: '',
    institution: '',
    whatsappConsent: false,
  },
};

function createFreshDraft(lastSubmissionId: string | null = null): DraftPayload {
  return {
    idempotencyKey: generateClientId('idem'),
    submitNonce: generateClientId('nonce'),
    backendSubmissionId: null,
    backendAccessToken: null,
    stepIndex: 0,
    startedAt: null,
    answers: EMPTY_ANSWERS,
    attribution: captureInitialAttribution(),
    lastSubmissionId,
  };
}

export function parseRouteFromPath(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/assessment') {
    return { area: 'respondent', view: 'assessment' };
  }
  if (clean.startsWith('/confirmation/')) {
    const submissionId = decodeURIComponent(
      clean.slice('/confirmation/'.length)
    );
    if (submissionId) {
      return { area: 'respondent', view: 'confirmation', submissionId };
    }
  }
  if (clean.startsWith('/results/')) {
    const submissionId = decodeURIComponent(clean.slice('/results/'.length));
    if (submissionId) {
      return { area: 'respondent', view: 'results', submissionId };
    }
  }
  if (clean === '/admin' || clean === '/admin/overview') {
    return { area: 'admin', view: 'overview' };
  }
  if (clean === '/admin/records') {
    return { area: 'admin', view: 'records' };
  }
  if (clean.startsWith('/admin/records/')) {
    const submissionId = decodeURIComponent(
      clean.slice('/admin/records/'.length)
    );
    if (submissionId) {
      return { area: 'admin', view: 'profile', submissionId };
    }
  }
  if (clean === '/admin/analytics') {
    return { area: 'admin', view: 'analytics' };
  }
  if (clean === '/admin/communications') {
    return { area: 'admin', view: 'communications' };
  }
  if (clean === '/admin/versions') {
    return { area: 'admin', view: 'versions' };
  }
  if (clean === '/admin/integrations') {
    return { area: 'admin', view: 'integrations' };
  }
  if (clean === '/admin/exports') {
    return { area: 'admin', view: 'exports' };
  }
  return { area: 'respondent', view: 'welcome' };
}

export function routeToPath(route: AppRoute): string {
  if (route.area === 'respondent') {
    if (route.view === 'assessment') return '/assessment';
    if (route.view === 'confirmation') {
      return `/confirmation/${encodeURIComponent(route.submissionId)}`;
    }
    if (route.view === 'results') {
      return `/results/${encodeURIComponent(route.submissionId)}`;
    }
    return '/';
  }
  if (route.view === 'records') return '/admin/records';
  if (route.view === 'profile') {
    return `/admin/records/${encodeURIComponent(route.submissionId)}`;
  }
  if (route.view === 'analytics') return '/admin/analytics';
  if (route.view === 'communications') return '/admin/communications';
  if (route.view === 'versions') return '/admin/versions';
  if (route.view === 'integrations') return '/admin/integrations';
  if (route.view === 'exports') return '/admin/exports';
  return '/admin';
}

function loadDraft(): DraftPayload {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return createFreshDraft();

    const parsed = JSON.parse(raw) as Partial<DraftPayload>;
    return {
      idempotencyKey:
        typeof parsed.idempotencyKey === 'string' && parsed.idempotencyKey
          ? parsed.idempotencyKey
          : generateClientId('idem'),
      submitNonce:
        typeof parsed.submitNonce === 'string' && parsed.submitNonce
          ? parsed.submitNonce
          : generateClientId('nonce'),
      backendSubmissionId:
        typeof parsed.backendSubmissionId === 'string'
          ? parsed.backendSubmissionId
          : null,
      backendAccessToken:
        typeof parsed.backendAccessToken === 'string'
          ? parsed.backendAccessToken
          : null,
      stepIndex:
        typeof parsed.stepIndex === 'number'
          ? Math.max(
              0,
              Math.min(ASSESSMENT_STEPS.length - 1, parsed.stepIndex)
            )
          : 0,
      startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : null,
      answers: {
        selections: parsed.answers?.selections ?? {},
        otherText: parsed.answers?.otherText ?? {},
        contact: {
          fullName: parsed.answers?.contact?.fullName ?? '',
          whatsappNumber: parsed.answers?.contact?.whatsappNumber ?? '',
          email: parsed.answers?.contact?.email ?? '',
          city: parsed.answers?.contact?.city ?? '',
          state: parsed.answers?.contact?.state ?? '',
          institution: parsed.answers?.contact?.institution ?? '',
          whatsappConsent: Boolean(parsed.answers?.contact?.whatsappConsent),
        },
      },
      attribution: parsed.attribution ?? captureInitialAttribution(),
      lastSubmissionId:
        typeof parsed.lastSubmissionId === 'string'
          ? parsed.lastSubmissionId
          : null,
    };
  } catch {
    return createFreshDraft();
  }
}

export function useAssessmentSession() {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRouteFromPath(window.location.pathname)
  );
  const [draft, setDraft] = useState<DraftPayload>(() => loadDraft());
  const [activeSubmission, setActiveSubmission] =
    useState<PublicRespondentRecord | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  });

  const [assessmentConfig, setAssessmentConfig] =
    useState<AssessmentConfigPayload>(() => ({
      assessmentVersion: 'kws-assessment-v2.0',
      scoringVersion: 'kws-scoring-v3.0',
      partAConfigVersion: 'approved-v1',
      partAConfigApproved: true,
      sections: ASSESSMENT_SECTIONS,
      questions: ASSESSMENT_QUESTIONS,
      stepsCount: ASSESSMENT_STEPS.length,
    }));

  const steps = useMemo(
    () => buildAssessmentSteps(assessmentConfig.questions),
    [assessmentConfig.questions]
  );
  const stepsLengthRef = useRef<number>(steps.length);
  useEffect(() => {
    stepsLengthRef.current = steps.length;
  }, [steps.length]);

  useEffect(() => {
    let active = true;
    fetchAssessmentConfig()
      .then((cfg) => {
        if (!active) return;
        if (Array.isArray(cfg.questions) && cfg.questions.length > 0) {
          setAssessmentConfig(cfg);
          const nextSteps = buildAssessmentSteps(cfg.questions);
          setDraft((prev) => ({
            ...prev,
            stepIndex: Math.max(
              0,
              Math.min(nextSteps.length - 1, prev.stepIndex)
            ),
          }));
        }
      })
      .catch(() => {
        // Fallback smoothly to bundled domain defaults if offline
      });
    return () => {
      active = false;
    };
  }, []);

  const syncInFlightRef = useRef(false);
  const pendingTelemetryRef = useRef<QuestionTelemetryInput[]>([]);
  const draftIdRef = useRef<string | null>(draft.backendSubmissionId);
  const draftTokenRef = useRef<string | null>(draft.backendAccessToken);
  const lastSectionRef = useRef<AssessmentSectionId | null>(null);

  useEffect(() => {
    draftIdRef.current = draft.backendSubmissionId;
    draftTokenRef.current = draft.backendAccessToken;
  }, [draft.backendSubmissionId, draft.backendAccessToken]);

  const flushTelemetryQueue = useCallback(
    async (submissionId?: string | null, accessToken?: string | null) => {
      const targetId = submissionId ?? draftIdRef.current;
      const targetToken = accessToken ?? draftTokenRef.current;
      if (!targetId || !targetToken || pendingTelemetryRef.current.length === 0) {
        return;
      }
      const batch = [...pendingTelemetryRef.current];
      pendingTelemetryRef.current = [];
      try {
        await sendSubmissionTelemetry(targetId, targetToken, batch);
      } catch {
        // Silent retry: re-prepend only up to 40 buffered events
        pendingTelemetryRef.current = [
          ...batch.slice(-20),
          ...pendingTelemetryRef.current.slice(-20),
        ];
      }
    },
    []
  );

  const emitTelemetry = useCallback(
    (events: QuestionTelemetryInput[]) => {
      if (events.length === 0) return;
      const stamped = events.map((e) => ({
        ...e,
        clientTimestamp: e.clientTimestamp ?? new Date().toISOString(),
      }));
      pendingTelemetryRef.current.push(...stamped);
      if (draftIdRef.current && draftTokenRef.current) {
        void flushTelemetryQueue();
      }
    },
    [flushTelemetryQueue]
  );

  const emitAbandonmentBeacon = useCallback(
    (event: QuestionTelemetryInput) => {
      const targetId = draftIdRef.current;
      const targetToken = draftTokenRef.current;
      if (!targetId || !targetToken) return;
      const combined = [
        ...pendingTelemetryRef.current,
        {
          ...event,
          clientTimestamp: event.clientTimestamp ?? new Date().toISOString(),
        },
      ];
      pendingTelemetryRef.current = [];
      sendAbandonmentBeacon(targetId, targetToken, combined);
    },
    []
  );

  useEffect(() => {
    const root = document.documentElement;
    const apply = (pref: ThemePreference) => {
      if (pref === 'dark') {
        root.classList.add('dark');
      } else if (pref === 'light') {
        root.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia(
          '(prefers-color-scheme: dark)'
        ).matches;
        root.classList.toggle('dark', prefersDark);
      }
    };

    apply(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => apply('system');
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    return undefined;
  }, [theme]);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage quota errors
    }
  }, [draft]);

  // Progressive background draft synchronization with SQLite backend
  useEffect(() => {
    if (route.area !== 'respondent' || route.view !== 'assessment') return;
    if (draft.lastSubmissionId && draft.lastSubmissionId === draft.backendSubmissionId) {
      return;
    }

    const hasAnyInput =
      Object.keys(draft.answers.selections).length > 0 ||
      Boolean(draft.answers.contact.fullName.trim()) ||
      draft.startedAt !== null;
    if (!hasAnyInput) return;

    const timer = window.setTimeout(async () => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      const elapsedMs = draft.startedAt ? Date.now() - draft.startedAt : 60000;
      const durationMinutes = Math.max(1, Math.round(elapsedMs / 60000));

      try {
        if (!draft.backendSubmissionId || !draft.backendAccessToken) {
          const created = await createDraftSubmission({
            idempotencyKey: draft.idempotencyKey,
            answers: draft.answers,
            attribution: draft.attribution,
            durationMinutes,
          });
          if (created.record.completionStatus === 'in_progress') {
            draftIdRef.current = created.record.id;
            draftTokenRef.current =
              created.accessToken || draftTokenRef.current;
            setDraft((prev) => ({
              ...prev,
              backendSubmissionId: created.record.id,
              backendAccessToken:
                created.accessToken || prev.backendAccessToken,
            }));
            void flushTelemetryQueue(
              created.record.id,
              created.accessToken || draftTokenRef.current
            );
          }
        } else {
          await saveDraftAnswers(
            draft.backendSubmissionId,
            draft.backendAccessToken,
            {
              answers: draft.answers,
              attribution: draft.attribution,
              durationMinutes,
            }
          );
          await flushTelemetryQueue();
        }
      } catch {
        // Silent resilience: local sessionStorage preserves answers if offline; retry occurs on next change or final submit
      } finally {
        syncInFlightRef.current = false;
      }
    }, 550);

    return () => window.clearTimeout(timer);
  }, [route, draft, flushTelemetryQueue]);

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRouteFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute, hash?: string) => {
    const targetPath = routeToPath(nextRoute) + (hash ? `#${hash}` : '');
    if (window.location.pathname + window.location.hash !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    setRoute(nextRoute);
    if (hash) {
      requestAnimationFrame(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const startAssessment = useCallback(() => {
    const isFreshStart = draft.startedAt === null;
    setDraft((prev) => ({
      ...prev,
      startedAt: prev.startedAt ?? Date.now(),
    }));
    if (isFreshStart) {
      emitTelemetry([
        {
          eventType: 'assessment_started',
          sectionId: 'professional_style',
        },
      ]);
    }
    navigate({ area: 'respondent', view: 'assessment' });
  }, [draft.startedAt, emitTelemetry, navigate]);

  const restartAssessment = useCallback(() => {
    setActiveSubmission(null);
    pendingTelemetryRef.current = [];
    lastSectionRef.current = null;
    draftIdRef.current = null;
    draftTokenRef.current = null;
    setDraft({
      ...createFreshDraft(null),
      startedAt: Date.now(),
    });
    emitTelemetry([
      {
        eventType: 'assessment_started',
        sectionId: 'professional_style',
      },
    ]);
    navigate({ area: 'respondent', view: 'assessment' });
  }, [emitTelemetry, navigate]);

  const setStepIndex = useCallback((idx: number) => {
    const maxIndex = Math.max(0, stepsLengthRef.current - 1);
    const clamped = Math.max(0, Math.min(maxIndex, idx));
    setDraft((prev) => ({ ...prev, stepIndex: clamped }));
  }, []);

  const selectionsRef = useRef<Record<string, string>>(draft.answers.selections);
  useEffect(() => {
    selectionsRef.current = draft.answers.selections;
  }, [draft.answers.selections]);

  const selectOption = useCallback(
    (
      questionId: string,
      optionId: string,
      sectionId?: AssessmentSectionId
    ) => {
      const previousOptionId = selectionsRef.current[questionId];
      if (previousOptionId !== optionId) {
        emitTelemetry([
          {
            eventType: previousOptionId ? 'answer_changed' : 'answer_selected',
            sectionId,
            questionId,
            optionId,
            previousOptionId: previousOptionId ?? '',
          },
        ]);
      }
      selectionsRef.current = {
        ...selectionsRef.current,
        [questionId]: optionId,
      };
      setDraft((prev) => ({
        ...prev,
        startedAt: prev.startedAt ?? Date.now(),
        answers: {
          ...prev.answers,
          selections: {
            ...prev.answers.selections,
            [questionId]: optionId,
          },
        },
      }));
    },
    [emitTelemetry]
  );

  const setOtherText = useCallback((questionId: string, value: string) => {
    setDraft((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        otherText: {
          ...prev.answers.otherText,
          [questionId]: value,
        },
      },
    }));
  }, []);

  const updateContact = useCallback(
    (patch: Partial<RespondentAnswers['contact']>) => {
      setDraft((prev) => ({
        ...prev,
        answers: {
          ...prev.answers,
          contact: {
            ...prev.answers.contact,
            ...patch,
          },
        },
      }));
    },
    []
  );

  const completeWithSubmission = useCallback(
    (record: PublicRespondentRecord) => {
      void flushTelemetryQueue(record.id, draftTokenRef.current);
      setActiveSubmission(record);
      setDraft((prev) => ({
        ...prev,
        backendSubmissionId: record.id,
        lastSubmissionId: record.id,
      }));
      navigate({
        area: 'respondent',
        view: 'results',
        submissionId: record.id,
      });
    },
    [flushTelemetryQueue, navigate]
  );

  const answeredCount = Object.keys(draft.answers.selections).length;
  const hasStarted = answeredCount > 0 || draft.startedAt !== null;

  return {
    route,
    navigate,
    theme,
    setTheme,
    draft,
    assessmentConfig,
    activeSections: assessmentConfig.sections,
    activeQuestions: assessmentConfig.questions,
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
    flushTelemetryQueue,
    lastSectionRef,
  };
}
