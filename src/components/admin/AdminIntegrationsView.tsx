import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import type {
  CrmSyncEventRecord,
  IntegrationStatusItem,
  StaffRole,
  SubmissionRecord,
} from '../../domain/types.ts';
import {
  ApiError,
  fetchIntegrationsStatus,
  syncSubmissionToIntegration,
} from '../../services/api.ts';
import { Button } from '../ui/Button.tsx';
import { Surface } from '../ui/Surface.tsx';

interface AdminIntegrationsViewProps {
  records: SubmissionRecord[];
  staffRole: StaffRole | null;
}

export function AdminIntegrationsView({
  records,
  staffRole,
}: AdminIntegrationsViewProps) {
  const isAdmin = staffRole === 'admin';
  const [integrations, setIntegrations] = useState<IntegrationStatusItem[]>([]);
  const [syncEvents, setSyncEvents] = useState<CrmSyncEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const submittedRecords = records.filter(
    (r) => r.completionStatus === 'submitted'
  );

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchIntegrationsStatus();
      setIntegrations(res.integrations);
      setSyncEvents(res.syncEvents);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'Unable to fetch integration readiness.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!selectedRecordId && submittedRecords.length > 0) {
      setSelectedRecordId(submittedRecords[0].id);
    }
  }, [selectedRecordId, submittedRecords]);

  const handleTriggerSync = async (provider: 'mailchimp' | 'crm_webhook') => {
    if (!isAdmin || !selectedRecordId) return;
    setSyncingProvider(provider);
    setErrorMsg(null);
    setResultMsg(null);
    try {
      const evt = await syncSubmissionToIntegration(provider, selectedRecordId);
      setResultMsg(`${evt.provider} [${evt.status}]: ${evt.detail}`);
      await loadStatus();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'CRM synchronization request failed.'
      );
    } finally {
      setSyncingProvider(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--kws-ink)]">
            CRM &amp; Communication Integration Readiness
          </h1>
          <p className="text-sm text-[var(--kws-muted)]">
            Live environment inspection for Email, Official WhatsApp Business
            API, Mailchimp, and external CRM webhooks. Unconfigured integrations
            never claim active connections.
          </p>
        </div>
        <Button variant="secondary" onClick={loadStatus} disabled={loading}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh Status
        </Button>
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

      {resultMsg && (
        <div className="rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface-subtle)] p-4 text-sm text-[var(--kws-ink)]">
          {resultMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {integrations.map((item) => (
          <Surface key={item.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                  {item.category}
                </p>
                <h2 className="mt-0.5 font-display text-lg font-bold text-[var(--kws-ink)]">
                  {item.name}
                </h2>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 font-mono-tabular text-xs font-semibold ${
                  item.configured
                    ? 'text-[var(--kws-success)]'
                    : 'text-[var(--kws-muted)]'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {item.configured ? `Active (${item.providerName})` : 'Not configured'}
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-[var(--kws-muted)]">
              {item.notes}
            </p>

            <div className="mt-4 space-y-2 border-t border-[var(--kws-border)] pt-3 text-xs">
              <div>
                <p className="font-semibold text-[var(--kws-ink)]">
                  Required Environment Variables
                </p>
                <ul className="mt-1 space-y-0.5 font-mono-tabular text-[var(--kws-muted)]">
                  {item.requiredEnvVars.map((env) => (
                    <li key={env}>· {env}</li>
                  ))}
                </ul>
              </div>
              {item.optionalEnvVars.length > 0 && (
                <div>
                  <p className="font-semibold text-[var(--kws-ink)]">
                    Optional
                  </p>
                  <p className="font-mono-tabular text-[var(--kws-muted)]">
                    {item.optionalEnvVars.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </Surface>
        ))}
      </div>

      {/* CRM Sync Trigger & Log */}
      <Surface className="p-5">
        <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
          CRM &amp; Mailchimp Record Sync Boundary
        </h2>
        <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
          Test or trigger a single-record CRM or Mailchimp sync. Permission
          gating blocks &ldquo;More information&rdquo; and &ldquo;Not at this
          time&rdquo; leads from marketing lists.
        </p>

        {isAdmin && submittedRecords.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              aria-label="Select respondent record for CRM sync"
              value={selectedRecordId}
              onChange={(e) => setSelectedRecordId(e.target.value)}
              className="min-w-[260px] flex-1 rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)]"
            >
              {submittedRecords.map((rec) => (
                <option key={rec.id} value={rec.id}>
                  {rec.answers.contact.fullName || rec.id} ({rec.consultation.preference})
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              loading={syncingProvider === 'crm_webhook'}
              onClick={() => handleTriggerSync('crm_webhook')}
            >
              Sync to CRM Webhook
            </Button>
            <Button
              variant="secondary"
              loading={syncingProvider === 'mailchimp'}
              onClick={() => handleTriggerSync('mailchimp')}
            >
              Sync to Mailchimp
            </Button>
          </div>
        )}

        <div className="mt-5 border-t border-[var(--kws-border)] pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
            Recent CRM Sync Events
          </h3>
          {syncEvents.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--kws-muted)]">
              No CRM sync attempts recorded yet.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--kws-border)] text-[var(--kws-muted)]">
                  <tr>
                    <th className="pb-2 pr-3 font-semibold">Time</th>
                    <th className="pb-2 pr-3 font-semibold">Submission</th>
                    <th className="pb-2 pr-3 font-semibold">Provider</th>
                    <th className="pb-2 pr-3 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--kws-border)]">
                  {syncEvents.map((evt) => (
                    <tr key={evt.id}>
                      <td className="py-2 pr-3 font-mono-tabular text-[var(--kws-muted)]">
                        {evt.createdAt.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="py-2 pr-3 font-mono-tabular text-[var(--kws-ink)]">
                        {evt.submissionId}
                      </td>
                      <td className="py-2 pr-3 font-mono-tabular text-[var(--kws-ink)]">
                        {evt.provider}
                      </td>
                      <td className="py-2 pr-3 font-mono-tabular font-semibold text-[var(--kws-ink)]">
                        {evt.status}
                      </td>
                      <td className="py-2 text-[var(--kws-muted)]">
                        {evt.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}
