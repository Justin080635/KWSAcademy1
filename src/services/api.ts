import type {
  AdminAnalyticsSummary,
  AdminSubmissionFilters,
  AssessmentConfigPayload,
  AssessmentQuestion,
  AssessmentResult,
  AssessmentSectionMeta,
  AssessmentVersionRecord,
  CampaignAttribution,
  CampaignCostRecord,
  CommunicationChannel,
  CommunicationDeliveryStatus,
  CommunicationMessageRecord,
  CommunicationTemplateType,
  ConsultationStatus,
  CrmSyncEventRecord,
  HumanReviewCategory,
  IntegrationStatusItem,
  LeadSegmentationConfig,
  PilotFeedback,
  QuestionTelemetryInput,
  RespondentAnswers,
  RespondentContact,
  StaffRole,
  StorageBoundaryStatus,
  SubmissionCompletionStatus,
  SubmissionRecord,
  WhatsAppRecipientPreview,
} from '../domain/types.ts';
import type { PartAScoringConfig } from '../domain/scoringConfig.ts';

const TOKEN_STORAGE_KEY = 'kws_submission_tokens_v1';

export interface PublicRespondentRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  completionStatus: SubmissionCompletionStatus;
  assessmentVersion: string;
  scoringVersion: string;
  durationMinutes: number;
  contact: RespondentContact;
  feedback: PilotFeedback;
  result: AssessmentResult;
  consultationSummary: {
    preference: 'book' | 'more_info' | 'none';
    status: ConsultationStatus;
    requestedAt: string;
  };
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function saveSubmissionAccessToken(id: string, token: string): void {
  if (!id || !token) return;
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[id] = token;
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export function getSubmissionAccessToken(id: string): string {
  try {
    const urlToken = new URLSearchParams(window.location.search).get('token');
    if (urlToken) {
      saveSubmissionAccessToken(id, urlToken);
      return urlToken;
    }
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return '';
    const map = JSON.parse(raw) as Record<string, string>;
    return map[id] ?? '';
  } catch {
    return '';
  }
}

async function requestJson<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      typeof data.error === 'string' ? data.error : 'REQUEST_FAILED',
      typeof data.message === 'string'
        ? data.message
        : `Request failed with status ${res.status}.`
    );
  }
  return data as T;
}

export async function fetchAssessmentConfig(): Promise<AssessmentConfigPayload> {
  return requestJson('/api/assessment/config');
}

export async function createDraftSubmission(payload: {
  idempotencyKey: string;
  answers: RespondentAnswers;
  attribution: Partial<CampaignAttribution>;
  durationMinutes: number;
}): Promise<{
  record: PublicRespondentRecord;
  accessToken: string;
  deduplicated: boolean;
}> {
  const data = await requestJson<{
    record: PublicRespondentRecord;
    accessToken: string;
    deduplicated: boolean;
  }>('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'draft',
      ...payload,
    }),
  });
  if (data.accessToken) {
    saveSubmissionAccessToken(data.record.id, data.accessToken);
  }
  return data;
}

export async function saveDraftAnswers(
  submissionId: string,
  accessToken: string,
  payload: {
    answers: RespondentAnswers;
    attribution: Partial<CampaignAttribution>;
    durationMinutes: number;
  }
): Promise<PublicRespondentRecord> {
  const data = await requestJson<{ record: PublicRespondentRecord }>(
    `/api/submissions/${encodeURIComponent(submissionId)}/answers`,
    {
      method: 'PUT',
      headers: {
        'X-Submission-Token': accessToken,
      },
      body: JSON.stringify(payload),
    }
  );
  return data.record;
}

export async function finalizeDraftSubmission(
  submissionId: string,
  accessToken: string,
  payload: {
    submitNonce: string;
    answers: RespondentAnswers;
    attribution: Partial<CampaignAttribution>;
    durationMinutes: number;
  }
): Promise<PublicRespondentRecord> {
  const data = await requestJson<{
    record: PublicRespondentRecord;
    deduplicated: boolean;
  }>(`/api/submissions/${encodeURIComponent(submissionId)}/submit`, {
    method: 'POST',
    headers: {
      'X-Submission-Token': accessToken,
    },
    body: JSON.stringify(payload),
  });
  saveSubmissionAccessToken(data.record.id, accessToken);
  return data.record;
}

