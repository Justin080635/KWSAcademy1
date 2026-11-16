import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Eye,
  Mail,
  MessageSquare,
  Send,
} from 'lucide-react';
import type {
  CommunicationDeliveryStatus,
  CommunicationMessageRecord,
  CommunicationTemplateType,
  StaffRole,
  SubmissionRecord,
  WhatsAppRecipientPreview,
} from '../../domain/types.ts';
import {
  ApiError,
  fetchCommunicationMessages,
  previewWhatsAppCampaign,
  sendAdminEmail,
  sendWhatsAppCampaign,
  updateCommunicationStatus,
} from '../../services/api.ts';
import { Button } from '../ui/Button.tsx';
import { Surface } from '../ui/Surface.tsx';

interface AdminCommunicationsViewProps {
  records: SubmissionRecord[];
  staffRole: StaffRole | null;
}

const WHATSAPP_TEMPLATES: Array<{
  value: CommunicationTemplateType;
  label: string;
}> = [
  { value: 'consultation_followup', label: 'Consultation follow-up' },
  { value: 'programme_info', label: 'Requested programme information' },
  { value: 'cohort_reminder', label: 'Cohort reminder (consultation leads)' },
  { value: 'marketing_update', label: 'Promotional / marketing update' },
];

const EMAIL_TEMPLATES: Array<{
  value: CommunicationTemplateType;
  label: string;
}> = [
  { value: 'consultation_followup', label: 'Consultation follow-up' },
  { value: 'programme_info', label: 'Programme overview (Ikeja 10-week)' },
  { value: 'results_delivery', label: 'Discovery summary & priorities' },
  { value: 'submission_confirmation', label: 'Submission confirmation' },
];

