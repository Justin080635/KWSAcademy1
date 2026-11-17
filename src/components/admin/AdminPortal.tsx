import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Check,
  Download,
  FileSpreadsheet,
  Filter,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plug,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import {
  ASSESSMENT_QUESTIONS,
  CAPABILITY_CARDS,
  QUESTION_MAP,
} from '../../domain/assessmentContent.ts';
import type {
  AdminAnalyticsSummary,
  AdminSubmissionFilters,
  ConsultationStatus,
  HumanReviewCategory,
  StaffRole,
  StorageBoundaryStatus,
  SubmissionRecord,
} from '../../domain/types.ts';
import {
  ApiError,
  buildAdminExportUrl,
  createDatabaseBackup,
  fetchAdminAnalytics,
  fetchAdminStatus,
  fetchAdminSubmissionDetail,
  fetchAdminSubmissions,
  logoutAdmin,
  saveCampaignCost,
  sendAdminEmail,
  updateConsultationRecord,
} from '../../services/api.ts';
import type { AppRoute } from '../../state/useAssessmentSession.ts';
import { Button } from '../ui/Button.tsx';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import { Surface } from '../ui/Surface.tsx';
import { AdminCommunicationsView } from './AdminCommunicationsView.tsx';
import { AdminIntegrationsView } from './AdminIntegrationsView.tsx';
import { AdminLoginView } from './AdminLoginView.tsx';
import { AdminVersionsView } from './AdminVersionsView.tsx';

interface AdminPortalProps {
  route: Extract<AppRoute, { area: 'admin' }>;
  onNavigate: (route: AppRoute) => void;
}

const CONSULTATION_STATUS_OPTIONS: Array<{
  value: ConsultationStatus;
  label: string;
}> = [
  { value: 'requested', label: 'Requested' },
  { value: 'awaiting_review', label: 'Awaiting review' },
  { value: 'approved_for_contact', label: 'Approved for contact' },
  { value: 'contact_attempted', label: 'Contact attempted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_response', label: 'No response' },
  { value: 'declined', label: 'Declined' },
  { value: 'closed', label: 'Closed' },
];

const HUMAN_REVIEW_CATEGORY_OPTIONS: Array<{
  value: HumanReviewCategory;
  label: string;
}> = [
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'priority_consultation', label: 'Priority consultation' },
  { value: 'potential_consultation', label: 'Potential consultation' },
  { value: 'future_opportunity', label: 'Future opportunity' },
  { value: 'market_insight', label: 'Market insight' },
];

