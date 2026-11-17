export type StyleId =
  | 'STORYTELLER'
  | 'STRATEGIST'
  | 'CREATOR'
  | 'CONNECTOR'
  | 'EXECUTOR'
  | 'OPPORTUNITY_BUILDER';

export type ArchetypePattern =
  | 'dominant'
  | 'blend'
  | 'co_leading'
  | 'clustered'
  | 'broad';

export type GrowthStageLevel = 1 | 2 | 3 | 4 | 5;

export type PillarId =
  | 'media_industry_intelligence'
  | 'marketing_brand_strategy'
  | 'strategic_communications_storytelling'
  | 'digital_content_media_production'
  | 'campaign_project_execution'
  | 'creative_business_professional_development';

export type AssessmentSectionId =
  | 'professional_style'
  | 'growth_journey'
  | 'strengths_growth'
  | 'profile_next_steps';

export type QuestionKind =
  | 'orientation'
  | 'growth_stage'
  | 'growth_reflection'
  | 'capability_knowledge'
  | 'capability_experience'
  | 'profile_survey'
  | 'contact_details';

export interface StyleDefinition {
  id: StyleId;
  name: string;
  tagline: string;
  description: string;
  likelyContributions: string[];
  blindSpot: string;
  reflectionPrompt: string;
}

export interface GrowthStageDefinition {
  level: GrowthStageLevel;
  name: string;
  description: string;
  typicalPriority: string;
  suggestedProgressDirection: string;
}

export interface PillarDefinition {
  id: PillarId;
  name: string;
}

export interface AssessmentSectionMeta {
  id: AssessmentSectionId;
  code: 'A' | 'B' | 'C' | 'D';
  partLabel: string;
  title: string;
  navLabel: string;
  instructions: string;
}

export interface AssessmentOption {
  id: string;
  key?: string;
  label: string;
  requiresOtherText?: boolean;
  requiresInstitution?: boolean;
  consultationIntent?: 'book' | 'more_info' | 'none';
}

export interface PartDConditionalQuestion {
  id: string;
  showIf: string;
  text: string;
  type: string;
}

export interface AssessmentQuestion {
  id: string;
  sectionId: AssessmentSectionId;
  kind: QuestionKind;
  prompt: string;
  pillarId?: PillarId;
  active?: boolean;
  options: AssessmentOption[];
}

export interface CapabilityCardDefinition {
  id: string;
  pillar: PillarDefinition;
  index: number;
  understandingQuestion: AssessmentQuestion;
  experienceQuestion: AssessmentQuestion;
}

export type AssessmentStep =
  | {
      id: string;
      kind: 'question';
      sectionId: AssessmentSectionId;
      question: AssessmentQuestion;
    }
  | {
      id: string;
      kind: 'capability_card';
      sectionId: 'strengths_growth';
      card: CapabilityCardDefinition;
    };

export interface RespondentContact {
  fullName: string;
  whatsappNumber: string;
  email: string;
  city: string;
  state: string;
  institution: string;
  whatsappConsent: boolean;
}

export interface RespondentAnswers {
  selections: Record<string, string>;
  otherText: Record<string, string>;
  contact: RespondentContact;
}

export interface PilotFeedback {
  archetypeFits: 'Yes' | 'Partly' | 'No' | '';
  stageFits: 'Yes' | 'Partly' | 'No' | '';
  notes: string;
  submittedAt?: string;
}

export interface StyleScoreItem {
  styleId: StyleId;
  name: string;
  count: number;
}

export interface StyleDetailPayload {
  styleId: StyleId;
  name: string;
  tagline: string;
  description: string;
  likelyContributions: string[];
  blindSpot: string;
  reflectionPrompt: string;
}

export interface ProfessionalStyleResult {
  status: 'complete' | 'incomplete_configuration';
  configurationMessage: string;
  missingOptionIds: string[];
  pattern: ArchetypePattern | null;
  leadTitle: string;
  summary: string;
  leadingStyles: StyleDetailPayload[];
  secondaryStyle: StyleDetailPayload | null;
  reflectionPrompt: string;
  styleScores: StyleScoreItem[];
}

export interface GrowthRawResponse {
  questionId: string;
  optionId: string;
  value: GrowthStageLevel;
}

