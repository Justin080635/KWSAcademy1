import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { QUESTION_MAP } from '../src/domain/assessmentContent.ts';
import type {
  CampaignAttribution,
  PilotFeedback,
  RespondentAnswers,
} from '../src/domain/types.ts';

const CONTROL_CHARS_SINGLE = /[\u0000-\u001F\u007F]/g;
const CONTROL_CHARS_MULTI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeSingleLine(value: unknown, maxLen = 200): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_CHARS_SINGLE, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function sanitizeMultiline(value: unknown, maxLen = 2000): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_CHARS_MULTI, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function sanitizeIdToken(value: unknown, maxLen = 128): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, maxLen);
}

export function sanitizeAnswersPayload(raw: unknown): RespondentAnswers {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;

  const rawSelections =
    input.selections && typeof input.selections === 'object'
      ? (input.selections as Record<string, unknown>)
      : {};
  const selections: Record<string, string> = {};

  for (const [rawQId, rawOptId] of Object.entries(rawSelections)) {
    const qId = sanitizeIdToken(rawQId, 64);
    const optId = sanitizeIdToken(rawOptId, 96);
    if (!qId || !optId) continue;
    const question = QUESTION_MAP[qId];
    if (!question) continue;
    if (question.options.some((o) => o.id === optId)) {
      selections[qId] = optId;
    }
  }

  const rawOther =
    input.otherText && typeof input.otherText === 'object'
      ? (input.otherText as Record<string, unknown>)
      : {};
  const otherText: Record<string, string> = {};
  for (const [rawQId, rawVal] of Object.entries(rawOther)) {
    const qId = sanitizeIdToken(rawQId, 64);
    if (!qId || !QUESTION_MAP[qId]) continue;
    const cleaned = sanitizeSingleLine(rawVal, 300);
    if (cleaned) {
      otherText[qId] = cleaned;
    }
  }

  const rawContact =
    input.contact && typeof input.contact === 'object'
      ? (input.contact as Record<string, unknown>)
      : {};

  return {
    selections,
    otherText,
    contact: {
      fullName: sanitizeSingleLine(rawContact.fullName, 140),
      whatsappNumber: sanitizeSingleLine(rawContact.whatsappNumber, 40),
      email: sanitizeSingleLine(rawContact.email, 160).toLowerCase(),
      city: sanitizeSingleLine(rawContact.city, 100),
      state: sanitizeSingleLine(rawContact.state, 100),
      institution: sanitizeSingleLine(rawContact.institution, 180),
      whatsappConsent: Boolean(rawContact.whatsappConsent),
    },
  };
}

export function sanitizeAttributionPayload(
  raw: unknown,
  answers?: RespondentAnswers
): CampaignAttribution {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const q8Id = answers?.selections?.['profile_q08'] ?? '';
  const q8Opt = QUESTION_MAP['profile_q08']?.options.find(
    (o) => o.id === q8Id
  );
  const q8Extra = answers?.otherText?.['profile_q08']?.trim();
  const discoveryLabel = q8Opt
    ? q8Extra
      ? `${q8Opt.label} (${q8Extra})`
      : q8Opt.label
    : '';

  return {
    utmSource: sanitizeSingleLine(input.utmSource, 120),
    utmMedium: sanitizeSingleLine(input.utmMedium, 120),
    utmCampaign: sanitizeSingleLine(input.utmCampaign, 160),
    utmTerm: sanitizeSingleLine(input.utmTerm, 120),
    utmContent: sanitizeSingleLine(input.utmContent, 120),
    adSet: sanitizeSingleLine(input.adSet, 120),
    creative: sanitizeSingleLine(input.creative, 120),
    placement: sanitizeSingleLine(input.placement, 120),
    referrer: sanitizeSingleLine(input.referrer, 300),
    landingPath: sanitizeSingleLine(input.landingPath, 200),
    discoverySourceOptionId:
      q8Id || sanitizeIdToken(input.discoverySourceOptionId, 96),
    discoverySourceLabel:
      discoveryLabel || sanitizeSingleLine(input.discoverySourceLabel, 200),
  };
}