export async function submitAssessment(payload: {
  idempotencyKey?: string;
  submitNonce?: string;
  answers: RespondentAnswers;
  attribution?: Partial<CampaignAttribution>;
  durationMinutes: number;
}): Promise<PublicRespondentRecord> {
  const data = await requestJson<{
    record: PublicRespondentRecord;
    accessToken?: string;
  }>('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'submit',
      ...payload,
    }),
  });
  if (data.accessToken) {
    saveSubmissionAccessToken(data.record.id, data.accessToken);
  }
  return data.record;
}

export async function fetchSubmissionById(
  id: string,
  explicitToken?: string
): Promise<PublicRespondentRecord> {
  const token = explicitToken ?? getSubmissionAccessToken(id);
  const data = await requestJson<{ record: PublicRespondentRecord }>(
    `/api/submissions/${encodeURIComponent(id)}`,
    {
      headers: token ? { 'X-Submission-Token': token } : {},
    }
  );
  return data.record;
}

export async function savePilotFeedback(
  submissionId: string,
  feedback: PilotFeedback,
  explicitToken?: string
): Promise<PublicRespondentRecord> {
  const token = explicitToken ?? getSubmissionAccessToken(submissionId);
  const data = await requestJson<{ record: PublicRespondentRecord }>(
    `/api/submissions/${encodeURIComponent(submissionId)}/feedback`,
    {
      method: 'PATCH',
      headers: token ? { 'X-Submission-Token': token } : {},
      body: JSON.stringify(feedback),
    }
  );
  return data.record;
}

export async function requestConsultation(
  submissionId: string,
  preference: 'book' | 'more_info',
  explicitToken?: string
): Promise<PublicRespondentRecord> {
  const token = explicitToken ?? getSubmissionAccessToken(submissionId);
  const data = await requestJson<{ record: PublicRespondentRecord }>(
    `/api/submissions/${encodeURIComponent(submissionId)}/consultation`,
    {
      method: 'POST',
      headers: token ? { 'X-Submission-Token': token } : {},
      body: JSON.stringify({ preference }),
    }
  );
  return data.record;
}

export interface AdminStatusResponse {
  authConfigured: boolean;
  accountSignInEnabled: boolean;
  allowlistEnabled: boolean;
  authenticated: boolean;
  role: StaffRole | null;
  actorLabel: string | null;
  storage: StorageBoundaryStatus;
}

export async function fetchAdminStatus(): Promise<AdminStatusResponse> {
  return requestJson<AdminStatusResponse>('/api/admin/status');
}

export async function loginAdmin(
  passcode: string,
  email?: string
): Promise<{
  authenticated: boolean;
  role: StaffRole;
  actorLabel: string;
}> {
  return requestJson<{
    authenticated: boolean;
    role: StaffRole;
    actorLabel: string;
  }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({
      passcode,
      ...(email?.trim() ? { email: email.trim() } : {}),
    }),
  });
}

export async function logoutAdmin(): Promise<{ authenticated: boolean }> {
  return requestJson<{ authenticated: boolean }>('/api/admin/logout', {
    method: 'POST',
  });
}

export function buildAdminFilterParams(
  filters: AdminSubmissionFilters = {}
): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.q?.trim()) sp.set('q', filters.q.trim());
  if (filters.dateFrom?.trim()) sp.set('dateFrom', filters.dateFrom.trim());
  if (filters.dateTo?.trim()) sp.set('dateTo', filters.dateTo.trim());
  if (filters.source && filters.source !== 'all') {
    sp.set('source', filters.source);
  }
  if (filters.audience && filters.audience !== 'all') {
    sp.set('audience', filters.audience);
  }
  if (filters.location?.trim()) sp.set('location', filters.location.trim());
  if (filters.urgency && filters.urgency !== 'all') {
    sp.set('urgency', filters.urgency);
  }
  if (filters.financialReadiness && filters.financialReadiness !== 'all') {
    sp.set('financialReadiness', filters.financialReadiness);
  }
  if (filters.januaryCohort && filters.januaryCohort !== 'all') {
    sp.set('januaryCohort', filters.januaryCohort);
  }
  if (filters.consultationStatus && filters.consultationStatus !== 'all') {
    sp.set('consultationStatus', filters.consultationStatus);
  }
  if (filters.reviewCategory && filters.reviewCategory !== 'all') {
    sp.set('reviewCategory', filters.reviewCategory);
  }
  if (filters.includeDrafts) {
    sp.set('includeDrafts', 'true');
  }
  return sp;
}

