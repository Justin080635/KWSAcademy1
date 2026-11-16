import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Plus,
  Sliders,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { PartAScoringConfig } from '../../domain/scoringConfig.ts';
import type {
  AssessmentOption,
  AssessmentQuestion,
  AssessmentSectionId,
  AssessmentVersionRecord,
  HumanReviewCategory,
  LeadSegmentationConfig,
  LeadSegmentationRule,
  QuestionKind,
  StaffRole,
  StyleId,
} from '../../domain/types.ts';
import {
  activateAssessmentVersion,
  ApiError,
  applyLeadSegmentationRules,
  createAssessmentVersion,
  fetchAssessmentVersions,
  fetchLeadSegmentationConfig,
  fetchPartAScoringConfig,
  saveLeadSegmentationConfig,
  savePartAScoringConfig,
} from '../../services/api.ts';
import { Button } from '../ui/Button.tsx';
import { Surface } from '../ui/Surface.tsx';

interface AdminVersionsViewProps {
  staffRole: StaffRole | null;
}

type VersionsSubTab = 'versions' | 'part_a_matrix' | 'segmentation';

const STYLE_CHOICES: Array<{ id: StyleId; label: string }> = [
  { id: 'STORYTELLER', label: 'Storyteller' },
  { id: 'STRATEGIST', label: 'Strategist' },
  { id: 'CREATOR', label: 'Creator' },
  { id: 'CONNECTOR', label: 'Connector' },
  { id: 'EXECUTOR', label: 'Executor' },
  { id: 'OPPORTUNITY_BUILDER', label: 'Opportunity Builder' },
];

const SECTION_CHOICES: Array<{ id: AssessmentSectionId; label: string }> = [
  { id: 'professional_style', label: 'Part A · Professional Style' },
  { id: 'growth_journey', label: 'Part B · Growth Journey' },
  { id: 'strengths_growth', label: 'Part C · Strengths & Growth' },
  { id: 'profile_next_steps', label: 'Part D · Profile & Next Steps' },
];

const KIND_CHOICES: Array<{ id: QuestionKind; label: string }> = [
  { id: 'orientation', label: 'Orientation (Part A)' },
  { id: 'growth_stage', label: 'Growth Stage (Part B)' },
  { id: 'growth_reflection', label: 'Growth Reflection (Part B)' },
  { id: 'capability_knowledge', label: 'Capability Understanding (Part C)' },
  { id: 'capability_experience', label: 'Capability Experience (Part C)' },
  { id: 'profile_survey', label: 'Profile Survey (Part D)' },
  { id: 'contact_details', label: 'Contact Details (Part D)' },
];

const TARGET_CATEGORY_CHOICES: Array<{
  value: Exclude<HumanReviewCategory, 'unreviewed'>;
  label: string;
}> = [
  { value: 'priority_consultation', label: 'Priority consultation' },
  { value: 'potential_consultation', label: 'Potential consultation' },
  { value: 'future_opportunity', label: 'Future opportunity' },
  { value: 'market_insight', label: 'Market insight' },
];

const CONDITION_QUESTION_IDS = [
  'profile_q03',
  'profile_q04',
  'profile_q05',
  'profile_q06',
  'profile_q07',
] as const;

