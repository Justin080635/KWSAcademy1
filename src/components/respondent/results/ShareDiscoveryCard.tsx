import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Check,
  Copy,
  Download,
  Link2,
  MessageSquare,
  Printer,
  RotateCcw,
  Share2,
} from 'lucide-react';
import type { ShareCardPayload } from '../../../domain/reportDiscovery.ts';
import type { StyleId } from '../../../domain/types.ts';
import { Button } from '../../ui/Button.tsx';
import { CircularProgressRing } from '../../ui/CircularProgressRing.tsx';
import { KWS_DURATIONS, KWS_EASE } from '../../ui/motionPrimitives.tsx';
import { StyleEmblem } from './StyleEmblem.tsx';

interface ShareDiscoveryCardProps {
  payload: ShareCardPayload;
  leadStyleId: StyleId | 'BROAD';
  plainTextSummary: string;
  privateReportUrl: string | null;
  onStartNew: () => void;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCanvasRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  ratio: number,
  label: string,
  valueText: string,
  color: string
) {
  ctx.save();
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  if (ratio > 0) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      r,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, ratio))
    );
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 28px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(valueText, cx, cy);

  ctx.fillStyle = '#f0dce8';
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(label, cx, cy + r + 28);
  ctx.restore();
}

export async function renderShareCardToBlob(
  payload: ShareCardPayload
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;

  const width = 1080;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Deep KWS burgundy gradient backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#29212a');
  bgGrad.addColorStop(0.5, '#481436');
  bgGrad.addColorStop(1, '#5f1b47');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Ambient orbital glow rings
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(880, 190, 260, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(160, 1180, 320, 0, Math.PI * 2);
  ctx.stroke();

  const glow = ctx.createRadialGradient(840, 210, 10, 840, 210, 380);
  glow.addColorStop(0, 'rgba(198, 164, 106, 0.24)');
  glow.addColorStop(1, 'rgba(198, 164, 106, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Header
  ctx.fillStyle = '#e8ce9c';
  ctx.font = '700 24px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('KWS ACADEMY · PROFESSIONAL DISCOVERY', 84, 118);

  ctx.fillStyle = '#f0dce8';
  ctx.font = '500 28px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    payload.displayName
      ? `${payload.title} · ${payload.displayName}`
      : payload.title,
    84,
    170
  );

  // Leading style hero typography
  ctx.fillStyle = '#e8d5e0';
  ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(payload.styleSublabel.toUpperCase(), 84, 286);

  ctx.fillStyle = '#ffffff';
  const headlineSize = payload.styleHeadline.length > 22 ? 64 : 84;
  ctx.font = `800 ${headlineSize}px "Bricolage Grotesque", system-ui, sans-serif`;
  const headlineLines = wrapCanvasText(ctx, payload.styleHeadline, 912);
  let cursorY = 374;
  for (const line of headlineLines.slice(0, 2)) {
    ctx.fillText(line, 84, cursorY);
    cursorY += headlineSize + 10;
  }

  // Personalised statement
  ctx.fillStyle = '#f7f1f4';
  ctx.font = '500 32px "Plus Jakarta Sans", system-ui, sans-serif';
  const stmtLines = wrapCanvasText(ctx, payload.personalStatement, 912);
  let stmtY = cursorY + 26;
  for (const line of stmtLines.slice(0, 3)) {
    ctx.fillText(line, 84, stmtY);
    stmtY += 44;
  }

  // Stage card band
  const stageBoxY = 640;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 84, stageBoxY, 912, 168, 28);
  ctx.fill();
  ctx.stroke();

  drawCanvasRing(
    ctx,
    176,
    stageBoxY + 84,
    46,
    payload.stageNumber / 5,
    '',
    `${payload.stageNumber}/5`,
    '#c6a46a'
  );

  ctx.fillStyle = '#e8ce9c';
  ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('CURRENT GROWTH STAGE', 258, stageBoxY + 62);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 40px "Bricolage Grotesque", system-ui, sans-serif';
  ctx.fillText(payload.stageName, 258, stageBoxY + 114);

  // Capability insight panel
  const capBoxY = 844;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  drawRoundedRect(ctx, 84, capBoxY, 912, 326, 28);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e8d5e0';
  ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('HIGHLIGHTED CAPABILITY', 124, capBoxY + 58);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 32px "Bricolage Grotesque", system-ui, sans-serif';
  ctx.fillText(payload.capabilityTitle, 124, capBoxY + 104);

  ctx.fillStyle = '#f7f1f4';
  ctx.font = '400 25px "Plus Jakarta Sans", system-ui, sans-serif';
  const insightLines = wrapCanvasText(ctx, payload.capabilityInsight, 560);
  let insY = capBoxY + 154;
  for (const line of insightLines.slice(0, 3)) {
    ctx.fillText(line, 124, insY);
    insY += 36;
  }

  drawCanvasRing(
    ctx,
    776,
    capBoxY + 156,
    44,
    payload.understandingScore / 1,
    'Know',
    `${payload.understandingScore}/1`,
    '#df9ec7'
  );
  drawCanvasRing(
    ctx,
    906,
    capBoxY + 156,
    44,
    payload.experienceScore / 4,
    'Done',
    `${payload.experienceScore}/4`,
    '#c6a46a'
  );

  // Clean Footer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = '500 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('KWS Academy · Discover how you think and grow', 84, 1270);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export function ShareDiscoveryCard({
  payload,
  leadStyleId,
  plainTextSummary,
  privateReportUrl,
  onStartNew,
}: ShareDiscoveryCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleDownloadCard = async () => {
    setDownloading(true);
    setStatusMessage(null);
    try {
      const blob = await renderShareCardToBlob(payload);
      if (!blob) {
        setStatusMessage('Image export is not supported in this browser.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const slug = payload.styleHeadline
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      anchor.href = url;
      anchor.download = `kws-discovery-${slug || 'card'}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatusMessage('Discovery card saved as a PNG image.');
    } catch {
      setStatusMessage('Could not create the PNG image just now.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(plainTextSummary);
      setCopiedSummary(true);
      setStatusMessage('Summary copied (private details excluded).');
      window.setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      setStatusMessage('Please copy the summary text directly below.');
    }
  };

  const handleCopyPrivateLink = async () => {
    if (!privateReportUrl) return;
    try {
      await navigator.clipboard.writeText(privateReportUrl);
      setCopiedLink(true);
      setStatusMessage('Private link copied so you can revisit anytime.');
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setStatusMessage('Could not copy link in this browser.');
    }
  };

  const handleNativeShare = async () => {
    setStatusMessage(null);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const blob = await renderShareCardToBlob(payload);
        if (
          blob &&
          typeof File === 'function' &&
          typeof navigator.canShare === 'function'
        ) {
          const file = new File([blob], 'kws-discovery-card.png', {
            type: 'image/png',
          });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: payload.title,
              text: `${payload.styleHeadline} · ${payload.stageLabel}`,
              files: [file],
            });
            return;
          }
        }
        await navigator.share({
          title: payload.title,
          text: plainTextSummary,
        });
        return;
      } catch {
        // Fallback smoothly to clipboard below if share dismissed or rejected
      }
    }
    await handleCopySummary();
  };

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
      {/* Left: Social-ready Portrait Discovery Card Preview */}
      <div className="lg:col-span-6">
        <div
          className="relative overflow-hidden rounded-[26px] p-6 text-white shadow-xl transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-2xl sm:p-8"
          style={{ backgroundImage: 'var(--kws-gradient-band)' }}
          aria-label="Shareable discovery card preview"
        >
          <div
            className={`pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-30 ${
              prefersReducedMotion ? '' : 'kws-ambient-breathe'
            }`}
            style={{
              background:
                'radial-gradient(circle, rgba(198,164,106,0.38) 0%, transparent 70%)',
            }}
            aria-hidden="true"
          />
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute right-8 bottom-8 h-3 w-3 rounded-full border border-white/25 ${
              prefersReducedMotion ? '' : 'kws-float-slow'
            }`}
          />

          <div className="relative z-10 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.12em] text-[var(--kws-gold-bright)]">
                  KWS ACADEMY
                </p>
                <p className="mt-0.5 text-sm font-medium text-white/85">
                  {payload.displayName
                    ? `${payload.title} · ${payload.displayName}`
                    : payload.title}
                </p>
              </div>
              <StyleEmblem styleId={leadStyleId} size="md" tone="onDark" />
            </div>

            <div className="border-t border-white/15 pt-5">
              <p className="text-xs font-semibold text-[var(--kws-on-dark-muted)]">
                {payload.styleSublabel}
              </p>
              <h3 className="mt-1 font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">
                {payload.styleHeadline}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-white/85">
                {payload.personalStatement}
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-[18px] border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <CircularProgressRing
                viewportReveal
                surface="onDark"
                metric={{
                  id: 'share_card_stage',
                  label: payload.stageName,
                  value: payload.stageNumber,
                  max: 5,
                  displayValue: `${payload.stageNumber}/5`,
                  sublabel: '',
                  tone: 'gold',
                }}
                size="sm"
                showLabel={false}
              />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[var(--kws-gold-bright)]">
                  Growth journey
                </p>
                <p className="font-display text-lg font-bold text-white">
                  {payload.stageLabel}
                </p>
              </div>
            </div>

            <div className="rounded-[18px] border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-[var(--kws-on-dark-muted)]">
                    Highlighted strength
                  </p>
                  <p className="mt-0.5 font-display text-base font-bold text-white">
                    {payload.capabilityTitle}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-white/85">
                    {payload.capabilityInsight}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <div className="text-center">
                    <CircularProgressRing
                      viewportReveal
                      surface="onDark"
                      metric={{
                        id: 'share_card_u',
                        label: 'Know',
                        value: payload.understandingScore,
                        max: 1,
                        displayValue: `${payload.understandingScore}/1`,
                        sublabel: '',
                        tone: 'accent',
                      }}
                      size="sm"
                      showLabel={false}
                    />
                    <span className="mt-1 block text-[10px] font-medium text-white/75">
                      Know
                    </span>
                  </div>
                  <div className="text-center">
                    <CircularProgressRing
                      viewportReveal
                      surface="onDark"
                      metric={{
                        id: 'share_card_e',
                        label: 'Done',
                        value: payload.experienceScore,
                        max: 4,
                        displayValue: `${payload.experienceScore}/4`,
                        sublabel: '',
                        tone: 'gold',
                      }}
                      size="sm"
                      showLabel={false}
                    />
                    <span className="mt-1 block text-[10px] font-medium text-white/75">
                      Done
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-white/65">
              <span>Discover how you think & grow</span>
              <span className="tabular-nums">Ref {payload.referenceId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Download & Share Controls */}
      <div className="space-y-5 lg:col-span-6">
        <div>
          <h3 className="font-display text-2xl font-bold text-[var(--kws-ink)]">
            Keep it or share your discovery
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--kws-muted)]">
            Your share card highlights only your style, stage, and key strength
            insight. Your email, WhatsApp number, and personal responses stay
            completely private.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            variant="primary"
            size="lg"
            loading={downloading}
            onClick={handleDownloadCard}
            className="w-full"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download card (PNG)
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={handleNativeShare}
            className="w-full"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share card
          </Button>
          <Button
            variant="secondary"
            onClick={handleCopySummary}
            className="w-full"
          >
            {copiedSummary ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copiedSummary ? 'Summary copied' : 'Copy text summary'}
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(plainTextSummary)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--kws-ink)] hover:-translate-y-0.5 hover:border-[var(--kws-accent)] hover:bg-[var(--kws-surface-subtle)] transition-all duration-200 whitespace-nowrap shrink-0"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Send on WhatsApp
          </a>
        </div>

        <AnimatePresence mode="wait">
          {statusMessage && (
            <motion.p
              key={statusMessage}
              role="status"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -2 }}
              transition={{ duration: KWS_DURATIONS.fast, ease: KWS_EASE }}
              className="text-xs font-semibold text-[var(--kws-accent)]"
            >
              {statusMessage}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--kws-border)] pt-5 print:hidden">
          {privateReportUrl && (
            <Button variant="ghost" size="sm" onClick={handleCopyPrivateLink}>
              {copiedLink ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Link2 className="h-4 w-4" aria-hidden="true" />
              )}
              {copiedLink ? 'Private link copied' : 'Copy private report link'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print / Save PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={onStartNew}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Start a fresh discovery
          </Button>
        </div>

        <details className="rounded-[18px] border border-[var(--kws-border)] bg-[var(--kws-surface)] p-4">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--kws-muted)] hover:text-[var(--kws-ink)]">
            View plain-text share summary
          </summary>
          <textarea
            readOnly
            aria-label="Plain text discovery summary"
            rows={6}
            value={plainTextSummary}
            className="mt-3 w-full rounded-[12px] border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-3 text-xs leading-relaxed text-[var(--kws-muted)]"
          />
        </details>
      </div>
    </div>
  );
}