export interface GrowthJourneyResult {
  indicativeStage: GrowthStageDefinition;
  rawResponses: GrowthRawResponse[];
  unroundedAverage: number;
  roundedStageLevel: GrowthStageLevel;
  spread: number;
  mixedStageFlag: boolean;
  supportingPatternSummary: string;
  suggestedProgressDirection: string;
  biggestChallengeText: string;
  twelveMonthProgressText: string;
}

export interface CapabilityResultItem {
  pillarId: PillarId;
  name: string;
  understandingScore: 0 | 1;
  experienceScore: 0 | 1 | 2 | 3 | 4;
  experienceLabel: string;
  constructiveInterpretation: string;
}

export interface DevelopmentPriorityItem {
  id: string;
  title: string;
  explanation: string;
  practicalNextStep: string;
}

export interface NextStepResult {
  wantsConsultation: boolean;
  consultationIntent: 'book' | 'more_info' | 'none';
  headline: string;
  description: string;
  invitationNote: string;
}

export type CircularMetricTone = 'accent' | 'gold' | 'success' | 'muted';

export interface CircularMetricSpec {
  id: string;
  label: string;
  value: number;
  max: number;
  displayValue: string;
  sublabel: string;
  tone: CircularMetricTone;
  segments?: number;
  isPending?: boolean;
}

export interface PillarInsightResult {
  insightId: string;
  pillarId: AssessmentSectionId;
  sectionCode: 'A' | 'B' | 'C' | 'D';
  priority: number;
  patternKey: string;
  headline: string;
  message: string;
  secondaryObservation?: string;
  curiosityHook?: string;
  ctaLabel: string;
  spotlightLabel?: string;
  primaryMetric: CircularMetricSpec;
  secondaryMetric?: CircularMetricSpec;
  previewSummary: {
    unlockedLabel: string;
    unlockedDetail: string;
    obscuredHint: string;
    partAConfigApproved: boolean;
  };
  isFallback: boolean;
}

export interface AssessmentPillarInsightsBundle {
  professionalStyle: PillarInsightResult;
  growthJourney: PillarInsightResult;
  strengthsGrowth: PillarInsightResult;
  profileNextSteps: PillarInsightResult;
}

export interface AssessmentResult {
  scoringVersion: string;
  generatedAt: string;
  disclaimer: string;
  professionalStyle: ProfessionalStyleResult;
  growthJourney: GrowthJourneyResult;
  capabilities: CapabilityResultItem[];
  developmentPriorities: DevelopmentPriorityItem[];
  nextStep: NextStepResult;
  pillarInsights?: AssessmentPillarInsightsBundle;
}

export type ConsultationStatus =
  | 'requested'
  | 'awaiting_review'
  | 'approved_for_contact'
  | 'contact_attempted'
  | 'contacted'
  | 'scheduled'
  | 'completed'
  | 'no_response'
  | 'declined'
  | 'closed';

export type HumanReviewCategory =
  | 'unreviewed'
  | 'priority_consultation'
  | 'potential_consultation'
  | 'future_opportunity'
  | 'market_insight';

export type StaffRole = 'admin' | 'advisor' | 'viewer';

export type SubmissionCompletionStatus = 'in_progress' | 'submitted';

export interface CampaignAttribution {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  adSet: string;
  creative: string;
  placement: string;
  referrer: string;
  landingPath: string;
  discoverySourceOptionId: string;
  discoverySourceLabel: string;
}

export type TelemetryEventType =
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