const STATUS_LABEL_MAP: Record<ConsultationStatus, string> = Object.fromEntries(
  CONSULTATION_STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<ConsultationStatus, string>;

const REVIEW_CATEGORY_LABEL_MAP: Record<HumanReviewCategory, string> =
  Object.fromEntries(
    HUMAN_REVIEW_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
  ) as Record<HumanReviewCategory, string>;

const EMPTY_FILTERS: AdminSubmissionFilters = {
  q: '',
  dateFrom: '',
  dateTo: '',
  source: '',
  audience: 'all',
  location: '',
  urgency: 'all',
  financialReadiness: 'all',
  januaryCohort: 'all',
  consultationStatus: 'all',
  reviewCategory: 'all',
  includeDrafts: false,
};

function countActiveFilters(filters: AdminSubmissionFilters): number {
  let count = 0;
  if (filters.q?.trim()) count += 1;
  if (filters.dateFrom?.trim()) count += 1;
  if (filters.dateTo?.trim()) count += 1;
  if (filters.source?.trim()) count += 1;
  if (filters.audience && filters.audience !== 'all') count += 1;
  if (filters.location?.trim()) count += 1;
  if (filters.urgency && filters.urgency !== 'all') count += 1;
  if (filters.financialReadiness && filters.financialReadiness !== 'all') count += 1;
  if (filters.januaryCohort && filters.januaryCohort !== 'all') count += 1;
  if (filters.consultationStatus && filters.consultationStatus !== 'all') {
    count += 1;
  }
  if (filters.reviewCategory && filters.reviewCategory !== 'all') count += 1;
  if (filters.includeDrafts) count += 1;
  return count;
}

function getOptionDisplay(
  record: SubmissionRecord,
  questionId: string
): { optionId: string; label: string; extra: string } {
  const optionId = record.answers.selections[questionId] ?? '';
  if (!optionId) {
    return { optionId: '', label: 'Not answered', extra: '' };
  }
  const question = QUESTION_MAP[questionId];
  const label =
    question?.options.find((o) => o.id === optionId)?.label ?? optionId;
  const extra = record.answers.otherText[questionId]?.trim() ?? '';
  return { optionId, label, extra };
}

export function AdminPortal({ route, onNavigate }: AdminPortalProps) {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [accountSignInEnabled, setAccountSignInEnabled] = useState(false);
  const [allowlistEnabled, setAllowlistEnabled] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [actorLabel, setActorLabel] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] =
    useState<StorageBoundaryStatus | null>(null);

  const [filters, setFilters] = useState<AdminSubmissionFilters>(EMPTY_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [records, setRecords] = useState<SubmissionRecord[]>([]);
  const [totalStoredCount, setTotalStoredCount] = useState(0);
  const [analytics, setAnalytics] = useState<AdminAnalyticsSummary | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [selectedRecord, setSelectedRecord] =
    useState<SubmissionRecord | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [responsePartTab, setResponsePartTab] = useState<
    'all' | 'A' | 'B' | 'C' | 'D'
  >('all');

  const [editStatus, setEditStatus] =
    useState<ConsultationStatus>('awaiting_review');
  const [editReviewCategory, setEditReviewCategory] =
    useState<HumanReviewCategory>('unreviewed');
  const [editAssignedStaff, setEditAssignedStaff] = useState('');
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingConsultation, setSavingConsultation] = useState(false);
  const [consultationSavedMsg, setConsultationSavedMsg] = useState<
    string | null
  >(null);
  const [backupStatusMsg, setBackupStatusMsg] = useState<string | null>(null);
  const [creatingBackup, setCreatingBackup] = useState(false);

  const [costUtmSource, setCostUtmSource] = useState('');
  const [costUtmCampaign, setCostUtmCampaign] = useState('');
  const [costCurrency, setCostCurrency] = useState('NGN');
  const [costAmount, setCostAmount] = useState('');
  const [savingCost, setSavingCost] = useState(false);
  const [costSavedMsg, setCostSavedMsg] = useState<string | null>(null);
  const [profileEmailMsg, setProfileEmailMsg] = useState<string | null>(null);

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters),
    [filters]
  );

  const loadStatus = useCallback(async () => {
    setCheckingAuth(true);
    try {
      const status = await fetchAdminStatus();
      setAuthConfigured(status.authConfigured);
      setAccountSignInEnabled(status.accountSignInEnabled);
      setAllowlistEnabled(status.allowlistEnabled);
      setAuthenticated(status.authenticated);
      setStaffRole(status.role);
      setActorLabel(status.actorLabel);
      setStorageStatus(status.storage);
    } catch {
      setAuthConfigured(false);
      setAccountSignInEnabled(false);
      setAllowlistEnabled(false);
      setAuthenticated(false);
      setStaffRole(null);
      setActorLabel(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const loadAdminWorkspace = useCallback(async () => {
    if (!authenticated) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const [subsRes, analyticsRes] = await Promise.all([
        fetchAdminSubmissions(filters),
        fetchAdminAnalytics(filters),
      ]);
      setRecords(subsRes.records);
      setTotalStoredCount(subsRes.totalCount);
      setAnalytics(analyticsRes);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthenticated(false);
      } else {
        setDataError(
          err instanceof ApiError
            ? err.message
            : 'Unable to load administrative records.'
        );
      }
    } finally {
      setLoadingData(false);
    }
  }, [authenticated, filters]);

  useEffect(() => {
    loadAdminWorkspace();
  }, [loadAdminWorkspace]);

  useEffect(() => {
    if (!authenticated || route.view !== 'profile') {
      setSelectedRecord(null);
      return;
    }
    let active = true;
    setLoadingProfile(true);
    setConsultationSavedMsg(null);

    fetchAdminSubmissionDetail(route.submissionId)
      .then((rec) => {
        if (!active) return;
        setSelectedRecord(rec);
        setEditStatus(rec.consultation.status);
        setEditReviewCategory(rec.consultation.reviewCategory);
        setEditAssignedStaff(rec.consultation.assignedStaffMember);
        setEditScheduledAt(rec.consultation.scheduledAt ?? '');
        setEditNotes(rec.consultation.outcomeNotes);
      })
      .catch(() => {
        if (active) setSelectedRecord(null);
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, [authenticated, route]);

  const handleLogout = async () => {
    await logoutAdmin().catch(() => undefined);
    setAuthenticated(false);
    setStaffRole(null);
    setActorLabel(null);
    setRecords([]);
    setAnalytics(null);
  };

  const handleSaveConsultation = async (incrementAttempt = false) => {
    if (!selectedRecord || staffRole === 'viewer') return;
    setSavingConsultation(true);
    setConsultationSavedMsg(null);
    try {
      const updated = await updateConsultationRecord(selectedRecord.id, {
        consultationStatus: editStatus,
        reviewCategory: editReviewCategory,
        staffNotes: editNotes,
        assignedStaffMember: editAssignedStaff,
        scheduledAt: editScheduledAt.trim() || null,
        incrementAttempt,
      });
      setSelectedRecord(updated);
      setConsultationSavedMsg(
        incrementAttempt
          ? 'Contact attempt logged and follow-up record saved.'
          : 'Human review & follow-up record updated.'
      );
      loadAdminWorkspace();
    } catch (err) {
      setDataError(
        err instanceof ApiError
          ? err.message
          : 'Failed to update consultation status.'
      );
    } finally {
      setSavingConsultation(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setBackupStatusMsg(null);
    try {
      const info = await createDatabaseBackup();
      setBackupStatusMsg(
        `Snapshot created: ${info.filename} (${Math.round(info.sizeBytes / 1024)} KB)`
      );
    } catch (err) {
      setDataError(
        err instanceof ApiError
          ? err.message
          : 'Unable to create database backup snapshot.'
      );
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleSaveCampaignCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditConsultations) return;
    const numeric = Number(costAmount);
    if (!Number.isFinite(numeric) || numeric < 0) {
      setDataError('Please enter a valid non-negative campaign spend amount.');
      return;
    }
    setSavingCost(true);
    setCostSavedMsg(null);
    setDataError(null);
    try {
      const saved = await saveCampaignCost({
        utmSource: costUtmSource.trim() || 'unknown/direct',
        utmCampaign: costUtmCampaign.trim() || 'unknown/direct',
        currency: costCurrency.trim() || 'NGN',
        amountSpent: numeric,
      });
      setCostSavedMsg(
        `Saved ${saved.currency} ${saved.amountSpent.toLocaleString()} for ${saved.utmSource} / ${saved.utmCampaign}.`
      );
      setCostAmount('');
      await loadAdminWorkspace();
    } catch (err) {
      setDataError(
        err instanceof ApiError ? err.message : 'Unable to save campaign cost.'
      );
    } finally {
      setSavingCost(false);
    }
  };

  const updateFilter = <K extends keyof AdminSubmissionFilters>(
    key: K,
    value: AdminSubmissionFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (checkingAuth) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
        <Surface className="p-8 text-sm text-[var(--kws-muted)]">
          Checking staff session...
        </Surface>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AdminLoginView
        authConfigured={authConfigured}
        accountSignInEnabled={accountSignInEnabled}
        allowlistEnabled={allowlistEnabled}
        onAuthenticated={() => {
          loadStatus();
        }}
        onReturnToAssessment={() =>
          onNavigate({ area: 'respondent', view: 'welcome' })
        }
      />
    );
  }

  const canEditConsultations =
    staffRole === 'admin' || staffRole === 'advisor';
  const canExportData = staffRole === 'admin';

  const navItems: Array<{
    view:
      | 'overview'
      | 'records'
      | 'analytics'
      | 'communications'
      | 'versions'
      | 'integrations'
      | 'exports';
    label: string;
    icon: typeof LayoutDashboard;
  }> = [
    { view: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { view: 'records', label: 'Respondent Directory', icon: Users },
    { view: 'analytics', label: 'Cohort Analytics', icon: BarChart3 },
    { view: 'communications', label: 'Communications', icon: MessageSquare },
    { view: 'versions', label: 'Question Versions', icon: GitBranch },
    { view: 'integrations', label: 'Integrations', icon: Plug },
    { view: 'exports', label: 'Exports & Backups', icon: Download },
  ];

  const activeSection = route.view === 'profile' ? 'records' : route.view;

  const partAQuestions = ASSESSMENT_QUESTIONS.filter(
    (q) => q.sectionId === 'professional_style'
  );
  const partBQuestions = ASSESSMENT_QUESTIONS.filter(
    (q) => q.sectionId === 'growth_journey'
  );
  const partDQuestions = ASSESSMENT_QUESTIONS.filter(
    (q) => q.sectionId === 'profile_next_steps' && q.kind !== 'contact_details'
  );

  const renderSharedFilterBar = () => (
    <Surface className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--kws-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search respondents"
            value={filters.q ?? ''}
            onChange={(e) => updateFilter('q', e.target.value)}
            placeholder="Search name, email, WhatsApp, city, style, or assigned staff..."
            className="w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] py-2 pl-9 pr-3 text-sm text-[var(--kws-ink)]"
          />
        </div>

        <select
          aria-label="Filter by follow-up status"
          value={filters.consultationStatus ?? 'all'}
          onChange={(e) => updateFilter('consultationStatus', e.target.value)}
          className="rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)]"
        >
          <option value="all">All follow-up statuses</option>
          {CONSULTATION_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by human review category"
          value={filters.reviewCategory ?? 'all'}
          onChange={(e) => updateFilter('reviewCategory', e.target.value)}
          className="rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)]"
        >
          <option value="all">All review categories</option>
          {HUMAN_REVIEW_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <Button
          variant="secondary"
          onClick={() => setShowAdvancedFilters((v) => !v)}
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          {showAdvancedFilters ? 'Hide filters' : 'More filters'}
          {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </Button>
        )}
      </div>

      {showAdvancedFilters && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[var(--kws-border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="filter-date-from"
              className="block text-xs font-semibold text-[var(--kws-muted)]"
            >
              Date from
            </label>
            <input
              id="filter-date-from"
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-sm text-[var(--kws-ink)]"
            />
          </div>

          <div>
            <label
              htmlFor="filter-date-to"
              className="block text-xs font-semibold text-[var(--kws-muted)]"
            >
              Date to
            </label>
            <input
              id="filter-date-to"
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-sm text-[var(--kws-ink)]"
            />
          </div>

          <div>
            <label
              htmlFor="filter-source"
              className="block text-xs font-semibold text-[var(--kws-muted)]"
            >
              Source / UTM
            </label>
            <input
              id="filter-source"
              type="text"
              value={filters.source ?? ''}
              onChange={(e) => updateFilter('source', e.target.value)}
              placeholder="e.g. instagram, referral..."
              className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-sm text-[var(--kws-ink)]"
            />
          </div>

          <div>
            <label
              htmlFor="filter-location"
              className="block text-xs font-semibold text-[var(--kws-muted)]"
            >
              Location (city / state)
            </label>
            <input
              id="filter-location"
              type="text"
              value={filters.location ?? ''}
              onChange={(e) => updateFilter('location', e.target.value)}
              placeholder="e.g. Ikeja, Lagos, Abuja..."
              className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-sm text-[var(--kws-ink)]"
            />
          </div>

          <div>
            <label
              htmlFor="filter-audience"
              className="block text-xs font-semibold text-[var(--kws-muted)]"
            >
              Audience segment
            </label>
            <select
              id="filter-audience"
              value={filters.audience ?? 'all'}
              onChange={(e) => updateFilter('audience', e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-sm text-[var(--kws-ink)]"
            >
              <option value="all">All audiences</option>
              {(QUESTION_MAP['D1']?.options ?? []).map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-urgency"
              className="block text-xs font-semibold text-[var(--kws-muted)]"
            >
              Urgency
            </label>
            <select
              id="filter-urgency"
              value={filters.urgency ?? 'all'}
              onChange={(e) => updateFilter('urgency', e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-sm text-[var(--kws-ink)]"
            >
              <option value="all">All urgency levels</option>
              {(QUESTION_MAP['D3']?.options ?? []).map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-financial"
              className="block text-xs font-semibold text-[var(--kws-muted)]"
            >
              Financial readiness
            </label>
            <select
              id="filter-financial"
              value={filters.financialReadiness ?? 'all'}
              onChange={(e) =>
                updateFilter('financialReadiness', e.target.value)
              }
              className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-sm text-[var(--kws-ink)]"
            >
              <option value="all">All financial responses</option>
              {(QUESTION_MAP['D5']?.options ?? []).map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-january"
              className="block text-xs font-semibold text-[var(--kws-muted)]"
            >
              January 2027 cohort interest
            </label>
            <select
              id="filter-january"
              value={filters.januaryCohort ?? 'all'}
              onChange={(e) => updateFilter('januaryCohort', e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-sm text-[var(--kws-ink)]"
            >
              <option value="all">All cohort responses</option>
              {(QUESTION_MAP['D6']?.options ?? []).map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {route.view === 'records' && (
            <label className="flex items-center gap-2 pt-2 text-xs font-medium text-[var(--kws-ink)] sm:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(filters.includeDrafts)}
                onChange={(e) => updateFilter('includeDrafts', e.target.checked)}
                className="h-4 w-4 rounded border-[var(--kws-border-strong)] accent-[var(--kws-accent)]"
              />
              Include incomplete in-progress starts in directory table
            </label>
          )}
        </div>
      )}
    </Surface>
  );

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Sidebar */}
        <aside className="min-w-0 lg:col-span-3">
          <Surface className="p-4">
            <div className="border-b border-[var(--kws-border)] pb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                {actorLabel || 'Staff Workspace'} ·{' '}
                <span className="text-[var(--kws-accent)]">
                  {staffRole ?? 'staff'}
                </span>
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[image:var(--kws-gradient-btn)] text-[11px] font-extrabold text-[var(--kws-btn-fg)] ring-1 ring-[var(--kws-gold)]/35"
                >
                  K
                </span>
                <p className="font-display text-base font-bold text-[var(--kws-ink)]">
                  KWS Academy Admin
                </p>
              </div>
              {staffRole === 'viewer' && (
                <p className="mt-1 text-xs text-[var(--kws-muted)]">
                  Read-only viewer role
                </p>
              )}
            </div>

            <nav
              aria-label="Admin sections"
              className="mt-3 flex gap-1.5 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.view;
                return (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() =>
                      onNavigate({ area: 'admin', view: item.view })
                    }
                    className={`flex min-h-[42px] shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer whitespace-nowrap lg:w-full ${
                      isActive
                        ? 'bg-[image:var(--kws-gradient-btn)] text-[var(--kws-btn-fg)] shadow-xs'
                        : 'text-[var(--kws-muted)] hover:bg-[var(--kws-surface-subtle)] hover:text-[var(--kws-ink)]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-4 border-t border-[var(--kws-border)] pt-3 lg:mt-6">
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[42px] w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--kws-muted)] hover:bg-[var(--kws-surface-subtle)] hover:text-[var(--kws-ink)] cursor-pointer"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          </Surface>
        </aside>

        {/* Main Viewport */}
        <div className="min-w-0 space-y-6 lg:col-span-9">
          {dataError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-[var(--kws-danger)]/40 bg-[var(--kws-danger-surface)] p-4 text-sm text-[var(--kws-danger)]"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{dataError}</span>
            </div>
          )}

          {/* OVERVIEW */}
          {route.view === 'overview' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[var(--kws-ink)]">
                    Cohort &amp; Consultation Overview
                  </h1>
                  <p className="text-sm text-[var(--kws-muted)]">
                    Live figures from persisted assessment submissions. Filters
                    apply across all counts, distributions, directory rows, and
                    exports.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      onNavigate({ area: 'admin', view: 'analytics' })
                    }
                  >
                    Full breakdowns
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      onNavigate({ area: 'admin', view: 'records' })
                    }
                  >
                    Open directory
                  </Button>
                </div>
              </div>

              {renderSharedFilterBar()}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Surface className="p-4">
                  <p className="text-xs text-[var(--kws-muted)]">
                    Assessment starts
                  </p>
                  <p className="mt-1 font-mono-tabular text-2xl font-bold text-[var(--kws-ink)]">
                    {analytics?.totalStarts ?? 0}
                  </p>
                </Surface>
                <Surface className="p-4">
                  <p className="text-xs text-[var(--kws-muted)]">
                    Completed assessments
                  </p>
                  <p className="mt-1 font-mono-tabular text-2xl font-bold text-[var(--kws-ink)]">
                    {analytics?.totalSubmissions ?? 0}
                  </p>
                </Surface>
                <Surface className="p-4">
                  <p className="text-xs text-[var(--kws-muted)]">
                    Completion rate
                  </p>
                  <p className="mt-1 font-mono-tabular text-2xl font-bold text-[var(--kws-ink)]">
                    {analytics && analytics.completionRatePct !== null
                      ? `${analytics.completionRatePct}%`
                      : '—'}
                  </p>
                </Surface>
                <Surface className="p-4">
                  <p className="text-xs text-[var(--kws-muted)]">
                    Incomplete drafts
                  </p>
                  <p className="mt-1 font-mono-tabular text-2xl font-bold text-[var(--kws-ink)]">
                    {analytics?.inProgressDrafts ?? 0}
                  </p>
                </Surface>
                <Surface className="p-4">
                  <p className="text-xs text-[var(--kws-muted)]">
                    Consultation requests
                  </p>
                  <p className="mt-1 font-mono-tabular text-2xl font-bold text-[var(--kws-accent)]">
                    {analytics?.consultationRequests ?? 0}
                  </p>
                  <p className="mt-0.5 font-mono-tabular text-[11px] text-[var(--kws-muted)]">
                    {analytics && analytics.consultationRequestRatePct !== null
                      ? `${analytics.consultationRequestRatePct}% of completions`
                      : '—'}
                  </p>
                </Surface>
                <Surface className="p-4">
                  <p className="text-xs text-[var(--kws-muted)]">
                    Consultations scheduled / done
                  </p>
                  <p className="mt-1 font-mono-tabular text-2xl font-bold text-[var(--kws-ink)]">
                    {(analytics?.consultationConversionOutcomes.scheduledCount ?? 0) +
                      (analytics?.consultationConversionOutcomes.completedCount ?? 0)}
                  </p>
                  <p className="mt-0.5 font-mono-tabular text-[11px] text-[var(--kws-muted)]">
                    {analytics?.consultationConversionOutcomes.scheduledCount ?? 0}{' '}
                    sched ·{' '}
                    {analytics?.consultationConversionOutcomes.completedCount ?? 0}{' '}
                    done
                  </p>
                </Surface>
              </div>

              {analytics && analytics.totalStarts === 0 ? (
                <Surface className="p-6 text-sm text-[var(--kws-muted)]">
                  No assessment starts or completed submissions match the
                  current view. Statistics remain empty until real respondents
                  begin or submit the assessment.
                </Surface>
              ) : (
                analytics && (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Surface className="p-5">
                      <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                        Human Review Categories
                      </h2>
                      <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
                        Staff-assigned categories &amp; optional approved rules
                        (manual review always takes precedence).
                      </p>
                      <div className="mt-4 space-y-2 text-sm">
                        {HUMAN_REVIEW_CATEGORY_OPTIONS.map((cat) => (
                          <div
                            key={cat.value}
                            className="flex items-center justify-between border-t border-[var(--kws-border)] pt-2 first:border-t-0 first:pt-0"
                          >
                            <span className="text-[var(--kws-ink)]">
                              {cat.label}
                            </span>
                            <span className="font-mono-tabular font-semibold text-[var(--kws-ink)]">
                              {analytics.reviewCategoryCounts[cat.value] ?? 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Surface>

                    <Surface className="p-5">
                      <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                        Follow-up Status Queue
                      </h2>
                      <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
                        Active distribution across all 10 follow-up workflow
                        stages.
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        {CONSULTATION_STATUS_OPTIONS.map((st) => (
                          <div
                            key={st.value}
                            className="flex items-center justify-between border-t border-[var(--kws-border)] pt-1.5"
                          >
                            <span className="text-[var(--kws-muted)]">
                              {st.label}
                            </span>
                            <span className="font-mono-tabular font-semibold text-[var(--kws-ink)]">
                              {analytics.consultationStatusCounts[st.value] ??
                                0}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Surface>
                  </div>
                )
              )}

              <Surface className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                    Recent completed respondents
                  </h2>
                  <span className="font-mono-tabular text-xs text-[var(--kws-muted)]">
                    Showing {Math.min(records.length, 6)} of {records.length}{' '}
                    matching
                  </span>
                </div>
                {loadingData ? (
                  <p className="mt-4 text-sm text-[var(--kws-muted)]">
                    Loading submissions...
                  </p>
                ) : records.length === 0 ? (
                  <p className="mt-4 text-sm text-[var(--kws-muted)]">
                    No completed submissions match the current filter selection.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-[var(--kws-border)] text-xs text-[var(--kws-muted)]">
                        <tr>
                          <th className="pb-2.5 pr-4 font-semibold">Name</th>
                          <th className="pb-2.5 pr-4 font-semibold">
                            Location
                          </th>
                          <th className="pb-2.5 pr-4 font-semibold">Stage</th>
                          <th className="pb-2.5 pr-4 font-semibold">
                            Human Review
                          </th>
                          <th className="pb-2.5 pr-4 font-semibold">
                            Follow-up
                          </th>
                          <th className="pb-2.5 text-right font-semibold">
                            Submitted
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--kws-border)]">
                        {records.slice(0, 6).map((rec) => (
                          <tr
                            key={rec.id}
                            className="hover:bg-[var(--kws-surface-subtle)]/50"
                          >
                            <td className="py-2.5 pr-4 font-medium text-[var(--kws-ink)]">
                              <button
                                type="button"
                                onClick={() =>
                                  onNavigate({
                                    area: 'admin',
                                    view: 'profile',
                                    submissionId: rec.id,
                                  })
                                }
                                className="text-left hover:text-[var(--kws-accent)] hover:underline cursor-pointer"
                              >
                                {rec.answers.contact.fullName || 'Unnamed'}
                              </button>
                            </td>
                            <td className="py-2.5 pr-4 text-[var(--kws-muted)]">
                              {[
                                rec.answers.contact.city,
                                rec.answers.contact.state,
                              ]
                                .filter(Boolean)
                                .join(', ') || '—'}
                            </td>
                            <td className="py-2.5 pr-4 text-[var(--kws-muted)]">
                              {rec.result.growthJourney.indicativeStage.name}
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-[var(--kws-ink)]">
                              {
                                REVIEW_CATEGORY_LABEL_MAP[
                                  rec.consultation.reviewCategory
                                ]
                              }
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-[var(--kws-ink)]">
                              {STATUS_LABEL_MAP[rec.consultationStatus] ??
                                rec.consultationStatus}
                            </td>
                            <td className="py-2.5 text-right font-mono-tabular text-xs text-[var(--kws-muted)]">
                              {(rec.submittedAt ?? rec.createdAt).slice(0, 10)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Surface>

              {storageStatus && (
                <Surface subtle className="p-4 text-xs text-[var(--kws-muted)]">
                  <strong className="font-semibold text-[var(--kws-ink)]">
                    Persistence Boundary:
                  </strong>{' '}
                  {storageStatus.description}
                </Surface>
              )}
            </>
          )}

          {/* RESPONDENT DIRECTORY */}
          {route.view === 'records' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[var(--kws-ink)]">
                    Respondent Directory
                  </h1>
                  <p className="text-sm text-[var(--kws-muted)]">
                    Searchable directory of discovery records. Open any record
                    for contact details, exact raw answers, results, and
                    consultation workflow history.
                  </p>
                </div>
                <span className="font-mono-tabular text-xs text-[var(--kws-muted)]">
                  {records.length} matching ({totalStoredCount} stored)
                </span>
              </div>

              {renderSharedFilterBar()}

              <Surface className="p-4">
                {loadingData ? (
                  <p className="py-4 text-sm text-[var(--kws-muted)]">
                    Loading records...
                  </p>
                ) : records.length === 0 ? (
                  <p className="py-4 text-sm text-[var(--kws-muted)]">
                    No matching respondent records found for the active filters.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-[var(--kws-border)] text-xs text-[var(--kws-muted)]">
                        <tr>
                          <th className="pb-2.5 pr-4 font-semibold">
                            Respondent
                          </th>
                          <th className="pb-2.5 pr-4 font-semibold">
                            Location &amp; Audience
                          </th>
                          <th className="pb-2.5 pr-4 font-semibold">
                            Style &amp; Stage
                          </th>
                          <th className="pb-2.5 pr-4 font-semibold">
                            Human Review
                          </th>
                          <th className="pb-2.5 pr-4 font-semibold">
                            Follow-up Status
                          </th>
                          <th className="pb-2.5 pr-4 font-semibold">Date</th>
                          <th className="pb-2.5 text-right font-semibold">
                            Profile
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--kws-border)]">
                        {records.map((rec) => {
                          const audience = getOptionDisplay(rec, 'D1');
                          return (
                            <tr
                              key={rec.id}
                              className="hover:bg-[var(--kws-surface-subtle)]/50"
                            >
                              <td className="py-3 pr-4">
                                <p className="font-semibold text-[var(--kws-ink)]">
                                  {rec.answers.contact.fullName ||
                                    'Unnamed draft'}
                                </p>
                                <p className="font-mono-tabular text-xs text-[var(--kws-muted)]">
                                  {rec.answers.contact.email ||
                                    rec.answers.contact.whatsappNumber ||
                                    'No contact'}
                                </p>
                              </td>
                              <td className="py-3 pr-4">
                                <p className="text-[var(--kws-ink)]">
                                  {[
                                    rec.answers.contact.city,
                                    rec.answers.contact.state,
                                  ]
                                    .filter(Boolean)
                                    .join(', ') || '—'}
                                </p>
                                <p className="text-xs text-[var(--kws-muted)]">
                                  {audience.label}
                                </p>
                              </td>
                              <td className="py-3 pr-4">
                                <p className="text-xs font-medium text-[var(--kws-ink)]">
                                  {rec.result.professionalStyle.leadTitle}
                                </p>
                                <p className="text-xs text-[var(--kws-muted)]">
                                  Stage{' '}
                                  {
                                    rec.result.growthJourney.roundedStageLevel
                                  }{' '}
                                  ·{' '}
                                  {
                                    rec.result.growthJourney.indicativeStage
                                      .name
                                  }
                                </p>
                              </td>
                              <td className="py-3 pr-4 text-xs text-[var(--kws-ink)]">
                                {
                                  REVIEW_CATEGORY_LABEL_MAP[
                                    rec.consultation.reviewCategory
                                  ]
                                }
                              </td>
                              <td className="py-3 pr-4">
                                <p className="text-xs font-medium text-[var(--kws-ink)]">
                                  {STATUS_LABEL_MAP[rec.consultationStatus] ??
                                    rec.consultationStatus}
                                </p>
                                {rec.completionStatus === 'in_progress' && (
                                  <p className="text-xs text-[var(--kws-muted)]">
                                    Draft (in progress)
                                  </p>
                                )}
                              </td>
                              <td className="py-3 pr-4 font-mono-tabular text-xs text-[var(--kws-muted)]">
                                {(rec.submittedAt ?? rec.createdAt).slice(
                                  0,
                                  10
                                )}
                              </td>
                              <td className="py-3 text-right">
                                <Button
                                  variant="secondary"
                                  size="md"
                                  onClick={() =>
                                    onNavigate({
                                      area: 'admin',
                                      view: 'profile',
                                      submissionId: rec.id,
                                    })
                                  }
                                >
                                  Open profile
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Surface>
            </>
          )}

          {/* INDIVIDUAL RESPONDENT PROFILE (A, B, C, D) */}
          {route.view === 'profile' && (
            <>
              <div>
                <Button
                  variant="ghost"
                  onClick={() =>
                    onNavigate({ area: 'admin', view: 'records' })
                  }
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to directory
                </Button>
              </div>

              {loadingProfile ? (
                <Surface className="p-6 text-sm text-[var(--kws-muted)]">
                  Loading respondent profile...
                </Surface>
              ) : !selectedRecord ? (
                <Surface className="p-6 text-sm text-[var(--kws-muted)]">
                  Respondent record not found.
                </Surface>
              ) : (
                <div className="space-y-6">
                  {/* Section A: Contact Details */}
                  <Surface className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--kws-border)] pb-4">
                      <div>
                        <p className="font-mono-tabular text-xs text-[var(--kws-muted)]">
                          Ref {selectedRecord.id} ·{' '}
                          {selectedRecord.completionStatus === 'submitted'
                            ? `Submitted ${new Date(selectedRecord.submittedAt ?? selectedRecord.createdAt).toLocaleString()}`
                            : `Draft started ${new Date(selectedRecord.createdAt).toLocaleString()}`}
                        </p>
                        <h1 className="mt-1 font-display text-2xl font-bold text-[var(--kws-ink)]">
                          {selectedRecord.answers.contact.fullName ||
                            'Unnamed Respondent'}
                        </h1>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--kws-accent)]">
                          A. Contact Details
                        </p>
                      </div>
                      <div className="text-right font-mono-tabular text-xs text-[var(--kws-muted)]">
                        <p>
                          Review:{' '}
                          <span className="font-semibold text-[var(--kws-ink)]">
                            {
                              REVIEW_CATEGORY_LABEL_MAP[
                                selectedRecord.consultation.reviewCategory
                              ]
                            }
                          </span>
                        </p>
                        <p className="mt-0.5">
                          Status:{' '}
                          <span className="font-semibold text-[var(--kws-ink)]">
                            {STATUS_LABEL_MAP[
                              selectedRecord.consultation.status
                            ] ?? selectedRecord.consultation.status}
                          </span>
                        </p>
                      </div>
                    </div>

                    <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-[var(--kws-muted)]">
                          WhatsApp
                        </dt>
                        <dd className="mt-0.5 font-mono-tabular font-semibold text-[var(--kws-ink)]">
                          {selectedRecord.answers.contact.whatsappNumber || '—'}
                        </dd>
                        <dd className="mt-0.5 text-xs text-[var(--kws-muted)]">
                          Outreach consent:{' '}
                          {selectedRecord.answers.contact.whatsappConsent
                            ? 'Yes'
                            : 'No'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--kws-muted)]">
                          Email
                        </dt>
                        <dd className="mt-0.5 break-all font-medium text-[var(--kws-ink)]">
                          {selectedRecord.answers.contact.email || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--kws-muted)]">
                          City &amp; State
                        </dt>
                        <dd className="mt-0.5 font-medium text-[var(--kws-ink)]">
                          {[
                            selectedRecord.answers.contact.city,
                            selectedRecord.answers.contact.state,
                          ]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--kws-muted)]">
                          Institution (where applicable)
                        </dt>
                        <dd className="mt-0.5 font-medium text-[var(--kws-ink)]">
                          {selectedRecord.answers.contact.institution || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--kws-muted)]">
                          Completion Duration
                        </dt>
                        <dd className="mt-0.5 font-mono-tabular font-medium text-[var(--kws-ink)]">
                          {selectedRecord.durationMinutes} min
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--kws-muted)]">
                          Ikeja Proximity / Availability
                        </dt>
                        <dd className="mt-0.5 font-medium text-[var(--kws-ink)]">
                          {getOptionDisplay(selectedRecord, 'D4').label}
                        </dd>
                      </div>
                    </dl>
                  </Surface>

                  {/* Section C: Calculated Results & Interpretation */}
                  <Surface className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--kws-border)] pb-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-accent)]">
                          C. Calculated Results &amp; Interpretation
                        </p>
                        <h2 className="mt-0.5 font-display text-lg font-bold text-[var(--kws-ink)]">
                          Personalized Discovery Output
                        </h2>
                      </div>
                      <p className="font-mono-tabular text-xs text-[var(--kws-muted)]">
                        Assessment {selectedRecord.assessmentVersion} · Scoring{' '}
                        {selectedRecord.scoringVersion} · Part A{' '}
                        {selectedRecord.partAConfigVersion}
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                          Professional Style
                        </p>
                        <p className="mt-1.5 font-display text-xl font-bold text-[var(--kws-accent)]">
                          {selectedRecord.result.professionalStyle.leadTitle}
                        </p>
                        <p className="mt-1 text-sm text-[var(--kws-ink)]">
                          {selectedRecord.result.professionalStyle.summary}
                        </p>

                        {selectedRecord.result.professionalStyle.status ===
                        'incomplete_configuration' ? (
                          <p className="mt-3 rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-3 text-xs text-[var(--kws-muted)]">
                            {
                              selectedRecord.result.professionalStyle
                                .configurationMessage
                            }
                          </p>
                        ) : (
                          <div className="mt-3 space-y-1.5">
                            {selectedRecord.result.professionalStyle.styleScores.map(
                              (s) => (
                                <div
                                  key={s.styleId}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span>{s.name}</span>
                                  <span className="font-mono-tabular font-semibold">
                                    {s.count}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        )}

                        <div className="mt-5 border-t border-[var(--kws-border)] pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                            Growth Journey
                          </p>
                          <p className="mt-1 font-display text-base font-bold text-[var(--kws-ink)]">
                            Stage{' '}
                            {
                              selectedRecord.result.growthJourney
                                .roundedStageLevel
                            }
                            :{' '}
                            {
                              selectedRecord.result.growthJourney
                                .indicativeStage.name
                            }
                            {selectedRecord.result.growthJourney.mixedStageFlag
                              ? ' (Mixed-stage flag)'
                              : ''}
                          </p>
                          <p className="mt-1 font-mono-tabular text-xs text-[var(--kws-muted)]">
                            Unrounded mean{' '}
                            {selectedRecord.result.growthJourney.unroundedAverage.toFixed(
                              2
                            )}{' '}
                            · Spread{' '}
                            {selectedRecord.result.growthJourney.spread} ·
                            Q1–Q4 [
                            {selectedRecord.result.growthJourney.rawResponses
                              .map((r) => r.value)
                              .join(', ')}
                            ]
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-[var(--kws-muted)]">
                            {
                              selectedRecord.result.growthJourney
                                .supportingPatternSummary
                            }
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                          Six Capabilities (Understanding &amp; Experience
                          Separate)
                        </p>
                        <div className="mt-2 space-y-3">
                          {selectedRecord.result.capabilities.map((c) => (
                            <div
                              key={c.pillarId}
                              className="border-t border-[var(--kws-border)] pt-2 first:border-t-0 first:pt-0"
                            >
                              <div className="flex justify-between gap-2 text-xs">
                                <span className="font-semibold text-[var(--kws-ink)]">
                                  {c.name}
                                </span>
                                <span className="shrink-0 font-mono-tabular text-[var(--kws-muted)]">
                                  U: {c.understandingScore}/1 · E:{' '}
                                  {c.experienceScore}/4
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
                                {c.constructiveInterpretation}
                              </p>
                            </div>
                          ))}
                        </div>

                        {selectedRecord.result.developmentPriorities.length >
                          0 && (
                          <div className="mt-4 border-t border-[var(--kws-border)] pt-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                              Suggested Development Priorities
                            </p>
                            <ul className="mt-1.5 space-y-1 text-xs text-[var(--kws-ink)]">
                              {selectedRecord.result.developmentPriorities.map(
                                (p) => (
                                  <li key={p.id}>· {p.title}</li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </Surface>

                  {/* Section B: Exact Raw Assessment Responses */}
                  <Surface className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--kws-border)] pb-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-accent)]">
                          B. Exact Raw Assessment Responses
                        </p>
                        <h2 className="mt-0.5 font-display text-lg font-bold text-[var(--kws-ink)]">
                          Verbatim Answers Across Parts A, B, C &amp; D
                        </h2>
                      </div>
                      <div className="flex flex-wrap gap-1 rounded-lg bg-[var(--kws-bg)] p-1 text-xs">
                        {(
                          [
                            ['all', 'All Parts'],
                            ['A', `Part A (${partAQuestions.length})`],
                            ['B', `Part B (${partBQuestions.length})`],
                            ['C', `Part C (${CAPABILITY_CARDS.length})`],
                            ['D', `Part D (${partDQuestions.length})`],
                          ] as const
                        ).map(([tabKey, label]) => (
                          <button
                            key={tabKey}
                            type="button"
                            onClick={() => setResponsePartTab(tabKey)}
                            className={`rounded-md px-2.5 py-1 font-medium cursor-pointer ${
                              responsePartTab === tabKey
                                ? 'bg-[var(--kws-surface)] text-[var(--kws-ink)] shadow-xs'
                                : 'text-[var(--kws-muted)] hover:text-[var(--kws-ink)]'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 space-y-6 text-sm">
                      {(responsePartTab === 'all' || responsePartTab === 'A') && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                            Section A — Professional Style Raw Answers
                          </h3>
                          <dl className="mt-2 divide-y divide-[var(--kws-border)]">
                            {partAQuestions.map((q, idx) => {
                              const ans = getOptionDisplay(selectedRecord, q.id);
                              return (
                                <div key={q.id} className="py-2.5">
                                  <dt className="text-xs text-[var(--kws-muted)]">
                                    A{idx + 1}. {q.prompt}
                                  </dt>
                                  <dd className="mt-1 font-medium text-[var(--kws-ink)]">
                                    {ans.label}{' '}
                                    {ans.optionId && (
                                      <span className="font-mono-tabular text-xs text-[var(--kws-muted)]">
                                        [{ans.optionId}]
                                      </span>
                                    )}
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>
                        </div>
                      )}

                      {(responsePartTab === 'all' || responsePartTab === 'B') && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                            Section B — Growth Journey Raw Answers
                          </h3>
                          <dl className="mt-2 divide-y divide-[var(--kws-border)]">
                            {partBQuestions.map((q, idx) => {
                              const ans = getOptionDisplay(selectedRecord, q.id);
                              const growthVal =
                                selectedRecord.result.growthJourney.rawResponses.find(
                                  (r) => r.questionId === q.id
                                )?.value;
                              return (
                                <div key={q.id} className="py-2.5">
                                  <dt className="text-xs text-[var(--kws-muted)]">
                                    B{idx + 1}. {q.prompt}
                                  </dt>
                                  <dd className="mt-1 font-medium text-[var(--kws-ink)]">
                                    {ans.label}
                                    {ans.extra ? ` (${ans.extra})` : ''}
                                    {growthVal !== undefined && (
                                      <span className="ml-2 font-mono-tabular text-xs text-[var(--kws-accent)]">
                                        Stage value {growthVal}/4
                                      </span>
                                    )}
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>
                        </div>
                      )}

                      {(responsePartTab === 'all' || responsePartTab === 'C') && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                            Section C — Six Capability Raw Responses
                          </h3>
                          <div className="mt-2 divide-y divide-[var(--kws-border)]">
                            {CAPABILITY_CARDS.map((card) => {
                              const uAns = getOptionDisplay(
                                selectedRecord,
                                card.understandingQuestion.id
                              );
                              const eAns = getOptionDisplay(
                                selectedRecord,
                                card.experienceQuestion.id
                              );
                              return (
                                <div key={card.id} className="py-3">
                                  <p className="font-semibold text-[var(--kws-ink)]">
                                    {card.index}. {card.pillar.name}
                                  </p>
                                  <p className="mt-1 text-xs text-[var(--kws-muted)]">
                                    Understanding ({card.understandingQuestion.prompt})
                                  </p>
                                  <p className="text-sm text-[var(--kws-ink)]">
                                    → {uAns.label}
                                  </p>
                                  <p className="mt-1.5 text-xs text-[var(--kws-muted)]">
                                    Practical Experience ({card.experienceQuestion.prompt})
                                  </p>
                                  <p className="text-sm text-[var(--kws-ink)]">
                                    → {eAns.label}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {(responsePartTab === 'all' || responsePartTab === 'D') && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                            Section D — Profile &amp; Next-Step Survey Answers
                          </h3>
                          <dl className="mt-2 divide-y divide-[var(--kws-border)]">
                            {partDQuestions.map((q, idx) => {
                              const ans = getOptionDisplay(selectedRecord, q.id);
                              return (
                                <div key={q.id} className="py-2.5">
                                  <dt className="text-xs text-[var(--kws-muted)]">
                                    D{idx + 1}. {q.prompt}
                                  </dt>
                                  <dd className="mt-1 font-medium text-[var(--kws-ink)]">
                                    {ans.label}
                                    {ans.extra ? ` (${ans.extra})` : ''}
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>
                        </div>
                      )}
                    </div>
                  </Surface>

                  {/* Section D: Consultation History & Human Lead Review */}
                  <Surface className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--kws-border)] pb-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-accent)]">
                          D. Consultation History &amp; Human Lead Review
                        </p>
                        <h2 className="mt-0.5 font-display text-lg font-bold text-[var(--kws-ink)]">
                          Staff Review &amp; Follow-up Management
                        </h2>
                        <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
                          Manual staff review only — no automatic admissions
                          decisions or respondent-facing scores.
                        </p>
                      </div>
                      <div className="text-right font-mono-tabular text-xs text-[var(--kws-muted)]">
                        <p>
                          Preference:{' '}
                          <span className="font-semibold text-[var(--kws-ink)]">
                            {selectedRecord.consultation.preference}
                          </span>
                        </p>
                        <p>
                          Attempts:{' '}
                          <span className="font-semibold text-[var(--kws-ink)]">
                            {selectedRecord.consultation.contactAttempts}
                          </span>
                          {selectedRecord.consultation.lastContactedAt
                            ? ` · Last: ${selectedRecord.consultation.lastContactedAt.slice(0, 10)}`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label
                          htmlFor="admin-review-category"
                          className="block text-sm font-semibold text-[var(--kws-ink)]"
                        >
                          Human review category
                        </label>
                        <select
                          id="admin-review-category"
                          disabled={!canEditConsultations}
                          value={editReviewCategory}
                          onChange={(e) =>
                            setEditReviewCategory(
                              e.target.value as HumanReviewCategory
                            )
                          }
                          className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)] disabled:opacity-60"
                        >
                          {HUMAN_REVIEW_CATEGORY_OPTIONS.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        {selectedRecord.consultation.autoCategorized ? (
                          <p className="mt-1 font-mono-tabular text-[11px] text-[var(--kws-accent)]">
                            Auto-categorized
                            {selectedRecord.consultation.matchedRuleLabel
                              ? ` · ${selectedRecord.consultation.matchedRuleLabel}`
                              : ''}
                          </p>
                        ) : (
                          selectedRecord.consultation.reviewedAt && (
                            <p className="mt-1 font-mono-tabular text-[11px] text-[var(--kws-muted)]">
                              Reviewed{' '}
                              {selectedRecord.consultation.reviewedAt.slice(
                                0,
                                10
                              )}{' '}
                              by{' '}
                              {selectedRecord.consultation.reviewedBy || 'Staff'}
                            </p>
                          )
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="admin-consult-status"
                          className="block text-sm font-semibold text-[var(--kws-ink)]"
                        >
                          Follow-up status
                        </label>
                        <select
                          id="admin-consult-status"
                          disabled={!canEditConsultations}
                          value={editStatus}
                          onChange={(e) =>
                            setEditStatus(e.target.value as ConsultationStatus)
                          }
                          className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)] disabled:opacity-60"
                        >
                          {CONSULTATION_STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 font-mono-tabular text-[11px] text-[var(--kws-muted)]">
                          Updated{' '}
                          {selectedRecord.consultation.statusUpdatedAt.slice(
                            0,
                            10
                          )}
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="admin-assigned-staff"
                          className="block text-sm font-semibold text-[var(--kws-ink)]"
                        >
                          Assigned staff member
                        </label>
                        <input
                          id="admin-assigned-staff"
                          type="text"
                          disabled={!canEditConsultations}
                          value={editAssignedStaff}
                          onChange={(e) => setEditAssignedStaff(e.target.value)}
                          placeholder="e.g. Tunde A."
                          className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)] disabled:opacity-60"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="admin-scheduled-at"
                          className="block text-sm font-semibold text-[var(--kws-ink)]"
                        >
                          Scheduled date / slot
                        </label>
                        <input
                          id="admin-scheduled-at"
                          type="text"
                          disabled={!canEditConsultations}
                          value={editScheduledAt}
                          onChange={(e) => setEditScheduledAt(e.target.value)}
                          placeholder="e.g. 2026-11-20 14:00 WAT"
                          className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)] disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label
                        htmlFor="admin-staff-notes"
                        className="block text-sm font-semibold text-[var(--kws-ink)]"
                      >
                        Outcome &amp; staff notes
                      </label>
                      <textarea
                        id="admin-staff-notes"
                        rows={4}
                        disabled={!canEditConsultations}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Record conversation summary, consultation notes, and agreed follow-up steps..."
                        className="mt-1.5 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)] disabled:opacity-60"
                      />
                    </div>

                    {canEditConsultations ? (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button
                          variant="primary"
                          onClick={() => handleSaveConsultation(false)}
                          loading={savingConsultation}
                        >
                          Save review &amp; status
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleSaveConsultation(true)}
                          disabled={savingConsultation}
                        >
                          +1 Log contact attempt
                        </Button>
                        {consultationSavedMsg && (
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--kws-success)]">
                            <Check className="h-4 w-4" aria-hidden="true" />
                            {consultationSavedMsg}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-[var(--kws-muted)]">
                        Viewer role has read-only access. Sign in as Advisor or
                        Admin to update review categories or follow-up statuses.
                      </p>
                    )}

                    {/* Attribution, Question Timing, Communications & Event Audit */}
                    <div className="mt-6 border-t border-[var(--kws-border)] pt-4 space-y-4">
                      <p className="text-xs text-[var(--kws-muted)]">
                        <strong className="font-semibold text-[var(--kws-ink)]">
                          Attribution:
                        </strong>{' '}
                        {[
                          `heard_via=${selectedRecord.attribution.discoverySourceLabel || 'unknown/direct'}`,
                          `utm_source=${selectedRecord.attribution.utmSource || 'unknown/direct'}`,
                          `utm_medium=${selectedRecord.attribution.utmMedium || 'unknown/direct'}`,
                          `utm_campaign=${selectedRecord.attribution.utmCampaign || 'unknown/direct'}`,
                          `ad_set=${selectedRecord.attribution.adSet || 'unknown/direct'}`,
                          `creative=${selectedRecord.attribution.creative || 'unknown/direct'}`,
                          `placement=${selectedRecord.attribution.placement || 'unknown/direct'}`,
                          `referrer=${selectedRecord.attribution.referrer || 'unknown/direct'}`,
                        ].join(' · ')}
                      </p>

                      {canEditConsultations && (
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-3">
                          <span className="text-xs font-semibold text-[var(--kws-ink)]">
                            Quick Email Action:
                          </span>
                          <Button
                            variant="secondary"
                            size="md"
                            onClick={async () => {
                              setProfileEmailMsg(null);
                              const msgs = await sendAdminEmail({
                                submissionIds: [selectedRecord.id],
                                messageType: 'consultation_followup',
                              });
                              if (msgs[0]) {
                                setProfileEmailMsg(
                                  `Email (${msgs[0].status}): ${msgs[0].errorDetail || msgs[0].subject}`
                                );
                              }
                            }}
                          >
                            Send Consultation Email
                          </Button>
                          <Button
                            variant="secondary"
                            size="md"
                            onClick={async () => {
                              setProfileEmailMsg(null);
                              const msgs = await sendAdminEmail({
                                submissionIds: [selectedRecord.id],
                                messageType: 'programme_info',
                              });
                              if (msgs[0]) {
                                setProfileEmailMsg(
                                  `Email (${msgs[0].status}): ${msgs[0].errorDetail || msgs[0].subject}`
                                );
                              }
                            }}
                          >
                            Send Programme Info
                          </Button>
                          {profileEmailMsg && (
                            <span className="text-xs text-[var(--kws-muted)]">
                              {profileEmailMsg}
                            </span>
                          )}
                        </div>
                      )}

                      {selectedRecord.telemetryEvents &&
                        selectedRecord.telemetryEvents.length > 0 && (() => {
                          const totalActiveMs =
                            selectedRecord.telemetryEvents.reduce(
                              (sum, t) => sum + (t.activeTimeMs || 0),
                              0
                            );
                          const totalInactiveMs =
                            selectedRecord.telemetryEvents.reduce(
                              (sum, t) => sum + (t.inactiveTimeMs || 0),
                              0
                            );
                          const changesCount =
                            selectedRecord.telemetryEvents.filter(
                              (t) => t.eventType === 'answer_changed'
                            ).length;
                          const backCount =
                            selectedRecord.telemetryEvents.filter(
                              (t) => t.eventType === 'back_clicked'
                            ).length;
                          const sectionTimes: Record<string, number> = {
                            professional_style: 0,
                            growth_journey: 0,
                            strengths_growth: 0,
                            profile_next_steps: 0,
                          };
                          for (const evt of selectedRecord.telemetryEvents) {
                            if (
                              evt.sectionId &&
                              evt.sectionId in sectionTimes
                            ) {
                              sectionTimes[evt.sectionId] +=
                                evt.activeTimeMs || 0;
                            }
                          }
                          return (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                                Question Interaction Timing
                              </p>
                              <p className="mt-1 font-mono-tabular text-xs text-[var(--kws-ink)]">
                                Active interaction:{' '}
                                {Math.round(totalActiveMs / 1000)}s · Tab
                                inactive: {Math.round(totalInactiveMs / 1000)}s
                                · Answer changes: {changesCount} · Back clicks:{' '}
                                {backCount}
                              </p>
                              <p className="mt-0.5 font-mono-tabular text-[11px] text-[var(--kws-muted)]">
                                By section: Sec A{' '}
                                {Math.round(
                                  sectionTimes.professional_style / 1000
                                )}
                                s · Sec B{' '}
                                {Math.round(
                                  sectionTimes.growth_journey / 1000
                                )}
                                s · Sec C{' '}
                                {Math.round(
                                  sectionTimes.strengths_growth / 1000
                                )}
                                s · Sec D{' '}
                                {Math.round(
                                  sectionTimes.profile_next_steps / 1000
                                )}
                                s
                              </p>
                            </div>
                          );
                        })()}

                      {selectedRecord.communicationMessages &&
                        selectedRecord.communicationMessages.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                              Communication Messages
                            </p>
                            <ul className="mt-1.5 space-y-1 text-xs text-[var(--kws-muted)]">
                              {selectedRecord.communicationMessages.map((msg) => (
                                <li key={msg.id} className="font-mono-tabular">
                                  [{msg.createdAt.slice(0, 19)}] {msg.channel}{' '}
                                  {msg.messageType} · {msg.status} (
                                  {msg.provider}) —{' '}
                                  {msg.errorDetail || msg.subject}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {selectedRecord.deliveryEvents &&
                        selectedRecord.deliveryEvents.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                              Report Delivery Events
                            </p>
                            <ul className="mt-1.5 space-y-1 text-xs text-[var(--kws-muted)]">
                              {selectedRecord.deliveryEvents.map((dlv) => (
                                <li key={dlv.id} className="font-mono-tabular">
                                  [{dlv.createdAt.slice(0, 19)}] {dlv.channel} ·{' '}
                                  {dlv.status} — {dlv.detail}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {selectedRecord.events &&
                        selectedRecord.events.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                              Submission &amp; Consultation Audit Timeline
                            </p>
                            <ul className="mt-1.5 space-y-1 text-xs text-[var(--kws-muted)]">
                              {selectedRecord.events.map((evt) => (
                                <li key={evt.id} className="font-mono-tabular">
                                  [{evt.createdAt.slice(0, 19)}] {evt.eventType}{' '}
                                  ({evt.actorType}: {evt.actorId})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  </Surface>
                </div>
              )}
            </>
          )}

          {/* COHORT ANALYTICS */}
          {route.view === 'analytics' && (
            <>
              <div>
                <h1 className="font-display text-2xl font-bold text-[var(--kws-ink)]">
                  Cohort Analytics
                </h1>
                <p className="text-sm text-[var(--kws-muted)]">
                  Complete distributions across styles, growth stages,
                  capability understanding &amp; experience levels, audience
                  segments, urgency, location, financial readiness, and cohort
                  interest.
                </p>
              </div>

              {renderSharedFilterBar()}

              {!analytics || analytics.totalStarts === 0 ? (
                <Surface className="p-6 text-sm text-[var(--kws-muted)]">
                  No analytics available yet. Charts and distributions appear
                  automatically from real respondent data without invented
                  statistics.
                </Surface>
              ) : analytics.totalSubmissions === 0 ? (
                <Surface className="p-6 text-sm text-[var(--kws-muted)]">
                  <span className="font-mono-tabular font-semibold text-[var(--kws-ink)]">
                    {analytics.totalStarts}
                  </span>{' '}
                  in-progress assessment start(s) match your filters, with 0
                  completed submissions yet. Completed distributions populate
                  once respondents submit.
                </Surface>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Professional Style */}
                  <Surface className="p-5">
                    <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                      Professional Style Distribution
                    </h2>
                    {!analytics.partAConfigApproved ? (
                      <p className="mt-3 rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-3 text-xs text-[var(--kws-muted)]">
                        Part A style matrix is awaiting KWS Academy approval (
                        <span className="font-mono-tabular font-semibold text-[var(--kws-ink)]">
                          {analytics.incompleteStyleCount}
                        </span>{' '}
                        submissions recorded cleanly with pending Part A
                        mapping).
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {analytics.styleDistribution.map((item) => (
                          <div key={item.styleId} className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>{item.name}</span>
                              <span className="font-mono-tabular font-semibold">
                                {item.leadCount}
                              </span>
                            </div>
                            <ProgressBar
                              value={item.leadCount}
                              max={analytics.totalSubmissions}
                              label={item.name}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </Surface>

                  {/* Growth Journey */}
                  <Surface className="p-5">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                        Growth Journey Distribution
                      </h2>
                      <span className="font-mono-tabular text-xs text-[var(--kws-muted)]">
                        Mixed-stage: {analytics.mixedStageCount}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {analytics.stageDistribution.map((item) => (
                        <div key={item.level} className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>
                              {item.level}. {item.name}
                            </span>
                            <span className="font-mono-tabular font-semibold">
                              {item.count}
                            </span>
                          </div>
                          <ProgressBar
                            value={item.count}
                            max={analytics.totalSubmissions}
                            label={item.name}
                            accent="gold"
                          />
                        </div>
                      ))}
                    </div>
                  </Surface>

                  {/* Capability Understanding & Experience Distributions */}
                  <Surface className="p-5 md:col-span-2">
                    <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                      Capability Understanding &amp; Experience Distributions
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
                      Understanding alignment (0/1) and Experience level counts
                      (Levels 0–4) reported separately per capability pillar.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {analytics.pillarAverages.map((p) => (
                        <div
                          key={p.pillarId}
                          className="border-t border-[var(--kws-border)] pt-3 text-xs"
                        >
                          <p className="text-sm font-semibold text-[var(--kws-ink)]">
                            {p.name}
                          </p>
                          <p className="mt-1 font-mono-tabular text-[var(--kws-muted)]">
                            Understanding: {p.understandingAlignedCount} aligned
                            / {p.understandingRevisitCount} revisit (
                            {p.understandingAlignmentRate}%) · Avg experience:{' '}
                            {p.avgExperience}/4
                          </p>
                          <div className="mt-2 grid grid-cols-5 gap-1.5 text-center font-mono-tabular">
                            {p.experienceDistribution.map((lvl) => (
                              <div
                                key={lvl.level}
                                className="rounded-md border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] py-1"
                              >
                                <span className="block text-[10px] text-[var(--kws-muted)]">
                                  L{lvl.level}
                                </span>
                                <span className="font-semibold text-[var(--kws-ink)]">
                                  {lvl.count}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Surface>

                  {/* Audience Segments */}
                  <Surface className="p-5">
                    <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                      Audience Segments
                    </h2>
                    <div className="mt-3 space-y-2.5 text-xs">
                      {analytics.audienceSegments.map((item) => (
                        <div key={item.optionId} className="space-y-1">
                          <div className="flex justify-between gap-2">
                            <span className="text-[var(--kws-ink)]">
                              {item.label}
                            </span>
                            <span className="font-mono-tabular font-semibold">
                              {item.count}
                            </span>
                          </div>
                          <ProgressBar
                            value={item.count}
                            max={analytics.totalSubmissions}
                            label={item.label}
                          />
                        </div>
                      ))}
                    </div>
                  </Surface>

                  {/* Main Challenges */}
                  <Surface className="p-5">
                    <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                      Main Respondent Challenges
                    </h2>
                    <div className="mt-3 space-y-2.5 text-xs">
                      {analytics.challengesBreakdown.map((item) => (
                        <div key={item.optionId} className="space-y-1">
                          <div className="flex justify-between gap-2">
                            <span className="text-[var(--kws-ink)]">
                              {item.label}
                            </span>
                            <span className="font-mono-tabular font-semibold">
                              {item.count}
                            </span>
                          </div>
                          <ProgressBar
                            value={item.count}
                            max={analytics.totalSubmissions}
                            label={item.label}
                            accent="gold"
                          />
                        </div>
                      ))}
                    </div>
                  </Surface>

                  {/* Urgency Distribution */}
                  <Surface className="p-5">
                    <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                      Urgency Distribution
                    </h2>
                    <div className="mt-3 space-y-2.5 text-xs">
                      {analytics.urgencyBreakdown.map((item) => (
                        <div key={item.optionId} className="space-y-1">
                          <div className="flex justify-between gap-2">
                            <span className="text-[var(--kws-ink)]">
                              {item.label}
                            </span>
                            <span className="font-mono-tabular font-semibold">
                              {item.count}
                            </span>
                          </div>
                          <ProgressBar
                            value={item.count}
                            max={analytics.totalSubmissions}
                            label={item.label}
                          />
                        </div>
                      ))}
                    </div>
                  </Surface>

                  {/* Geographic Distribution */}
                  <Surface className="p-5">
                    <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                      Geographic Distribution
                    </h2>
                    <div className="mt-3 space-y-2 text-xs">
                      {analytics.geographicBreakdown.map((geo) => (
                        <div
                          key={geo.location}
                          className="flex items-center justify-between border-t border-[var(--kws-border)] pt-2 first:border-t-0 first:pt-0"
                        >
                          <span className="text-[var(--kws-ink)]">
                            {geo.location}
                          </span>
                          <span className="font-mono-tabular font-semibold">
                            {geo.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Surface>

                  {/* Financial Readiness */}
                  <Surface className="p-5">
                    <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                      Financial Readiness Responses
                    </h2>
                    <div className="mt-3 space-y-2.5 text-xs">
                      {analytics.financialReadinessBreakdown.map((item) => (
                        <div key={item.optionId} className="space-y-1">
                          <div className="flex justify-between gap-2">
                            <span className="text-[var(--kws-ink)]">
                              {item.label}
                            </span>
                            <span className="font-mono-tabular font-semibold">
                              {item.count}
                            </span>
                          </div>
                          <ProgressBar
                            value={item.count}
                            max={analytics.totalSubmissions}
                            label={item.label}
                            accent="gold"
                          />
                        </div>
                      ))}
                    </div>
                  </Surface>

                  {/* January 2027 Cohort & Ikeja */}
                  <Surface className="p-5">
                    <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                      January 2027 Cohort Interest
                    </h2>
                    <div className="mt-3 space-y-2.5 text-xs">
                      {analytics.januaryCohortBreakdown.map((item) => (
                        <div key={item.optionId} className="space-y-1">
                          <div className="flex justify-between gap-2">
                            <span className="text-[var(--kws-ink)]">
                              {item.label}
                            </span>
                            <span className="font-mono-tabular font-semibold">
                              {item.count}
                            </span>
                          </div>
                          <ProgressBar
                            value={item.count}
                            max={analytics.totalSubmissions}
                            label={item.label}
                          />
                        </div>
                      ))}
                    </div>

                    {analytics.ikejaAttendanceBreakdown.length > 0 && (
                      <div className="mt-4 border-t border-[var(--kws-border)] pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                          Ikeja Practical Attendance
                        </p>
                        <div className="mt-2 space-y-1 text-xs">
                          {analytics.ikejaAttendanceBreakdown.map((item) => (
                            <div
                              key={item.label}
                              className="flex justify-between"
                            >
                              <span>{item.label}</span>
                              <span className="font-mono-tabular font-semibold">
                                {item.count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Surface>

                  {/* Campaign & Discovery Source Attribution */}
                  <Surface className="p-5 md:col-span-2">
                    <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                      Discovery &amp; Campaign Attribution
                    </h2>
                    <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                      {analytics.attributionBreakdown.map((attr) => (
                        <div
                          key={attr.source}
                          className="flex items-center justify-between rounded-md border border-[var(--kws-border)] px-3 py-2"
                        >
                          <span className="truncate pr-2 text-[var(--kws-ink)]">
                            {attr.source}
                          </span>
                          <span className="font-mono-tabular font-semibold">
                            {attr.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Surface>

                  {/* Campaign Performance & Cost per Completion */}
                  <Surface className="min-w-0 p-5 md:col-span-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                          Campaign Attribution Performance &amp; Spend
                        </h2>
                        <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
                          Starts, completions, consultation request rates,
                          conversions, and cost per completion (shown strictly
                          when real campaign spend is logged).
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-[var(--kws-border)] text-[var(--kws-muted)]">
                          <tr>
                            <th className="pb-2 pr-3 font-semibold">
                              Source / Medium / Campaign
                            </th>
                            <th className="pb-2 pr-3 font-semibold">
                              Ad Set / Creative / Placement
                            </th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Starts
                            </th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Comp.
                            </th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Comp. %
                            </th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Consult Req %
                            </th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Conv.
                            </th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Spend
                            </th>
                            <th className="pb-2 text-right font-semibold">
                              Cost / Comp.
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--kws-border)]">
                          {analytics.campaignPerformance.map((cp, idx) => (
                            <tr key={`${cp.campaignKey}-${idx}`}>
                              <td className="py-2 pr-3 text-[var(--kws-ink)]">
                                <span className="font-semibold">
                                  {cp.utmSource}
                                </span>{' '}
                                / {cp.utmMedium} / {cp.utmCampaign}
                              </td>
                              <td className="py-2 pr-3 font-mono-tabular text-[var(--kws-muted)]">
                                {cp.adSet} · {cp.creative} · {cp.placement}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular">
                                {cp.startsCount}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular">
                                {cp.completionsCount}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular">
                                {cp.completionRatePct !== null
                                  ? `${cp.completionRatePct}%`
                                  : '—'}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular">
                                {cp.consultationRequestRatePct !== null
                                  ? `${cp.consultationRequestRatePct}%`
                                  : '—'}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular">
                                {cp.conversionOutcomesCount}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular">
                                {cp.amountSpent !== null
                                  ? `${cp.currency ?? ''} ${cp.amountSpent.toLocaleString()}`
                                  : '—'}
                              </td>
                              <td className="py-2 text-right font-mono-tabular font-semibold text-[var(--kws-ink)]">
                                {cp.costPerCompletion !== null
                                  ? `${cp.currency ?? ''} ${cp.costPerCompletion.toLocaleString()}`
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {canEditConsultations && (
                      <form
                        onSubmit={handleSaveCampaignCost}
                        className="mt-5 grid grid-cols-1 gap-3 border-t border-[var(--kws-border)] pt-4 sm:grid-cols-5"
                      >
                        <input
                          type="text"
                          aria-label="Campaign UTM source"
                          value={costUtmSource}
                          onChange={(e) => setCostUtmSource(e.target.value)}
                          placeholder="utm_source (e.g. meta)"
                          className="rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-xs text-[var(--kws-ink)]"
                        />
                        <input
                          type="text"
                          aria-label="Campaign UTM name"
                          value={costUtmCampaign}
                          onChange={(e) => setCostUtmCampaign(e.target.value)}
                          placeholder="utm_campaign"
                          className="rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-xs text-[var(--kws-ink)]"
                        />
                        <input
                          type="text"
                          aria-label="Currency code"
                          value={costCurrency}
                          onChange={(e) => setCostCurrency(e.target.value)}
                          placeholder="NGN"
                          className="rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-xs text-[var(--kws-ink)]"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label="Campaign amount spent"
                          value={costAmount}
                          onChange={(e) => setCostAmount(e.target.value)}
                          placeholder="Total spend"
                          className="rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-xs text-[var(--kws-ink)]"
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          loading={savingCost}
                        >
                          Save Spend
                        </Button>
                        {costSavedMsg && (
                          <p className="text-xs text-[var(--kws-success)] sm:col-span-5">
                            {costSavedMsg}
                          </p>
                        )}
                      </form>
                    )}
                  </Surface>

                  {/* Question-Level Engagement, Active Time & Section Drop-off */}
                  <Surface className="min-w-0 p-5 md:col-span-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                          Question-Level Engagement &amp; Section Drop-Off
                        </h2>
                        <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
                          {analytics.questionAnalytics.timingNote}
                        </p>
                      </div>
                      <span className="font-mono-tabular text-xs text-[var(--kws-muted)]">
                        Abandoned / incomplete starts:{' '}
                        {analytics.questionAnalytics.totalAbandonedSessions}
                      </span>
                    </div>

                    {/* Section Drop-off Funnel */}
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                      {analytics.questionAnalytics.sectionDropOff.map((sec) => (
                        <div
                          key={sec.sectionId}
                          className="rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-3 text-xs"
                        >
                          <p className="font-semibold text-[var(--kws-ink)]">
                            Section {sec.code}
                          </p>
                          <p className="mt-1 font-mono-tabular text-[var(--kws-muted)]">
                            Entered: {sec.enteredCount} · Completed:{' '}
                            {sec.completedCount}
                          </p>
                          <p className="mt-0.5 font-mono-tabular font-semibold text-[var(--kws-ink)]">
                            Drop-off: {sec.dropOffCount} (
                            {sec.dropOffRatePct !== null
                              ? `${sec.dropOffRatePct}%`
                              : '—'}
                            )
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Longest & Shortest Active Questions */}
                    {analytics.questionAnalytics.longestActiveQuestions.length >
                      0 && (
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-[var(--kws-border)] p-3 text-xs">
                          <p className="font-semibold text-[var(--kws-ink)]">
                            Longest Active Interaction Questions
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {analytics.questionAnalytics.longestActiveQuestions.map(
                              (q) => (
                                <li
                                  key={`long-${q.questionId}`}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <span className="truncate text-[var(--kws-muted)]">
                                    {q.questionId}
                                  </span>
                                  <span className="font-mono-tabular font-semibold text-[var(--kws-ink)]">
                                    avg {q.avgActiveTimeSeconds}s / med{' '}
                                    {q.medianActiveTimeSeconds}s
                                  </span>
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                        <div className="rounded-lg border border-[var(--kws-border)] p-3 text-xs">
                          <p className="font-semibold text-[var(--kws-ink)]">
                            Shortest Active Interaction Questions
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {analytics.questionAnalytics.shortestActiveQuestions.map(
                              (q) => (
                                <li
                                  key={`short-${q.questionId}`}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <span className="truncate text-[var(--kws-muted)]">
                                    {q.questionId}
                                  </span>
                                  <span className="font-mono-tabular font-semibold text-[var(--kws-ink)]">
                                    avg {q.avgActiveTimeSeconds}s / med{' '}
                                    {q.medianActiveTimeSeconds}s
                                  </span>
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Per-Question Telemetry Table */}
                    <div className="mt-4 max-h-[380px] overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-[var(--kws-border)] text-[var(--kws-muted)]">
                          <tr>
                            <th className="pb-2 pr-3 font-semibold">Question</th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Views
                            </th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Resp.
                            </th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Avg Active
                            </th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Median Active
                            </th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Tab Inactive
                            </th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Changes
                            </th>
                            <th className="pb-2 pr-3 text-right font-semibold">
                              Back
                            </th>
                            <th className="pb-2 text-right font-semibold">
                              Drop-offs
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--kws-border)]">
                          {analytics.questionAnalytics.questions.map((q) => (
                            <tr key={q.questionId}>
                              <td className="max-w-xs truncate py-2 pr-3 text-[var(--kws-ink)]">
                                <span className="font-mono-tabular font-semibold">
                                  {q.questionId}
                                </span>{' '}
                                <span className="text-[var(--kws-muted)]">
                                  — {q.prompt}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular">
                                {q.viewsCount}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular">
                                {q.responsesCount}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular">
                                {q.avgActiveTimeSeconds !== null
                                  ? `${q.avgActiveTimeSeconds}s`
                                  : '—'}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular">
                                {q.medianActiveTimeSeconds !== null
                                  ? `${q.medianActiveTimeSeconds}s`
                                  : '—'}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular text-[var(--kws-muted)]">
                                {q.avgInactiveTimeSeconds !== null
                                  ? `${q.avgInactiveTimeSeconds}s`
                                  : '—'}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular">
                                {q.changesCount}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono-tabular">
                                {q.backClicksCount}
                              </td>
                              <td className="py-2 text-right font-mono-tabular">
                                {q.abandonmentsCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Surface>
                </div>
              )}
            </>
          )}

          {/* COMMUNICATIONS */}
          {route.view === 'communications' && (
            <AdminCommunicationsView
              records={records}
              staffRole={staffRole}
            />
          )}

          {/* QUESTION MANAGEMENT & VERSIONING */}
          {route.view === 'versions' && (
            <AdminVersionsView staffRole={staffRole} />
          )}

          {/* INTEGRATIONS & CRM READINESS */}
          {route.view === 'integrations' && (
            <AdminIntegrationsView
              records={records}
              staffRole={staffRole}
            />
          )}

          {/* EXPORTS & BACKUPS */}
          {route.view === 'exports' && (
            <>
              <div>
                <h1 className="font-display text-2xl font-bold text-[var(--kws-ink)]">
                  Filtered Exports &amp; Database Backups
                </h1>
                <p className="text-sm text-[var(--kws-muted)]">
                  Download CSV, Microsoft Excel (.xlsx), or full JSON archives
                  reflecting your active filters (Admin role required).
                </p>
              </div>

              {renderSharedFilterBar()}

              {!canExportData ? (
                <Surface className="p-6 text-sm text-[var(--kws-muted)]">
                  Bulk respondent exports and SQLite database backups are
                  restricted to the{' '}
                  <strong className="font-semibold text-[var(--kws-ink)]">
                    Admin
                  </strong>{' '}
                  role. Your current session role ({staffRole ?? 'viewer'}) does
                  not permit PII exports.
                </Surface>
              ) : (
                <>
                  <Surface subtle className="p-4 text-xs text-[var(--kws-muted)]">
                    Export scope:{' '}
                    <strong className="font-mono-tabular text-[var(--kws-ink)]">
                      {records.filter((r) => r.completionStatus === 'submitted').length}
                    </strong>{' '}
                    completed submission(s) matching current filters
                    {activeFilterCount > 0
                      ? ` (${activeFilterCount} filter(s) active)`
                      : ' (all completed submissions)'}
                    .
                  </Surface>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Surface className="flex flex-col justify-between p-5">
                      <div>
                        <FileSpreadsheet
                          className="h-6 w-6 text-[var(--kws-accent)]"
                          aria-hidden="true"
                        />
                        <h2 className="mt-3 font-display text-base font-bold text-[var(--kws-ink)]">
                          Excel Workbook (.xlsx)
                        </h2>
                        <p className="mt-1 text-xs text-[var(--kws-muted)]">
                          Formatted `.xlsx` spreadsheet with contact, survey,
                          versions, results, review category, and follow-up
                          logs.
                        </p>
                      </div>
                      <div className="mt-4">
                        <a
                          href={buildAdminExportUrl('xlsx', filters)}
                          download
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[image:var(--kws-gradient-btn)] px-4 py-2 text-sm font-semibold text-[var(--kws-btn-fg)] shadow-xs hover:brightness-110 transition-all"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          Download .xlsx
                        </a>
                      </div>
                    </Surface>

                    <Surface className="flex flex-col justify-between p-5">
                      <div>
                        <FileSpreadsheet
                          className="h-6 w-6 text-[var(--kws-accent)]"
                          aria-hidden="true"
                        />
                        <h2 className="mt-3 font-display text-base font-bold text-[var(--kws-ink)]">
                          CSV Spreadsheet
                        </h2>
                        <p className="mt-1 text-xs text-[var(--kws-muted)]">
                          UTF-8 BOM comma-separated export with formula
                          injection protection for spreadsheets and BI tools.
                        </p>
                      </div>
                      <div className="mt-4">
                        <a
                          href={buildAdminExportUrl('csv', filters)}
                          download
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-4 py-2 text-sm font-semibold text-[var(--kws-ink)] hover:border-[var(--kws-accent)] transition-colors"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          Download CSV
                        </a>
                      </div>
                    </Surface>

                    <Surface className="flex flex-col justify-between p-5">
                      <div>
                        <Download
                          className="h-6 w-6 text-[var(--kws-accent)]"
                          aria-hidden="true"
                        />
                        <h2 className="mt-3 font-display text-base font-bold text-[var(--kws-ink)]">
                          Full JSON Archive
                        </h2>
                        <p className="mt-1 text-xs text-[var(--kws-muted)]">
                          Complete structured records including verbatim raw
                          answers, version snapshots, and consultation review.
                        </p>
                      </div>
                      <div className="mt-4">
                        <a
                          href={buildAdminExportUrl('json', filters)}
                          download
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-4 py-2 text-sm font-semibold text-[var(--kws-ink)] hover:border-[var(--kws-accent)] transition-colors"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          Download JSON
                        </a>
                      </div>
                    </Surface>

                    <Surface className="flex flex-col justify-between p-5">
                      <div>
                        <Download
                          className="h-6 w-6 text-[var(--kws-accent)]"
                          aria-hidden="true"
                        />
                        <h2 className="mt-3 font-display text-base font-bold text-[var(--kws-ink)]">
                          SQLite Hot Backup
                        </h2>
                        <p className="mt-1 text-xs text-[var(--kws-muted)]">
                          Create a consistent SQLite snapshot via VACUUM INTO or
                          download the `.db` file.
                        </p>
                        {backupStatusMsg && (
                          <p className="mt-2 font-mono-tabular text-xs text-[var(--kws-success)]">
                            {backupStatusMsg}
                          </p>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={handleCreateBackup}
                          loading={creatingBackup}
                        >
                          Snapshot
                        </Button>
                        <a
                          href="/api/admin/backup/download"
                          download
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-xs font-semibold text-[var(--kws-ink)] hover:border-[var(--kws-accent)] transition-colors"
                        >
                          Download .db
                        </a>
                      </div>
                    </Surface>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