export function AdminCommunicationsView({
  records,
  staffRole,
}: AdminCommunicationsViewProps) {
  const canSend = staffRole === 'admin' || staffRole === 'advisor';
  const submittedRecords = useMemo(
    () => records.filter((r) => r.completionStatus === 'submitted'),
    [records]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [channelTab, setChannelTab] = useState<'whatsapp' | 'email'>('whatsapp');

  const [waTemplate, setWaTemplate] =
    useState<CommunicationTemplateType>('consultation_followup');
  const [waCustomMessage, setWaCustomMessage] = useState('');
  const [waPreviews, setWaPreviews] = useState<WhatsAppRecipientPreview[] | null>(
    null
  );
  const [waReviewSummary, setWaReviewSummary] = useState<{
    total: number;
    eligible: number;
    blocked: number;
  } | null>(null);
  const [confirmedReview, setConfirmedReview] = useState(false);

  const [emailTemplate, setEmailTemplate] =
    useState<CommunicationTemplateType>('consultation_followup');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const [messages, setMessages] = useState<CommunicationMessageRecord[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [working, setWorking] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const list = await fetchCommunicationMessages({ limit: 80 });
      setMessages(list);
    } catch {
      // Ignore silent log refresh failure
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Reset confirmation whenever selection or template changes
  useEffect(() => {
    setWaPreviews(null);
    setWaReviewSummary(null);
    setConfirmedReview(false);
  }, [selectedIds, waTemplate, waCustomMessage]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllVisible = () => {
    setSelectedIds(submittedRecords.map((r) => r.id));
  };

  const selectConsultationLeads = () => {
    setSelectedIds(
      submittedRecords
        .filter(
          (r) =>
            r.consultation.preference === 'book' &&
            r.answers.contact.whatsappConsent
        )
        .map((r) => r.id)
    );
  };

  const handlePreviewWhatsApp = async () => {
    if (selectedIds.length === 0) return;
    setWorking(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await previewWhatsAppCampaign({
        submissionIds: selectedIds,
        templateType: waTemplate,
        customMessage: waCustomMessage,
      });
      setWaPreviews(res.previews);
      setWaReviewSummary(res.summary);
      setConfirmedReview(false);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'Failed to generate WhatsApp recipient preview.'
      );
    } finally {
      setWorking(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!confirmedReview || selectedIds.length === 0) return;
    setWorking(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await sendWhatsAppCampaign({
        submissionIds: selectedIds,
        templateType: waTemplate,
        customMessage: waCustomMessage,
        confirmedReview: true,
      });
      setFeedbackMsg(
        `WhatsApp run logged: ${res.sentCount} sent, ${res.blockedCount} blocked by consent/preference, ${res.skippedCount} skipped (no provider), ${res.failedCount} failed.`
      );
      setWaPreviews(null);
      setWaReviewSummary(null);
      setConfirmedReview(false);
      await loadMessages();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'Failed to send WhatsApp campaign.'
      );
    } finally {
      setWorking(false);
    }
  };

  const handleSendEmails = async () => {
    if (selectedIds.length === 0) return;
    setWorking(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const sent = await sendAdminEmail({
        submissionIds: selectedIds,
        messageType: emailTemplate,
        subject: emailSubject.trim() || undefined,
        bodyText: emailBody.trim() || undefined,
      });
      setFeedbackMsg(
        `Email workflow executed for ${sent.length} respondent(s). See message log below for exact provider status.`
      );
      await loadMessages();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'Failed to execute email workflow.'
      );
    } finally {
      setWorking(false);
    }
  };

  const handleStatusUpdate = async (
    messageId: string,
    status: CommunicationDeliveryStatus
  ) => {
    try {
      const updated = await updateCommunicationStatus(messageId, status);
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError ? err.message : 'Unable to update message status.'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--kws-ink)]">
          Communications &amp; Outreach Workflows
        </h1>
        <p className="text-sm text-[var(--kws-muted)]">
          Permission-gated Email and official WhatsApp Business API workflows.
          WhatsApp campaigns require recipient and message review before dispatch.
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-[var(--kws-danger)]/40 bg-[var(--kws-danger-surface)] p-4 text-sm text-[var(--kws-danger)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {feedbackMsg && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface-subtle)] p-4 text-sm text-[var(--kws-ink)]">
          <Check
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kws-success)]"
            aria-hidden="true"
          />
          <span>{feedbackMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recipient Selector */}
        <Surface className="min-w-0 p-5 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--kws-border)] pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--kws-ink)]">
                1. Select Respondents
              </h2>
              <p className="font-mono-tabular text-xs text-[var(--kws-muted)]">
                {selectedIds.length} selected of {submittedRecords.length} loaded
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="secondary"
                size="md"
                onClick={selectConsultationLeads}
              >
                Consented Book Leads
              </Button>
              <Button variant="ghost" size="md" onClick={selectAllVisible}>
                All
              </Button>
              {selectedIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {submittedRecords.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--kws-muted)]">
              No completed respondent records match the active directory view.
            </p>
          ) : (
            <div className="mt-3 max-h-[380px] divide-y divide-[var(--kws-border)] overflow-y-auto pr-1">
              {submittedRecords.map((rec) => {
                const checked = selectedIds.includes(rec.id);
                const pref = rec.consultation.preference;
                return (
                  <label
                    key={rec.id}
                    className="flex cursor-pointer items-start gap-3 py-2.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelection(rec.id)}
                      className="mt-1 h-4 w-4 rounded border-[var(--kws-border-strong)] accent-[var(--kws-accent)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[var(--kws-ink)]">
                        {rec.answers.contact.fullName || 'Unnamed'}
                      </p>
                      <p className="font-mono-tabular text-xs text-[var(--kws-muted)]">
                        {rec.answers.contact.whatsappNumber || 'No WhatsApp'} ·{' '}
                        {rec.answers.contact.email || 'No email'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--kws-muted)]">
                        Pref: <strong className="text-[var(--kws-ink)]">{pref}</strong>{' '}
                        · WA consent:{' '}
                        {rec.answers.contact.whatsappConsent ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </Surface>

        {/* Compose & Mandatory Review */}
        <Surface className="min-w-0 p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--kws-border)] pb-3">
            <h2 className="font-display text-base font-bold text-[var(--kws-ink)]">
              2. Compose &amp; Review
            </h2>
            <div className="flex rounded-lg bg-[var(--kws-bg)] p-1 text-xs">
              <button
                type="button"
                onClick={() => setChannelTab('whatsapp')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold cursor-pointer whitespace-nowrap ${
                  channelTab === 'whatsapp'
                    ? 'bg-[var(--kws-surface)] text-[var(--kws-ink)] shadow-xs'
                    : 'text-[var(--kws-muted)] hover:text-[var(--kws-ink)]'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                WhatsApp API
              </button>
              <button
                type="button"
                onClick={() => setChannelTab('email')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold cursor-pointer whitespace-nowrap ${
                  channelTab === 'email'
                    ? 'bg-[var(--kws-surface)] text-[var(--kws-ink)] shadow-xs'
                    : 'text-[var(--kws-muted)] hover:text-[var(--kws-ink)]'
                }`}
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Email Workflow
              </button>
            </div>
          </div>

          {!canSend ? (
            <p className="mt-4 text-sm text-[var(--kws-muted)]">
              Read-only viewer accounts cannot dispatch Email or WhatsApp
              messages. Sign in as Admin or Advisor.
            </p>
          ) : channelTab === 'whatsapp' ? (
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="wa-template"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]"
                >
                  WhatsApp Message Purpose / Template
                </label>
                <select
                  id="wa-template"
                  value={waTemplate}
                  onChange={(e) =>
                    setWaTemplate(e.target.value as CommunicationTemplateType)
                  }
                  className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)]"
                >
                  {WHATSAPP_TEMPLATES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--kws-muted)]">
                  Permission check: &ldquo;More information&rdquo; allows
                  requested programme info only; &ldquo;Not at this time&rdquo;
                  is blocked from all WhatsApp outreach.
                </p>
              </div>

              <div>
                <label
                  htmlFor="wa-custom"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]"
                >
                  Optional Custom Message (supports {'{{name}}'}, {'{{stage}}'},{' '}
                  {'{{city}}'})
                </label>
                <textarea
                  id="wa-custom"
                  rows={3}
                  value={waCustomMessage}
                  onChange={(e) => setWaCustomMessage(e.target.value)}
                  placeholder="Leave blank to use approved KWS Academy template..."
                  className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  disabled={selectedIds.length === 0 || working}
                  loading={working && !waPreviews}
                  onClick={handlePreviewWhatsApp}
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Preview Recipients &amp; Resolved Messages
                </Button>
              </div>

              {waPreviews && waReviewSummary && (
                <div className="space-y-3 rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface-subtle)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[var(--kws-ink)]">
                      Mandatory Pre-Send Review
                    </span>
                    <span className="font-mono-tabular text-[var(--kws-muted)]">
                      {waReviewSummary.eligible} eligible ·{' '}
                      {waReviewSummary.blocked} blocked
                    </span>
                  </div>

                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {waPreviews.map((p) => (
                      <div
                        key={p.submissionId}
                        className="rounded-md border border-[var(--kws-border)] bg-[var(--kws-surface)] p-2.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[var(--kws-ink)]">
                            {p.fullName} ({p.whatsappNumber || 'No number'})
                          </span>
                          <span
                            className={`font-mono-tabular font-semibold ${
                              p.eligible
                                ? 'text-[var(--kws-success)]'
                                : 'text-[var(--kws-danger)]'
                            }`}
                          >
                            {p.eligibilityLabel}
                          </span>
                        </div>
                        {p.blockedReason ? (
                          <p className="mt-1 text-[var(--kws-danger)]">
                            {p.blockedReason}
                          </p>
                        ) : (
                          <p className="mt-1 text-[var(--kws-muted)]">
                            {p.resolvedMessage}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-xs text-[var(--kws-ink)]">
                    <input
                      type="checkbox"
                      checked={confirmedReview}
                      onChange={(e) => setConfirmedReview(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[var(--kws-border-strong)] accent-[var(--kws-accent)]"
                    />
                    <span>
                      I have reviewed the eligible and blocked recipients and
                      verified every resolved WhatsApp message above.
                    </span>
                  </label>

                  <Button
                    variant="primary"
                    disabled={
                      !confirmedReview || waReviewSummary.eligible === 0 || working
                    }
                    loading={working}
                    onClick={handleSendWhatsApp}
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Confirm &amp; Send via Official WhatsApp API
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="email-template"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]"
                >
                  Email Workflow Type
                </label>
                <select
                  id="email-template"
                  value={emailTemplate}
                  onChange={(e) =>
                    setEmailTemplate(e.target.value as CommunicationTemplateType)
                  }
                  className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)]"
                >
                  {EMAIL_TEMPLATES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="email-subject"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]"
                >
                  Optional Subject Override
                </label>
                <input
                  id="email-subject"
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Leave blank for default KWS Academy subject"
                  className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)]"
                />
              </div>

              <div>
                <label
                  htmlFor="email-body"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]"
                >
                  Optional Body Override
                </label>
                <textarea
                  id="email-body"
                  rows={4}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Leave blank to send default structured copy..."
                  className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)]"
                />
              </div>

              <Button
                variant="primary"
                disabled={selectedIds.length === 0 || working}
                loading={working}
                onClick={handleSendEmails}
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Send Email to {selectedIds.length} Selected
              </Button>
            </div>
          )}
        </Surface>
      </div>

      {/* Delivery & Response Log */}
      <Surface className="p-5">
        <div className="flex items-center justify-between border-b border-[var(--kws-border)] pb-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
              Communication &amp; Delivery Log
            </h2>
            <p className="text-xs text-[var(--kws-muted)]">
              Audit log of email and WhatsApp sends, provider responses,
              permission blocks, and follow-up outcomes.
            </p>
          </div>
          <Button variant="ghost" size="md" onClick={loadMessages}>
            Refresh
          </Button>
        </div>

        {loadingLogs ? (
          <p className="mt-4 text-sm text-[var(--kws-muted)]">
            Loading communication logs...
          </p>
        ) : messages.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--kws-muted)]">
            No outbound Email or WhatsApp workflow events recorded yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--kws-border)] text-[var(--kws-muted)]">
                <tr>
                  <th className="pb-2 pr-3 font-semibold">Timestamp</th>
                  <th className="pb-2 pr-3 font-semibold">Channel</th>
                  <th className="pb-2 pr-3 font-semibold">Type</th>
                  <th className="pb-2 pr-3 font-semibold">Recipient</th>
                  <th className="pb-2 pr-3 font-semibold">Provider</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold">Detail</th>
                  {canSend && (
                    <th className="pb-2 text-right font-semibold">
                      Update Delivery
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--kws-border)]">
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 pr-3 font-mono-tabular text-[var(--kws-muted)] whitespace-nowrap">
                      {m.createdAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-[var(--kws-ink)] uppercase">
                      {m.channel}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--kws-ink)]">
                      {m.messageType}
                    </td>
                    <td className="py-2.5 pr-3 font-mono-tabular text-[var(--kws-ink)]">
                      {m.recipient || '—'}
                    </td>
                    <td className="py-2.5 pr-3 font-mono-tabular text-[var(--kws-muted)]">
                      {m.provider}
                    </td>
                    <td className="py-2.5 pr-3 font-mono-tabular font-semibold text-[var(--kws-ink)]">
                      {m.status}
                    </td>
                    <td className="max-w-xs py-2.5 pr-3 text-[var(--kws-muted)]">
                      {m.errorDetail || m.bodyPreview}
                    </td>
                    {canSend && (
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <select
                          aria-label={`Update status for ${m.id}`}
                          value={m.status}
                          onChange={(e) =>
                            handleStatusUpdate(
                              m.id,
                              e.target.value as CommunicationDeliveryStatus
                            )
                          }
                          className="rounded border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2 py-1 text-xs text-[var(--kws-ink)]"
                        >
                          <option value={m.status}>{m.status}</option>
                          <option value="sent">sent</option>
                          <option value="delivered">delivered</option>
                          <option value="read">read</option>
                          <option value="replied">replied</option>
                          <option value="failed">failed</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}