export interface QuestionTelemetryInput {
  eventType: TelemetryEventType;
  sectionId?: AssessmentSectionId | string;
  questionId?: string;
  optionId?: string;
  previousOptionId?: string;
  activeTimeMs?: number;
  inactiveTimeMs?: number;
  wallTimeMs?: number;
  clientTimestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface QuestionTelemetryRecord extends QuestionTelemetryInput {
  id: string;
  submissionId: string;
  createdAt: string;
}

export interface QuestionAnalyticsItem {
  questionId: string;
  sectionId: AssessmentSectionId;
  prompt: string;
  viewsCount: number;
  responsesCount: number;
  changesCount: number;
  backClicksCount: number;
  abandonmentsCount: number;
  sampleCount: number;
  avgActiveTimeSeconds: number | null;
  medianActiveTimeSeconds: number | null;
  avgInactiveTimeSeconds: number | null;
}

export interface SectionDropOffItem {
  sectionId: AssessmentSectionId;
  code: 'A' | 'B' | 'C' | 'D';
  title: string;
  enteredCount: number;
  completedCount: number;
  dropOffCount: number;
  dropOffRatePct: number | null;
}

export interface CampaignCostRecord {
  id: string;
  campaignKey: string;
  utmSource: string;
  utmCampaign: string;
  currency: string;
  amountSpent: number;
  periodLabel: string;
  notes: string;
  updatedAt: string;
}

export interface CampaignPerformanceItem {
  campaignKey: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  adSet: string;
  creative: string;
  placement: string;
  startsCount: number;
  completionsCount: number;
  completionRatePct: number | null;
  consultationRequestsCount: number;
  consultationRequestRatePct: number | null;
  conversionOutcomesCount: number;
  amountSpent: number | null;
  currency: string | null;
  costPerCompletion: number | null;
}

export interface AssessmentVersionRecord {
  versionId: string;
  label: string;
  status: 'active' | 'draft' | 'archived';
  createdBy: string;
  changeSummary: string;
  questions: AssessmentQuestion[];
  sections: AssessmentSectionMeta[];
  partAConfigVersion: string;
  createdAt: string;
  activatedAt: string | null;
}

export type CommunicationTemplateType =
  | 'submission_confirmation'
  | 'results_delivery'
  | 'programme_info'
  | 'consultation_followup'
  | 'cohort_reminder'
  | 'marketing_update';

export type CommunicationChannel = 'email' | 'whatsapp';

export type CommunicationDeliveryStatus =
  | 'sent'
  | 'delivered'
  | 'read'
  | 'replied'
  | 'failed'
  | 'skipped_no_provider'
  | 'skipped_no_consent'
  | 'blocked_preference';

export interface CommunicationMessageRecord {
  id: string;
  submissionId: string;
  channel: CommunicationChannel;
  messageType: CommunicationTemplateType;
  recipient: string;
  subject: string;
  bodyPreview: string;
  provider: string;
  status: CommunicationDeliveryStatus;
  externalMessageId: string;
  errorDetail: string;
  sentBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppRecipientPreview {
  submissionId: string;
  fullName: string;
  whatsappNumber: string;
  whatsappConsent: boolean;
  preference: 'book' | 'more_info' | 'none';
  consultationStatus: ConsultationStatus;
  eligible: boolean;
  eligibilityLabel: string;
  blockedReason: string | null;
  resolvedMessage: string;
}

export interface IntegrationStatusItem {
  id: 'email' | 'whatsapp' | 'mailchimp' | 'crm_webhook';
  name: string;
  category: 'communication' | 'crm';
  configured: boolean;
  providerName: string;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  notes: string;
}

export interface CrmSyncEventRecord {
  id: string;
  submissionId: string;
  provider: string;
  status: 'synced' | 'not_configured' | 'blocked_permission' | 'failed';
  detail: string;
  triggeredBy: string;
  createdAt: string;
}

export interface ConsultationRequestRecord {
  id: string;
  submissionId: string;
  requestedAt: string;
  preference: 'book' | 'more_info' | 'none';
  reviewCategory: HumanReviewCategory;
  autoCategorized?: boolean;
  matchedRuleLabel?: string;
  reviewedAt: string | null;
  reviewedBy: string;
  status: ConsultationStatus;
  statusUpdatedAt: string;
  assignedStaffMember: string;
  contactAttempts: number;
  lastContactedAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  outcomeNotes: string;
  updatedAt: string;
}

export interface AssessmentEventRecord {
  id: string;
  submissionId: string;
  eventType:
    | 'submission_created'
    | 'answers_saved'
    | 'submitted'
    | 'result_viewed'
    | 'consultation_requested'
    | 'consultation_updated'
    | 'feedback_submitted'
    | 'replay_blocked'
    | 'report_delivery_recorded'
    | 'communication_dispatched'
    | 'crm_sync_attempted';
  actorType: 'respondent' | 'staff' | 'system';
  actorId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ReportDeliveryEventRecord {
  id: string;
  submissionId: string;
  channel: 'on_screen' | 'email' | 'whatsapp';
  status:
    | 'delivered_on_screen'
    | 'queued'
    | 'sent'
    | 'skipped_no_provider'
    | 'skipped_no_consent'
    | 'failed';
  recipient: string;
  provider: string;
  detail: string;
  createdAt: string;
}

export interface AssessmentVersionSnapshot {
  assessmentVersion: string;
  contentVersion?: string;
  scoringVersion: string;
  partAConfigVersion: string;
  partAConfigApproved: boolean;
  questionIds: string[];
}

export interface SubmissionRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  completionStatus: SubmissionCompletionStatus;
  assessmentVersion: string;
  scoringVersion: string;
  partAConfigVersion: string;
  assessmentSnapshot: AssessmentVersionSnapshot;
  durationMinutes: number;
  answers: RespondentAnswers;
  result: AssessmentResult;
  attribution: CampaignAttribution;
  feedback: PilotFeedback;
  consultation: ConsultationRequestRecord;
  consultationStatus: ConsultationStatus;
  staffNotes: string;
  events?: AssessmentEventRecord[];
  deliveryEvents?: ReportDeliveryEventRecord[];
  telemetryEvents?: QuestionTelemetryRecord[];
  communicationMessages?: CommunicationMessageRecord[];
}

export interface AdminSubmissionFilters {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  source?: string;
  audience?: string;
  location?: string;
  urgency?: string;
  financialReadiness?: string;
  januaryCohort?: string;
  consultationStatus?: string;
  reviewCategory?: string;
  includeDrafts?: boolean;
}

export interface StorageBoundaryStatus {
  mode: 'sqlite';
  databasePath: string;
  walEnabled: boolean;
  foreignKeysEnabled: boolean;
  externalDatabaseConfigured: boolean;
  description: string;
}

export interface AdminAnalyticsSummary {
  totalStarts: number;
  totalSubmissions: number;
  completionRatePct: number | null;
  inProgressDrafts: number;
  consultationRequests: number;
  consultationRequestRatePct: number | null;
  consultationConversionOutcomes: {
    scheduledCount: number;
    completedCount: number;
    declinedOrClosedCount: number;
  };
  whatsappConsentedCount: number;
  averageDurationMinutes: number | null;
  partAConfigApproved: boolean;
  incompleteStyleCount: number;
  mixedStageCount: number;
  styleDistribution: Array<{
    styleId: StyleId;
    name: string;
    leadCount: number;
  }>;
  stageDistribution: Array<{
    level: GrowthStageLevel;
    name: string;
    count: number;
  }>;
  pillarAverages: Array<{
    pillarId: PillarId;
    name: string;
    avgExperience: number;
    understandingAlignedCount: number;
    understandingRevisitCount: number;
    understandingAlignmentRate: number;
    experienceDistribution: Array<{
      level: 0 | 1 | 2 | 3 | 4;
      count: number;
    }>;
  }>;
  audienceSegments: Array<{ optionId: string; label: string; count: number }>;
  challengesBreakdown: Array<{ optionId: string; label: string; count: number }>;
  urgencyBreakdown: Array<{ optionId: string; label: string; count: number }>;
  geographicBreakdown: Array<{ location: string; state: string; count: number }>;
  financialReadinessBreakdown: Array<{ optionId: string; label: string; count: number }>;
  januaryCohortBreakdown: Array<{ optionId: string; label: string; count: number }>;
  ikejaAttendanceBreakdown: Array<{ label: string; count: number }>;
  attributionBreakdown: Array<{ source: string; count: number }>;
  consultationStatusCounts: Record<ConsultationStatus, number>;
  reviewCategoryCounts: Record<HumanReviewCategory, number>;
  questionAnalytics: {
    questions: QuestionAnalyticsItem[];
    longestActiveQuestions: QuestionAnalyticsItem[];
    shortestActiveQuestions: QuestionAnalyticsItem[];
    sectionDropOff: SectionDropOffItem[];
    totalAbandonedSessions: number;
    timingNote: string;
  };
  campaignPerformance: CampaignPerformanceItem[];
}

export interface LeadSegmentationRule {
  id: string;
  label: string;
  enabled: boolean;
  targetCategory: Exclude<HumanReviewCategory, 'unreviewed'>;
  priorityRank: number;
  conditions: Partial<Record<string, string[]>>;
}

export interface LeadSegmentationConfig {
  approved: boolean;
  version: string;
  notes: string;
  defaultCategory: HumanReviewCategory;
  rules: LeadSegmentationRule[];
}

export interface LeadSegmentationEvaluation {
  category: HumanReviewCategory;
  autoCategorized: boolean;
  matchedRuleId: string | null;
  matchedRuleLabel: string;
}

export interface AssessmentConfigPayload {
  assessmentVersion: string;
  contentVersion: string;
  scoringVersion: string;
  partAConfigVersion: string;
  partAConfigApproved: boolean;
  sections: AssessmentSectionMeta[];
  questions: AssessmentQuestion[];
  stepsCount: number;
}