export function AdminVersionsView({ staffRole }: AdminVersionsViewProps) {
  const isAdmin = staffRole === 'admin';
  const [subTab, setSubTab] = useState<VersionsSubTab>('versions');

  const [versions, setVersions] = useState<AssessmentVersionRecord[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [newVersionId, setNewVersionId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [activateImmediately, setActivateImmediately] = useState(false);
  const [draftQuestions, setDraftQuestions] = useState<AssessmentQuestion[]>(
    []
  );
  const [expandedOptionsIdx, setExpandedOptionsIdx] = useState<
    Record<number, boolean>
  >({});
  const [saving, setSaving] = useState(false);

  // Part A Scoring Matrix state
  const [partAConfig, setPartAConfig] = useState<PartAScoringConfig | null>(
    null
  );
  const [savingPartA, setSavingPartA] = useState(false);

  // Lead Segmentation state
  const [segConfig, setSegConfig] = useState<LeadSegmentationConfig | null>(
    null
  );
  const [savingSeg, setSavingSeg] = useState(false);
  const [applyingSeg, setApplyingSeg] = useState(false);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [verRes, scoringRes, segRes] = await Promise.all([
        fetchAssessmentVersions(),
        fetchPartAScoringConfig(),
        fetchLeadSegmentationConfig(),
      ]);
      setVersions(verRes.versions);
      setActiveVersionId(verRes.activeVersionId);
      setPartAConfig(scoringRes.config);
      setSegConfig(segRes.config);

      const active =
        verRes.versions.find((v) => v.versionId === verRes.activeVersionId) ??
        verRes.versions[0];
      if (active && draftQuestions.length === 0) {
        setDraftQuestions(JSON.parse(JSON.stringify(active.questions)));
        setNewVersionId(`${active.versionId}-r${verRes.versions.length + 1}`);
        setNewLabel(`${active.label} (Revision ${verRes.versions.length})`);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'Unable to load assessment versions & configuration.'
      );
    } finally {
      setLoading(false);
    }
  }, [draftQuestions.length]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const activeVersion =
    versions.find((v) => v.versionId === activeVersionId) ?? versions[0];
  const activeQuestionsList = activeVersion?.questions ?? draftQuestions;

  const handleActivate = async (versionId: string) => {
    if (!isAdmin) return;
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await activateAssessmentVersion(versionId);
      setStatusMsg(
        `Version ${versionId} activated for new respondents. Historical submissions remain linked to their original versions.`
      );
      await loadVersions();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'Failed to activate assessment version.'
      );
    }
  };

  const handleMoveQuestion = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= draftQuestions.length) return;
    setDraftQuestions((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const handleUpdateQuestion = (
    index: number,
    patch: Partial<AssessmentQuestion>
  ) => {
    setDraftQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q))
    );
  };

  const handleUpdateOption = (
    qIndex: number,
    optIndex: number,
    patch: Partial<AssessmentOption>
  ) => {
    setDraftQuestions((prev) =>
      prev.map((q, i) =>
        i !== qIndex
          ? q
          : {
              ...q,
              options: q.options.map((opt, oi) =>
                oi === optIndex ? { ...opt, ...patch } : opt
              ),
            }
      )
    );
  };

  const handleAddOption = (qIndex: number) => {
    setDraftQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const stamp = Date.now().toString(36).slice(-4);
        return {
          ...q,
          options: [
            ...q.options,
            { id: `${q.id}_opt_${stamp}`, label: 'New option label' },
          ],
        };
      })
    );
  };

  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    setDraftQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || q.options.length <= 2) return q;
        return {
          ...q,
          options: q.options.filter((_, oi) => oi !== optIndex),
        };
      })
    );
  };

  const handleRemoveQuestion = (index: number) => {
    if (draftQuestions.length <= 1) return;
    setDraftQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddQuestion = () => {
    const stamp = Date.now().toString(36).slice(-4);
    const sectionId: AssessmentSectionId = 'profile_next_steps';
    const qId = `custom_q_${stamp}`;
    setDraftQuestions((prev) => [
      ...prev,
      {
        id: qId,
        sectionId,
        kind: 'profile_survey',
        active: true,
        prompt: 'New question prompt',
        options: [
          { id: `${qId}_a`, label: 'Option A' },
          { id: `${qId}_b`, label: 'Option B' },
        ],
      },
    ]);
  };

  const handlePublishNewVersion = async () => {
    if (!isAdmin) return;
    if (!newVersionId.trim() || !changeSummary.trim()) {
      setErrorMsg(
        'Provide a unique version ID and change summary before creating a new immutable version.'
      );
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const created = await createAssessmentVersion({
        versionId: newVersionId.trim(),
        label: newLabel.trim() || newVersionId.trim(),
        changeSummary: changeSummary.trim(),
        questions: draftQuestions,
        activateImmediately,
      });
      setStatusMsg(
        `Created immutable version ${created.versionId} (${created.status}).`
      );
      setChangeSummary('');
      await loadVersions();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'Failed to create new assessment version.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSavePartAConfig = async () => {
    if (!isAdmin || !partAConfig) return;
    setSavingPartA(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const saved = await savePartAScoringConfig(partAConfig);
      setPartAConfig(saved);
      setStatusMsg(
        saved.approved
          ? 'Part A scoring matrix saved and approved for live discovery reports.'
          : 'Part A scoring matrix draft saved (still pending approval).'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'Failed to save Part A scoring configuration.'
      );
    } finally {
      setSavingPartA(false);
    }
  };

  const handleAddSegmentationRule = () => {
    if (!segConfig) return;
    const stamp = Date.now().toString(36).slice(-4);
    const nextRule: LeadSegmentationRule = {
      id: `rule_${stamp}`,
      label: 'New segmentation rule',
      enabled: true,
      targetCategory: 'potential_consultation',
      priorityRank: segConfig.rules.length + 1,
      conditions: {},
    };
    setSegConfig({
      ...segConfig,
      rules: [...segConfig.rules, nextRule],
    });
  };

  const handleToggleRuleCondition = (
    ruleId: string,
    questionId: string,
    optionId: string
  ) => {
    if (!segConfig) return;
    setSegConfig({
      ...segConfig,
      rules: segConfig.rules.map((r) => {
        if (r.id !== ruleId) return r;
        const current = r.conditions[questionId] ?? [];
        const exists = current.includes(optionId);
        const updatedList = exists
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        const nextConditions = { ...r.conditions };
        if (updatedList.length === 0) {
          delete nextConditions[questionId];
        } else {
          nextConditions[questionId] = updatedList;
        }
        return { ...r, conditions: nextConditions };
      }),
    });
  };

  const handleSaveSegmentation = async () => {
    if (!isAdmin || !segConfig) return;
    setSavingSeg(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const saved = await saveLeadSegmentationConfig(segConfig);
      setSegConfig(saved);
      setStatusMsg(
        saved.approved
          ? 'Lead segmentation rules saved and activated for incoming submissions.'
          : 'Lead segmentation draft saved (auto-categorization remains off).'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'Failed to save lead segmentation rules.'
      );
    } finally {
      setSavingSeg(false);
    }
  };

  const handleApplySegmentation = async () => {
    if (!isAdmin) return;
    setApplyingSeg(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await applyLeadSegmentationRules();
      setStatusMsg(
        `Applied approved segmentation rules: updated ${res.updatedCount} unreviewed record(s), preserved ${res.skippedManualCount} manual staff review(s).`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'Unable to apply lead segmentation rules.'
      );
    } finally {
      setApplyingSeg(false);
    }
  };

  const orientationQuestions = activeQuestionsList.filter(
    (q) => q.kind === 'orientation' && q.active !== false
  );
  const totalOrientationOptions = orientationQuestions.reduce(
    (sum, q) => sum + q.options.length,
    0
  );
  const mappedOrientationOptions = partAConfig
    ? orientationQuestions.reduce(
        (sum, q) =>
          sum +
          q.options.filter((opt) => Boolean(partAConfig.optionToStyle[opt.id]))
            .length,
        0
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--kws-ink)]">
            Question Management, Scoring &amp; Segmentation
          </h1>
          <p className="text-sm text-[var(--kws-muted)]">
            Manage immutable assessment versions, configure approved Part A
            style mappings, and maintain internal lead segmentation rules.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Configuration sections"
          className="flex flex-wrap gap-1 rounded-lg bg-[var(--kws-surface-subtle)] p-1 text-xs"
        >
          {(
            [
              ['versions', 'Question Versions', GitBranch],
              ['part_a_matrix', 'Part A Scoring Matrix', Sliders],
              ['segmentation', 'Lead Segmentation Rules', Sparkles],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={subTab === key}
              onClick={() => {
                setSubTab(key);
                setErrorMsg(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-colors cursor-pointer ${
                subTab === key
                  ? 'bg-[var(--kws-surface)] text-[var(--kws-ink)] shadow-xs'
                  : 'text-[var(--kws-muted)] hover:text-[var(--kws-ink)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
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

      {statusMsg && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface-subtle)] p-4 text-sm text-[var(--kws-ink)]">
          <Check
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kws-success)]"
            aria-hidden="true"
          />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* TAB 1: QUESTION VERSIONS */}
      {subTab === 'versions' && (
        <>
          <Surface className="p-5">
            <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
              Immutable Assessment Versions
            </h2>
            <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
              Active version:{' '}
              <strong className="font-mono-tabular text-[var(--kws-ink)]">
                {activeVersionId || 'Loading...'}
              </strong>
            </p>

            {loading ? (
              <p className="mt-4 text-sm text-[var(--kws-muted)]">
                Loading version history...
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--kws-border)] text-[var(--kws-muted)]">
                    <tr>
                      <th className="pb-2 pr-3 font-semibold">Version ID</th>
                      <th className="pb-2 pr-3 font-semibold">Label</th>
                      <th className="pb-2 pr-3 font-semibold">Status</th>
                      <th className="pb-2 pr-3 font-semibold">Active Qs</th>
                      <th className="pb-2 pr-3 font-semibold">Change Summary</th>
                      <th className="pb-2 pr-3 font-semibold">Created</th>
                      {isAdmin && (
                        <th className="pb-2 text-right font-semibold">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--kws-border)]">
                    {versions.map((ver) => (
                      <tr key={ver.versionId}>
                        <td className="py-2.5 pr-3 font-mono-tabular font-semibold text-[var(--kws-ink)]">
                          {ver.versionId}
                        </td>
                        <td className="py-2.5 pr-3 text-[var(--kws-ink)]">
                          {ver.label}
                        </td>
                        <td className="py-2.5 pr-3 font-mono-tabular font-semibold">
                          <span
                            className={
                              ver.status === 'active'
                                ? 'text-[var(--kws-success)]'
                                : 'text-[var(--kws-muted)]'
                            }
                          >
                            {ver.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 font-mono-tabular text-[var(--kws-muted)]">
                          {ver.questions.filter((q) => q.active !== false).length}
                          /{ver.questions.length}
                        </td>
                        <td className="max-w-xs py-2.5 pr-3 text-[var(--kws-muted)]">
                          {ver.changeSummary}
                        </td>
                        <td className="py-2.5 pr-3 font-mono-tabular text-[var(--kws-muted)]">
                          {ver.createdAt.slice(0, 10)}
                        </td>
                        {isAdmin && (
                          <td className="py-2.5 text-right whitespace-nowrap">
                            {ver.status !== 'active' ? (
                              <Button
                                variant="secondary"
                                size="md"
                                onClick={() => handleActivate(ver.versionId)}
                              >
                                Activate
                              </Button>
                            ) : (
                              <span className="font-mono-tabular text-[var(--kws-muted)]">
                                In use
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>

          <Surface className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--kws-border)] pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                  Prepare New Question Version
                </h2>
                <p className="text-xs text-[var(--kws-muted)]">
                  Add, edit options, deactivate, or reorder questions below,
                  then publish as an immutable version ID.
                </p>
              </div>
              {isAdmin && (
                <Button variant="secondary" onClick={handleAddQuestion}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add Question
                </Button>
              )}
            </div>

            {!isAdmin ? (
              <p className="mt-4 text-sm text-[var(--kws-muted)]">
                Only Admin role accounts can create or activate assessment
                question versions.
              </p>
            ) : (
              <div className="mt-4 space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="ver-id"
                      className="block text-xs font-semibold text-[var(--kws-muted)]"
                    >
                      New Version ID
                    </label>
                    <input
                      id="ver-id"
                      type="text"
                      value={newVersionId}
                      onChange={(e) => setNewVersionId(e.target.value)}
                      placeholder="kws-assessment-v2.1"
                      className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 font-mono-tabular text-sm text-[var(--kws-ink)]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ver-label"
                      className="block text-xs font-semibold text-[var(--kws-muted)]"
                    >
                      Version Label
                    </label>
                    <input
                      id="ver-label"
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Cohort 2027 Revision"
                      className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ver-summary"
                      className="block text-xs font-semibold text-[var(--kws-muted)]"
                    >
                      Change Summary
                    </label>
                    <input
                      id="ver-summary"
                      type="text"
                      value={changeSummary}
                      onChange={(e) => setChangeSummary(e.target.value)}
                      placeholder="Describe edits or additions..."
                      className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)]"
                    />
                  </div>
                </div>

                <div className="max-h-[540px] space-y-2.5 overflow-y-auto pr-1">
                  {draftQuestions.map((q, idx) => {
                    const isDeactivated = q.active === false;
                    const optionsOpen = Boolean(expandedOptionsIdx[idx]);
                    return (
                      <div
                        key={`${q.id}-${idx}`}
                        className={`rounded-lg border p-3 ${
                          isDeactivated
                            ? 'border-[var(--kws-border)] bg-[var(--kws-bg)] opacity-70'
                            : 'border-[var(--kws-border)] bg-[var(--kws-surface-subtle)]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono-tabular font-semibold text-[var(--kws-ink)]">
                              {idx + 1}. {q.id}
                            </span>
                            <select
                              aria-label={`Section for ${q.id}`}
                              value={q.sectionId}
                              onChange={(e) =>
                                handleUpdateQuestion(idx, {
                                  sectionId: e.target
                                    .value as AssessmentSectionId,
                                })
                              }
                              className="rounded border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2 py-1 text-xs text-[var(--kws-ink)]"
                            >
                              {SECTION_CHOICES.map((sec) => (
                                <option key={sec.id} value={sec.id}>
                                  {sec.label}
                                </option>
                              ))}
                            </select>
                            <select
                              aria-label={`Kind for ${q.id}`}
                              value={q.kind}
                              onChange={(e) =>
                                handleUpdateQuestion(idx, {
                                  kind: e.target.value as QuestionKind,
                                })
                              }
                              className="rounded border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2 py-1 text-xs text-[var(--kws-ink)]"
                            >
                              {KIND_CHOICES.map((kd) => (
                                <option key={kd.id} value={kd.id}>
                                  {kd.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQuestion(idx, {
                                  active: isDeactivated,
                                })
                              }
                              className={`rounded border px-2 py-1 text-xs font-semibold cursor-pointer ${
                                isDeactivated
                                  ? 'border-[var(--kws-border-strong)] bg-[var(--kws-surface)] text-[var(--kws-muted)]'
                                  : 'border-[var(--kws-success)]/40 bg-[var(--kws-success-surface)] text-[var(--kws-success)]'
                              }`}
                            >
                              {isDeactivated ? 'Deactivated' : 'Active'}
                            </button>
                            {q.kind !== 'contact_details' && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedOptionsIdx((prev) => ({
                                    ...prev,
                                    [idx]: !prev[idx],
                                  }))
                                }
                                className="inline-flex items-center gap-1 rounded border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2 py-1 text-xs font-medium text-[var(--kws-ink)] cursor-pointer"
                              >
                                {q.options.length} options
                                {optionsOpen ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`Move ${q.id} up`}
                              disabled={idx === 0}
                              onClick={() => handleMoveQuestion(idx, -1)}
                              className="rounded border border-[var(--kws-border-strong)] p-1.5 text-[var(--kws-ink)] disabled:opacity-40 cursor-pointer"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move ${q.id} down`}
                              disabled={idx === draftQuestions.length - 1}
                              onClick={() => handleMoveQuestion(idx, 1)}
                              className="rounded border border-[var(--kws-border-strong)] p-1.5 text-[var(--kws-ink)] disabled:opacity-40 cursor-pointer"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${q.id}`}
                              onClick={() => handleRemoveQuestion(idx)}
                              className="rounded border border-[var(--kws-border-strong)] p-1.5 text-[var(--kws-danger)] cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          aria-label={`Prompt for ${q.id}`}
                          value={q.prompt}
                          onChange={(e) =>
                            handleUpdateQuestion(idx, {
                              prompt: e.target.value,
                            })
                          }
                          className="mt-2 w-full rounded border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-sm text-[var(--kws-ink)]"
                        />

                        {optionsOpen && q.kind !== 'contact_details' && (
                          <div className="mt-3 space-y-2 border-t border-[var(--kws-border)] pt-2.5">
                            {q.options.map((opt, oi) => (
                              <div
                                key={`${opt.id}-${oi}`}
                                className="flex flex-wrap items-center gap-2 text-xs"
                              >
                                <span className="w-28 shrink-0 truncate font-mono-tabular text-[var(--kws-muted)]">
                                  {opt.id}
                                </span>
                                <input
                                  type="text"
                                  aria-label={`Option label for ${opt.id}`}
                                  value={opt.label}
                                  onChange={(e) =>
                                    handleUpdateOption(idx, oi, {
                                      label: e.target.value,
                                    })
                                  }
                                  className="min-w-[180px] flex-1 rounded border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2 py-1 text-xs text-[var(--kws-ink)]"
                                />
                                <label className="inline-flex items-center gap-1 text-[11px] text-[var(--kws-muted)]">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(opt.requiresOtherText)}
                                    onChange={(e) =>
                                      handleUpdateOption(idx, oi, {
                                        requiresOtherText: e.target.checked,
                                      })
                                    }
                                    className="accent-[var(--kws-accent)]"
                                  />
                                  Other text
                                </label>
                                <label className="inline-flex items-center gap-1 text-[11px] text-[var(--kws-muted)]">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(opt.requiresInstitution)}
                                    onChange={(e) =>
                                      handleUpdateOption(idx, oi, {
                                        requiresInstitution: e.target.checked,
                                      })
                                    }
                                    className="accent-[var(--kws-accent)]"
                                  />
                                  Institution
                                </label>
                                <button
                                  type="button"
                                  disabled={q.options.length <= 2}
                                  onClick={() => handleRemoveOption(idx, oi)}
                                  className="rounded border border-[var(--kws-border-strong)] p-1 text-[var(--kws-danger)] disabled:opacity-30 cursor-pointer"
                                  aria-label={`Delete option ${opt.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <Button
                              variant="secondary"
                              size="md"
                              onClick={() => handleAddOption(idx)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add Option
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--kws-border)] pt-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--kws-ink)]">
                    <input
                      type="checkbox"
                      checked={activateImmediately}
                      onChange={(e) =>
                        setActivateImmediately(e.target.checked)
                      }
                      className="h-4 w-4 rounded border-[var(--kws-border-strong)] accent-[var(--kws-accent)]"
                    />
                    Activate this new version immediately for upcoming
                    respondents
                  </label>

                  <Button
                    variant="primary"
                    loading={saving}
                    onClick={handlePublishNewVersion}
                  >
                    <GitBranch className="h-4 w-4" aria-hidden="true" />
                    Save New Immutable Version
                  </Button>
                </div>
              </div>
            )}
          </Surface>
        </>
      )}

      {/* TAB 2: PART A SCORING MATRIX */}
      {subTab === 'part_a_matrix' && (
        <Surface className="p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--kws-border)] pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                Part A · Professional Style Option Mapping
              </h2>
              <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
                Map every active Section A orientation option to one of the six
                approved KWS Professional Styles. Until approved with 100%
                mapping coverage, live results honestly show pending
                configuration.
              </p>
            </div>
            <div className="text-right font-mono-tabular text-xs">
              <p
                className={`font-semibold ${
                  partAConfig?.approved
                    ? 'text-[var(--kws-success)]'
                    : 'text-[var(--kws-gold-ink)]'
                }`}
              >
                {partAConfig?.approved
                  ? 'Approved & Active'
                  : 'Pending KWS Approval'}
              </p>
              <p className="text-[var(--kws-muted)]">
                Mapped {mappedOrientationOptions} / {totalOrientationOptions}{' '}
                options
              </p>
            </div>
          </div>

          {!partAConfig ? (
            <p className="text-sm text-[var(--kws-muted)]">
              Loading Part A scoring matrix...
            </p>
          ) : (
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="parta-notes"
                  className="block text-xs font-semibold text-[var(--kws-muted)]"
                >
                  Approval / audit notes
                </label>
                <input
                  id="parta-notes"
                  type="text"
                  disabled={!isAdmin}
                  value={partAConfig.notes}
                  onChange={(e) =>
                    setPartAConfig({ ...partAConfig, notes: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)] disabled:opacity-60"
                />
              </div>

              <div className="space-y-4">
                {orientationQuestions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="rounded-xl border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-4"
                  >
                    <p className="font-display text-sm font-bold text-[var(--kws-ink)]">
                      A{qIdx + 1}. {q.prompt}
                    </p>
                    <div className="mt-3 space-y-2">
                      {q.options.map((opt) => (
                        <div
                          key={opt.id}
                          className="grid grid-cols-1 items-center gap-2 sm:grid-cols-12"
                        >
                          <span className="text-xs text-[var(--kws-ink)] sm:col-span-8">
                            <span className="mr-1.5 font-mono-tabular text-[11px] text-[var(--kws-muted)]">
                              [{opt.id}]
                            </span>
                            {opt.label}
                          </span>
                          <select
                            aria-label={`Style mapping for ${opt.id}`}
                            disabled={!isAdmin}
                            value={partAConfig.optionToStyle[opt.id] ?? ''}
                            onChange={(e) =>
                              setPartAConfig({
                                ...partAConfig,
                                optionToStyle: {
                                  ...partAConfig.optionToStyle,
                                  [opt.id]: (e.target.value ||
                                    null) as StyleId | null,
                                },
                              })
                            }
                            className="rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-xs text-[var(--kws-ink)] disabled:opacity-60 sm:col-span-4"
                          >
                            <option value="">Unmapped (null)</option>
                            {STYLE_CHOICES.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {isAdmin && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--kws-border)] pt-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--kws-ink)]">
                    <input
                      type="checkbox"
                      checked={partAConfig.approved}
                      onChange={(e) =>
                        setPartAConfig({
                          ...partAConfig,
                          approved: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-[var(--kws-border-strong)] accent-[var(--kws-accent)]"
                    />
                    Approve matrix for live Professional Style scoring
                  </label>

                  <Button
                    variant="primary"
                    loading={savingPartA}
                    onClick={handleSavePartAConfig}
                  >
                    Save Part A Matrix
                  </Button>
                </div>
              )}
            </div>
          )}
        </Surface>
      )}

      {/* TAB 3: LEAD SEGMENTATION RULES */}
      {subTab === 'segmentation' && (
        <Surface className="p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--kws-border)] pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--kws-ink)]">
                Internal Lead Segmentation Rules
              </h2>
              <p className="mt-0.5 text-xs text-[var(--kws-muted)]">
                Configure internal sales qualification rules for Priority
                Consultation, Potential Consultation, Future Opportunity, and
                Market Insight. Staff manual overrides are always preserved and
                never exposed to respondents.
              </p>
            </div>
            <div className="text-right font-mono-tabular text-xs">
              <p
                className={`font-semibold ${
                  segConfig?.approved
                    ? 'text-[var(--kws-success)]'
                    : 'text-[var(--kws-gold-ink)]'
                }`}
              >
                {segConfig?.approved
                  ? 'Approved & Active'
                  : 'Pending Approval — Manual Review Only'}
              </p>
              <p className="text-[var(--kws-muted)]">
                {segConfig?.rules.filter((r) => r.enabled).length ?? 0} enabled
                rule(s)
              </p>
            </div>
          </div>

          {!segConfig ? (
            <p className="text-sm text-[var(--kws-muted)]">
              Loading lead segmentation configuration...
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="seg-default-cat"
                    className="block text-xs font-semibold text-[var(--kws-muted)]"
                  >
                    Fallback category when no rule matches
                  </label>
                  <select
                    id="seg-default-cat"
                    disabled={!isAdmin}
                    value={segConfig.defaultCategory}
                    onChange={(e) =>
                      setSegConfig({
                        ...segConfig,
                        defaultCategory: e.target.value as HumanReviewCategory,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)] disabled:opacity-60"
                  >
                    <option value="unreviewed">Unreviewed</option>
                    {TARGET_CATEGORY_CHOICES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="seg-notes"
                    className="block text-xs font-semibold text-[var(--kws-muted)]"
                  >
                    Segmentation policy notes
                  </label>
                  <input
                    id="seg-notes"
                    type="text"
                    disabled={!isAdmin}
                    value={segConfig.notes}
                    onChange={(e) =>
                      setSegConfig({ ...segConfig, notes: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-3 py-2 text-sm text-[var(--kws-ink)] disabled:opacity-60"
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--kws-muted)]">
                    Priority-ordered rules (first matching rule applies)
                  </p>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleAddSegmentationRule}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add Rule
                  </Button>
                </div>
              )}

              {segConfig.rules.length === 0 ? (
                <p className="rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-4 text-xs text-[var(--kws-muted)]">
                  No segmentation rules configured yet. All incoming submissions
                  remain Unreviewed until staff manually categorize them or
                  configure and approve rules here.
                </p>
              ) : (
                <div className="space-y-4">
                  {segConfig.rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-xl border border-[var(--kws-border)] bg-[var(--kws-surface-subtle)] p-4 space-y-3"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-semibold text-[var(--kws-muted)]">
                            Rule label
                          </label>
                          <input
                            type="text"
                            disabled={!isAdmin}
                            value={rule.label}
                            onChange={(e) =>
                              setSegConfig({
                                ...segConfig,
                                rules: segConfig.rules.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, label: e.target.value }
                                    : r
                                ),
                              })
                            }
                            className="mt-0.5 w-full rounded border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-xs text-[var(--kws-ink)]"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-semibold text-[var(--kws-muted)]">
                            Assign category
                          </label>
                          <select
                            disabled={!isAdmin}
                            value={rule.targetCategory}
                            onChange={(e) =>
                              setSegConfig({
                                ...segConfig,
                                rules: segConfig.rules.map((r) =>
                                  r.id === rule.id
                                    ? {
                                        ...r,
                                        targetCategory: e.target
                                          .value as Exclude<
                                          HumanReviewCategory,
                                          'unreviewed'
                                        >,
                                      }
                                    : r
                                ),
                              })
                            }
                            className="mt-0.5 w-full rounded border border-[var(--kws-border-strong)] bg-[var(--kws-surface)] px-2.5 py-1.5 text-xs text-[var(--kws-ink)]"
                          >
                            {TARGET_CATEGORY_CHOICES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-end justify-between gap-2 sm:col-span-3">
                          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--kws-ink)]">
                            <input
                              type="checkbox"
                              disabled={!isAdmin}
                              checked={rule.enabled}
                              onChange={(e) =>
                                setSegConfig({
                                  ...segConfig,
                                  rules: segConfig.rules.map((r) =>
                                    r.id === rule.id
                                      ? { ...r, enabled: e.target.checked }
                                      : r
                                  ),
                                })
                              }
                              className="accent-[var(--kws-accent)]"
                            />
                            Enabled
                          </label>
                          {isAdmin && (
                            <button
                              type="button"
                              aria-label={`Delete rule ${rule.label}`}
                              onClick={() =>
                                setSegConfig({
                                  ...segConfig,
                                  rules: segConfig.rules.filter(
                                    (r) => r.id !== rule.id
                                  ),
                                })
                              }
                              className="rounded border border-[var(--kws-border-strong)] p-1.5 text-[var(--kws-danger)] cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-[var(--kws-border)] pt-3">
                        <p className="text-[11px] font-semibold text-[var(--kws-muted)]">
                          Match conditions (respondent must satisfy all selected
                          criteria):
                        </p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {CONDITION_QUESTION_IDS.map((qId) => {
                            const question = activeQuestionsList.find(
                              (q) => q.id === qId
                            );
                            if (!question) return null;
                            const chosen = rule.conditions[qId] ?? [];
                            return (
                              <div
                                key={`${rule.id}-${qId}`}
                                className="rounded-lg border border-[var(--kws-border)] bg-[var(--kws-surface)] p-2.5 text-xs"
                              >
                                <p className="font-semibold text-[var(--kws-ink)]">
                                  {question.prompt}
                                </p>
                                <div className="mt-1.5 space-y-1">
                                  {question.options.map((opt) => (
                                    <label
                                      key={opt.id}
                                      className="flex cursor-pointer items-start gap-2 text-[11px] text-[var(--kws-muted)]"
                                    >
                                      <input
                                        type="checkbox"
                                        disabled={!isAdmin}
                                        checked={chosen.includes(opt.id)}
                                        onChange={() =>
                                          handleToggleRuleCondition(
                                            rule.id,
                                            qId,
                                            opt.id
                                          )
                                        }
                                        className="mt-0.5 accent-[var(--kws-accent)]"
                                      />
                                      <span>{opt.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isAdmin && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--kws-border)] pt-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--kws-ink)]">
                    <input
                      type="checkbox"
                      checked={segConfig.approved}
                      onChange={(e) =>
                        setSegConfig({
                          ...segConfig,
                          approved: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-[var(--kws-border-strong)] accent-[var(--kws-accent)]"
                    />
                    Approve &amp; activate automatic segmentation on new
                    submissions
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      loading={applyingSeg}
                      disabled={!segConfig.approved}
                      onClick={handleApplySegmentation}
                    >
                      Apply Rules to Unreviewed
                    </Button>
                    <Button
                      variant="primary"
                      loading={savingSeg}
                      onClick={handleSaveSegmentation}
                    >
                      Save Segmentation Config
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Surface>
      )}
    </div>
  );
}