export async function fetchAdminSubmissions(
  filters: AdminSubmissionFilters = {}
): Promise<{ records: SubmissionRecord[]; totalCount: number }> {
  const qs = buildAdminFilterParams(filters).toString();
  return requestJson<{ records: SubmissionRecord[]; totalCount: number }>(
    `/api/admin/submissions${qs ? `?${qs}` : ''}`
  );
}

export async function fetchAdminSubmissionDetail(
  id: string
): Promise<SubmissionRecord> {
  const data = await requestJson<{ record: SubmissionRecord }>(
    `/api/admin/submissions/${encodeURIComponent(id)}`
  );
  return data.record;
}

export async function updateConsultationRecord(
  id: string,
  patch: {
    consultationStatus?: ConsultationStatus;
    reviewCategory?: HumanReviewCategory;
    staffNotes?: string;
    assignedStaffMember?: string;
    incrementAttempt?: boolean;
    scheduledAt?: string | null;
  }
): Promise<SubmissionRecord> {
  const data = await requestJson<{ record: SubmissionRecord }>(
    `/api/admin/consultations/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  );
  return data.record;
}

export async function fetchAdminAnalytics(
  filters: AdminSubmissionFilters = {}
): Promise<AdminAnalyticsSummary> {
  const qs = buildAdminFilterParams(filters).toString();
  const data = await requestJson<{ summary: AdminAnalyticsSummary }>(
    `/api/admin/analytics${qs ? `?${qs}` : ''}`
  );
  return data.summary;
}

export function buildAdminExportUrl(
  format: 'csv' | 'xlsx' | 'json',
  filters: AdminSubmissionFilters = {}
): string {
  const sp = buildAdminFilterParams({ ...filters, includeDrafts: false });
  sp.set('format', format);
  return `/api/admin/export?${sp.toString()}`;
}

export async function createDatabaseBackup(): Promise<{
  ok: boolean;
  filename: string;
  sizeBytes: number;
  createdAt: string;
}> {
  return requestJson('/api/admin/backup', { method: 'POST' });
}

export async function sendSubmissionTelemetry(
  submissionId: string,
  accessToken: string,
  events: QuestionTelemetryInput[]
): Promise<{ inserted: number }> {
  if (!submissionId || !accessToken || events.length === 0) {
    return { inserted: 0 };
  }
  return requestJson<{ ok: boolean; inserted: number }>(
    `/api/submissions/${encodeURIComponent(submissionId)}/events`,
    {
      method: 'POST',
      headers: {
        'X-Submission-Token': accessToken,
      },
      body: JSON.stringify({ events }),
      keepalive: true,
    }
  );
}

export function sendAbandonmentBeacon(
  submissionId: string,
  accessToken: string,
  events: QuestionTelemetryInput[]
): boolean {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.sendBeacon !== 'function' ||
    !submissionId ||
    !accessToken ||
    events.length === 0
  ) {
    return false;
  }
  try {
    const blob = new Blob(
      [JSON.stringify({ accessToken, events })],
      { type: 'application/json' }
    );
    return navigator.sendBeacon(
      `/api/submissions/${encodeURIComponent(submissionId)}/events`,
      blob
    );
  } catch {
    return false;
  }
}

export async function fetchCampaignCosts(): Promise<CampaignCostRecord[]> {
  const data = await requestJson<{ costs: CampaignCostRecord[] }>(
    '/api/admin/campaign-costs'
  );
  return data.costs;
}

export async function saveCampaignCost(payload: {
  utmSource: string;
  utmCampaign: string;
  currency: string;
  amountSpent: number;
  periodLabel?: string;
  notes?: string;
}): Promise<CampaignCostRecord> {
  const data = await requestJson<{ cost: CampaignCostRecord }>(
    '/api/admin/campaign-costs',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
  return data.cost;
}

export async function fetchAssessmentVersions(): Promise<{
  versions: AssessmentVersionRecord[];
  activeVersionId: string;
}> {
  return requestJson('/api/admin/versions');
}

export async function createAssessmentVersion(payload: {
  versionId: string;
  label: string;
  changeSummary: string;
  questions: AssessmentQuestion[];
  sections?: AssessmentSectionMeta[];
  activateImmediately?: boolean;
}): Promise<AssessmentVersionRecord> {
  const data = await requestJson<{ version: AssessmentVersionRecord }>(
    '/api/admin/versions',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return data.version;
}

export async function activateAssessmentVersion(
  versionId: string
): Promise<AssessmentVersionRecord> {
  const data = await requestJson<{ version: AssessmentVersionRecord }>(
    `/api/admin/versions/${encodeURIComponent(versionId)}/activate`,
    {
      method: 'POST',
    }
  );
  return data.version;
}

export async function fetchPartAScoringConfig(): Promise<{
  config: PartAScoringConfig;
  activeVersionId: string;
}> {
  return requestJson('/api/admin/configs/scoring');
}

export async function savePartAScoringConfig(
  config: PartAScoringConfig
): Promise<PartAScoringConfig> {
  const data = await requestJson<{ config: PartAScoringConfig }>(
    '/api/admin/configs/scoring',
    {
      method: 'PUT',
      body: JSON.stringify(config),
    }
  );
  return data.config;
}

export async function fetchLeadSegmentationConfig(): Promise<{
  config: LeadSegmentationConfig;
}> {
  return requestJson('/api/admin/configs/segmentation');
}

export async function saveLeadSegmentationConfig(
  config: LeadSegmentationConfig
): Promise<LeadSegmentationConfig> {
  const data = await requestJson<{ config: LeadSegmentationConfig }>(
    '/api/admin/configs/segmentation',
    {
      method: 'PUT',
      body: JSON.stringify(config),
    }
  );
  return data.config;
}

export async function applyLeadSegmentationRules(): Promise<{
  updatedCount: number;
  skippedManualCount: number;
}> {
  return requestJson('/api/admin/segmentation/apply', {
    method: 'POST',
  });
}

export async function fetchCommunicationMessages(options?: {
  submissionId?: string;
  channel?: CommunicationChannel;
  limit?: number;
}): Promise<CommunicationMessageRecord[]> {
  const sp = new URLSearchParams();
  if (options?.submissionId) sp.set('submissionId', options.submissionId);
  if (options?.channel) sp.set('channel', options.channel);
  if (options?.limit) sp.set('limit', String(options.limit));
  const qs = sp.toString();
  const data = await requestJson<{ messages: CommunicationMessageRecord[] }>(
    `/api/admin/communications${qs ? `?${qs}` : ''}`
  );
  return data.messages;
}

export async function sendAdminEmail(payload: {
  submissionIds: string[];
  messageType: CommunicationTemplateType;
  subject?: string;
  bodyText?: string;
}): Promise<CommunicationMessageRecord[]> {
  const data = await requestJson<{ messages: CommunicationMessageRecord[] }>(
    '/api/admin/communications/email/send',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return data.messages;
}

export async function previewWhatsAppCampaign(payload: {
  submissionIds: string[];
  templateType: CommunicationTemplateType;
  customMessage?: string;
}): Promise<{
  previews: WhatsAppRecipientPreview[];
  summary: { total: number; eligible: number; blocked: number };
}> {
  return requestJson('/api/admin/communications/whatsapp/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function sendWhatsAppCampaign(payload: {
  submissionIds: string[];
  templateType: CommunicationTemplateType;
  customMessage?: string;
  confirmedReview: boolean;
}): Promise<{
  sentCount: number;
  blockedCount: number;
  skippedCount: number;
  failedCount: number;
  messages: CommunicationMessageRecord[];
}> {
  return requestJson('/api/admin/communications/whatsapp/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCommunicationStatus(
  messageId: string,
  status: CommunicationDeliveryStatus,
  errorDetail?: string
): Promise<CommunicationMessageRecord> {
  const data = await requestJson<{ message: CommunicationMessageRecord }>(
    `/api/admin/communications/${encodeURIComponent(messageId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, errorDetail }),
    }
  );
  return data.message;
}

export async function fetchIntegrationsStatus(): Promise<{
  integrations: IntegrationStatusItem[];
  syncEvents: CrmSyncEventRecord[];
}> {
  return requestJson('/api/admin/integrations');
}

export async function syncSubmissionToIntegration(
  provider: 'mailchimp' | 'crm_webhook',
  submissionId: string
): Promise<CrmSyncEventRecord> {
  const data = await requestJson<{ syncEvent: CrmSyncEventRecord }>(
    `/api/admin/integrations/${encodeURIComponent(provider)}/sync`,
    {
      method: 'POST',
      body: JSON.stringify({ submissionId }),
    }
  );
  return data.syncEvent;
}
