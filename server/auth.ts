import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { StaffRole } from '../src/domain/types.ts';

const COOKIE_NAME = 'kws_staff_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface StaffAccountEntry {
  email: string;
  name: string;
  passcode: string;
  role: StaffRole;
}

export interface StaffSessionInfo {
  authenticated: boolean;
  role?: StaffRole;
  actorLabel?: string;
  email?: string;
}

function getAdminPasscode(): string {
  return process.env.KWS_ADMIN_PASSCODE?.trim() ?? '';
}

function getAdvisorPasscode(): string {
  return process.env.KWS_ADVISOR_PASSCODE?.trim() ?? '';
}

function getViewerPasscode(): string {
  return process.env.KWS_VIEWER_PASSCODE?.trim() ?? '';
}

function parseAllowlistEmails(): Set<string> | null {
  const raw = process.env.KWS_STAFF_ALLOWLIST?.trim();
  if (!raw) return null;
  const items = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return items.length > 0 ? new Set(items) : null;
}

function parseStaffAccounts(): StaffAccountEntry[] {
  const raw = process.env.KWS_STAFF_ACCOUNTS?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object'
      )
      .map((item) => ({
        email:
          typeof item.email === 'string' ? item.email.trim().toLowerCase() : '',
        name:
          typeof item.name === 'string' && item.name.trim()
            ? item.name.trim()
            : typeof item.email === 'string'
              ? item.email.trim()
              : 'KWS Staff',
        passcode: typeof item.passcode === 'string' ? item.passcode.trim() : '',
        role: (
          item.role === 'admin' ||
          item.role === 'advisor' ||
          item.role === 'viewer'
            ? item.role
            : 'advisor'
        ) as StaffRole,
      }))
      .filter((acc) => acc.email.length > 0 && acc.passcode.length >= 6);
  } catch {
    return [];
  }
}

function getSessionSecret(): string {
  const configured = process.env.KWS_SESSION_SECRET?.trim();
  if (configured) return configured;
  const accounts = parseStaffAccounts();
  const seed =
    getAdminPasscode() ||
    getAdvisorPasscode() ||
    getViewerPasscode() ||
    accounts[0]?.passcode ||
    '';
  if (!seed) return '';
  return crypto.createHash('sha256').update(`kws-session:${seed}`).digest('hex');
}

export function isStaffAuthConfigured(): boolean {
  return (
    getAdminPasscode().length >= 6 ||
    getAdvisorPasscode().length >= 6 ||
    getViewerPasscode().length >= 6 ||
    parseStaffAccounts().length > 0
  );
}

export function getAuthConfigurationInfo() {
  const accounts = parseStaffAccounts();
  const allowlist = parseAllowlistEmails();
  return {
    authConfigured: isStaffAuthConfigured(),
    accountSignInEnabled: accounts.length > 0,
    allowlistEnabled: allowlist !== null,
  };
}

function timingSafeEqualsHash(a: string, b: string): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function authenticateStaffCredentials(
  candidatePasscode: string,
  candidateEmail = ''
): {
  valid: boolean;
  role?: StaffRole;
  actorLabel?: string;
  email?: string;
} {
  const normalizedEmail = candidateEmail.trim().toLowerCase();
  const allowlist = parseAllowlistEmails();

  if (allowlist && (!normalizedEmail || !allowlist.has(normalizedEmail))) {
    return { valid: false };
  }

  const accounts = parseStaffAccounts();
  if (accounts.length > 0 && normalizedEmail) {
    const matched = accounts.find((acc) => acc.email === normalizedEmail);
    if (!matched) {
      return { valid: false };
    }
    if (!timingSafeEqualsHash(matched.passcode, candidatePasscode)) {
      return { valid: false };
    }
    return {
      valid: true,
      role: matched.role,
      actorLabel: matched.name,
      email: matched.email,
    };
  }

  // Fallback to role passcodes (only when account-email match wasn't required or email omitted)
  if (!normalizedEmail || accounts.length === 0) {
    const adminCode = getAdminPasscode();
    if (adminCode.length >= 6 && timingSafeEqualsHash(adminCode, candidatePasscode)) {
      return {
        valid: true,
        role: 'admin',
        actorLabel: normalizedEmail || 'KWS Admin',
        email: normalizedEmail || undefined,
      };
    }

    const advisorCode = getAdvisorPasscode();
    if (
      advisorCode.length >= 6 &&
      timingSafeEqualsHash(advisorCode, candidatePasscode)
    ) {
      return {
        valid: true,
        role: 'advisor',
        actorLabel: normalizedEmail || 'KWS Advisor',
        email: normalizedEmail || undefined,
      };
    }

    const viewerCode = getViewerPasscode();
    if (
      viewerCode.length >= 6 &&
      timingSafeEqualsHash(viewerCode, candidatePasscode)
    ) {
      return {
        valid: true,
        role: 'viewer',
        actorLabel: normalizedEmail || 'KWS Viewer',
        email: normalizedEmail || undefined,
      };
    }
  }

  return { valid: false };
}