const VALID_TELEMETRY_TYPES = new Set([
  'assessment_started',
  'section_entered',
  'question_displayed',
  'answer_selected',
  'answer_changed',
  'continue_clicked',
  'back_clicked',
  'section_completed',
  'assessment_abandoned',
  'assessment_submitted',
  'results_viewed',
]);

export function sanitizeTelemetryBatch(raw: unknown) {
  const list = Array.isArray(raw) ? raw : [];
  const results: Array<{
    eventType:
      | 'assessment_started'
      | 'section_entered'
      | 'question_displayed'
      | 'answer_selected'
      | 'answer_changed'
      | 'continue_clicked'
      | 'back_clicked'
      | 'section_completed'
      | 'assessment_abandoned'
      | 'assessment_submitted'
      | 'results_viewed';
    sectionId: string;
    questionId: string;
    optionId: string;
    previousOptionId: string;
    activeTimeMs: number;
    inactiveTimeMs: number;
    wallTimeMs: number;
    clientTimestamp: string;
    metadata: Record<string, unknown>;
  }> = [];

  for (const item of list.slice(0, 60)) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const eventType = String(obj.eventType ?? '');
    if (!VALID_TELEMETRY_TYPES.has(eventType)) continue;
    const clampMs = (v: unknown) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.min(Math.round(n), 3600000);
    };
    results.push({
      eventType: eventType as (typeof results)[number]['eventType'],
      sectionId: sanitizeIdToken(obj.sectionId, 64),
      questionId: sanitizeIdToken(obj.questionId, 64),
      optionId: sanitizeIdToken(obj.optionId, 96),
      previousOptionId: sanitizeIdToken(obj.previousOptionId, 96),
      activeTimeMs: clampMs(obj.activeTimeMs),
      inactiveTimeMs: clampMs(obj.inactiveTimeMs),
      wallTimeMs: clampMs(obj.wallTimeMs),
      clientTimestamp: sanitizeSingleLine(obj.clientTimestamp, 48),
      metadata:
        obj.metadata && typeof obj.metadata === 'object'
          ? (obj.metadata as Record<string, unknown>)
          : {},
    });
  }
  return results;
}

export function sanitizeFeedbackPayload(raw: unknown): PilotFeedback | null {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const validFit = (v: unknown): v is 'Yes' | 'Partly' | 'No' | '' =>
    v === 'Yes' || v === 'Partly' || v === 'No' || v === '';

  const archetypeFits = input.archetypeFits ?? '';
  const stageFits = input.stageFits ?? '';

  if (!validFit(archetypeFits) || !validFit(stageFits)) {
    return null;
  }

  return {
    archetypeFits,
    stageFits,
    notes: sanitizeMultiline(input.notes, 1500),
  };
}

export function generatePrivateId(prefix = 'kws'): string {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

export function generateAccessToken(): string {
  return `kws_tok_${crypto.randomBytes(24).toString('hex')}`;
}

export function hashAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyAccessTokenHash(
  candidateToken: string | undefined,
  expectedHash: string
): boolean {
  if (!candidateToken || !expectedHash) return false;
  const candidateHash = hashAccessToken(candidateToken.trim());
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

export function extractSubmissionToken(req: Request): string {
  const headerToken = req.headers['x-submission-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  if (typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  if (
    req.body &&
    typeof req.body === 'object' &&
    typeof (req.body as { accessToken?: unknown }).accessToken === 'string'
  ) {
    return (req.body as { accessToken: string }).accessToken.trim();
  }
  return '';
}

export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  next();
}

export class LoginRateLimiter {
  private readonly attempts = new Map<
    string,
    { count: number; resetAt: number }
  >();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = 10, windowMs = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isLimited(key: string): boolean {
    const entry = this.attempts.get(key);
    if (!entry) return false;
    if (Date.now() > entry.resetAt) {
      this.attempts.delete(key);
      return false;
    }
    return entry.count >= this.maxAttempts;
  }

  recordFailure(key: string): void {
    const now = Date.now();
    const current = this.attempts.get(key);
    if (!current || now > current.resetAt) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    current.count += 1;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