export function authenticateStaffPasscode(candidate: string) {
  return authenticateStaffCredentials(candidate, '');
}

export function verifyStaffPasscode(candidate: string): boolean {
  return authenticateStaffCredentials(candidate, '').valid;
}

export function createSessionToken(
  role: StaffRole = 'admin',
  actorLabel = role === 'admin'
    ? 'KWS Admin'
    : role === 'advisor'
      ? 'KWS Advisor'
      : 'KWS Viewer',
  email?: string
): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('Staff authentication is not configured.');
  }
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({ role, actorLabel, email: email ?? '', exp: expiresAt })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined
): StaffSessionInfo {
  if (!token || !isStaffAuthConfigured()) return { authenticated: false };
  const secret = getSessionSecret();
  if (!secret) return { authenticated: false };

  const parts = token.split('.');
  if (parts.length !== 2) return { authenticated: false };
  const [payload, sig] = parts;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return { authenticated: false };
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { authenticated: false };
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as {
      role?: string;
      actorLabel?: string;
      email?: string;
      exp?: number;
    };

    const validRole: StaffRole | undefined =
      decoded.role === 'admin' ||
      decoded.role === 'advisor' ||
      decoded.role === 'viewer'
        ? decoded.role
        : decoded.role === 'staff'
          ? 'admin'
          : undefined;

    if (
      validRole &&
      typeof decoded.exp === 'number' &&
      decoded.exp > Date.now()
    ) {
      return {
        authenticated: true,
        role: validRole,
        actorLabel: decoded.actorLabel || 'KWS Staff',
        email: decoded.email || undefined,
      };
    }
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}

export function parseCookieHeader(
  cookieHeader: string | undefined
): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    cookies[key] = val;
  }
  return cookies;
}

export function getRequestStaffSession(req: Request): StaffSessionInfo {
  const cookies = parseCookieHeader(req.headers.cookie);
  return verifySessionToken(cookies[COOKIE_NAME]);
}

export function getRequestSessionAuthenticated(req: Request): boolean {
  return getRequestStaffSession(req).authenticated;
}

export function setSessionCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  const flags = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isProd) flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
  );
}

export function requireStaffAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!isStaffAuthConfigured()) {
    res.status(503).json({
      error: 'STAFF_AUTH_NOT_CONFIGURED',
      message:
        'Staff authentication is not configured. Set KWS_ADMIN_PASSCODE or KWS_STAFF_ACCOUNTS in your server environment.',
    });
    return;
  }

  const session = getRequestStaffSession(req);
  if (!session.authenticated) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Valid staff session required.',
    });
    return;
  }

  (req as Request & { staffSession?: StaffSessionInfo }).staffSession = session;
  next();
}

export function requireStaffRole(...allowedRoles: StaffRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireStaffAuth(req, res, () => {
      const session = (req as Request & { staffSession?: StaffSessionInfo })
        .staffSession;
      if (!session?.role || !allowedRoles.includes(session.role)) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Your staff role does not have permission for this action.',
        });
        return;
      }
      next();
    });
  };
}
