import {
  GROWTH_STAGES,
  STAGE_MAP,
  STYLE_MAP,
} from './assessmentContent.ts';
import type {
  AssessmentPillarInsightsBundle,
  AssessmentQuestion,
  AssessmentSectionId,
  CapabilityResultItem,
  CircularMetricSpec,
  GrowthJourneyResult,
  NextStepResult,
  PillarInsightResult,
  ProfessionalStyleResult,
  RespondentAnswers,
  StyleId,
} from './types.ts';

/**
 * Configurable thresholds governing deterministic insight rule matching.
 * Adjust thresholds here rather than modifying rule logic or approved scoring rules.
 */
export const PILLAR_INSIGHT_THRESHOLDS = {
  partA: {
    concentratedMinCount: 3,
    concentratedMinGap: 2,
    emergingMinCount: 2,
    broadMaxTopCount: 2,
    broadMinTiedCount: 3,
  },
  partB: {
    mixedStageMinSpread: 2,
  },
  partC: {
    maxUnderstandingPerPillar: 1,
    maxExperiencePerPillar: 4,
    strongExperienceMin: 3,
    limitedExperienceMax: 1,
    practicalAheadExperienceMin: 2,
    balancedMaxExperienceSpread: 1,
    balancedMinExperienceTotal: 6,
    developmentLowExperienceMax: 1,
  },
} as const;

export interface InsightTemplateDefinition {
  insightId: string;
  pillarId: AssessmentSectionId;
  sectionCode: 'A' | 'B' | 'C' | 'D';
  priority: number;
  ctaLabel: string;
  headlineTemplate: string;
  messageTemplate: string;
  curiosityHook?: string;
}

export const insightTemplates: Record<string, InsightTemplateDefinition> = {
  // Part A — Your Professional Style
  part_a_unapproved_neutral: {
    insightId: 'part_a_unapproved_neutral',
    pillarId: 'professional_style',
    sectionCode: 'A',
    priority: 100,
    ctaLabel: 'Continue',
    headlineTemplate: 'Round one done. Your instincts are in.',
    messageTemplate:
      'You responded across {answeredCount} everyday work scenarios in Part A. Your choices are saved and ready for your final profile.',
    curiosityHook:
      'Up next: where you are on your path.',
  },
  part_a_concentrated_lead: {
    insightId: 'part_a_concentrated_lead',
    pillarId: 'professional_style',
    sectionCode: 'A',
    priority: 90,
    ctaLabel: 'Continue',
    headlineTemplate: 'Strong pull toward {leadStyle}.',
    messageTemplate:
      'Your choices lean steadily toward {leadStyle} across different situations.',
    curiosityHook:
      'Up next: where you are on your path.',
  },
  part_a_two_closely_matched: {
    insightId: 'part_a_two_closely_matched',
    pillarId: 'professional_style',
    sectionCode: 'A',
    priority: 80,
    ctaLabel: 'Continue',
    headlineTemplate: 'A natural mix of {leadStyle} and {secondaryStyle}.',
    messageTemplate:
      'Your answers blend {leadStyle} and {secondaryStyle}. You pull from two strong ways of tackling work.',
    curiosityHook:
      'Up next: where you are on your path.',
  },
  part_a_broadly_distributed: {
    insightId: 'part_a_broadly_distributed',
    pillarId: 'professional_style',
    sectionCode: 'A',
    priority: 70,
    ctaLabel: 'Continue',
    headlineTemplate: 'You bring range across different ways of working.',
    messageTemplate:
      'You’re not boxed into one lane. Your answers move comfortably across several styles.',
    curiosityHook:
      'Up next: where you are on your path.',
  },
  part_a_emerging_style: {
    insightId: 'part_a_emerging_style',
    pillarId: 'professional_style',
    sectionCode: 'A',
    priority: 60,
    ctaLabel: 'Continue',
    headlineTemplate: 'An emerging pattern around {leadStyle}.',
    messageTemplate:
      '{leadStyle} came through again and again in how you answered these moments.',
    curiosityHook:
      'Up next: where you are on your path.',
  },
  part_a_fallback: {
    insightId: 'part_a_fallback',
    pillarId: 'professional_style',
    sectionCode: 'A',
    priority: 10,
    ctaLabel: 'Continue',
    headlineTemplate: 'Round one done. Your instincts are in.',
    messageTemplate:
      'Your choices from Part A are saved and will feed straight into your final profile.',
    curiosityHook:
      'Up next: where you are on your path.',
  },

  // Part B — Your Growth Journey
  part_b_stage_1: {
    insightId: 'part_b_stage_1',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 70,
    ctaLabel: 'Continue',
    headlineTemplate: 'Every great journey starts with curiosity.',
    messageTemplate:
      'You’re actively exploring your interests and options right now. Finding clear direction here goes a long way.',
    curiosityHook:
      'Next: what you know and what you’ve done.',
  },
  part_b_stage_2: {
    insightId: 'part_b_stage_2',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 70,
    ctaLabel: 'Continue',
    headlineTemplate: 'You’re building your footing.',
    messageTemplate:
      'You’re putting time into core habits and know-how that turn curiosity into real skill.',
    curiosityHook:
      'Next: what you know and what you’ve done.',
  },
  part_b_stage_3: {
    insightId: 'part_b_stage_3',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 70,
    ctaLabel: 'Continue',
    headlineTemplate: 'You’re moving from learning into doing.',
    messageTemplate:
      'You’re starting to put ideas to work on real briefs—where know-how turns into work you can point to.',
    curiosityHook:
      'Next: what you know and what you’ve done.',
  },
  part_b_stage_4: {
    insightId: 'part_b_stage_4',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 70,
    ctaLabel: 'Continue',
    headlineTemplate: 'You’re building real proof of what you can do.',
    messageTemplate:
      'Your focus is on track record, craft, and work that speaks for itself.',
    curiosityHook:
      'Next: what you know and what you’ve done.',
  },
  part_b_stage_5: {
    insightId: 'part_b_stage_5',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 70,
    ctaLabel: 'Continue',
    headlineTemplate: 'You’re pushing past the basics.',
    messageTemplate:
      'You’re sharpening your edge, taking on bigger calls, and growing the impact of your work.',
    curiosityHook:
      'Next: what you know and what you’ve done.',
  },
  part_b_mixed_stage: {
    insightId: 'part_b_mixed_stage',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 90,
    ctaLabel: 'Continue',
    headlineTemplate: '{stageHeadline}',
    messageTemplate: '{stageMessage}',
    curiosityHook:
      'Next: what you know and what you’ve done.',
  },
  part_b_fallback: {
    insightId: 'part_b_fallback',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 10,
    ctaLabel: 'Continue',
    headlineTemplate: 'Nice. Your path is mapped.',
    messageTemplate:
      'Your Part B answers are saved and will help shape your focus areas.',
    curiosityHook:
      'Next: what you know and what you’ve done.',
  },

  // Part C — Your Strengths & Growth Areas
  part_c_strong_both: {
    insightId: 'part_c_strong_both',
    pillarId: 'strengths_growth',
    sectionCode: 'C',
    priority: 95,
    ctaLabel: 'Continue',
    headlineTemplate: 'Now that’s a strong combination.',
    messageTemplate:
      'You showed both sharp instincts and real mileage in {capabilityName}. That’s a genuine anchor you can build on.',
    curiosityHook:
      'Just a few quick questions about you left.',
  },
  part_c_understanding_ahead: {
    insightId: 'part_c_understanding_ahead',
    pillarId: 'strengths_growth',
    sectionCode: 'C',
    priority: 86,
    ctaLabel: 'Continue',
    headlineTemplate: 'You know more than you’ve had the chance to show.',
    messageTemplate:
      'Your instincts on {capabilityName} are ahead of your mileage so far. Putting that know-how onto a real project is a great next move.',
    curiosityHook:
      'Just a few quick questions about you left.',
  },
  part_c_experience_ahead: {
    insightId: 'part_c_experience_ahead',
    pillarId: 'strengths_growth',
    sectionCode: 'C',
    priority: 85,
    ctaLabel: 'Continue',
    headlineTemplate: 'You’ve been learning on your feet.',
    messageTemplate:
      'Your hands-on mileage in {capabilityName} runs ahead of the scenario angle here. Stepping back into the principles behind what you do can sharpen it further.',
    curiosityHook:
      'Just a few quick questions about you left.',
  },
  part_c_balanced_spread: {
    insightId: 'part_c_balanced_spread',
    pillarId: 'strengths_growth',
    sectionCode: 'C',
    priority: 70,
    ctaLabel: 'Continue',
    headlineTemplate: 'You’re steady across more than one area.',
    messageTemplate:
      'Your answers sit in an even groove across several strengths, including {capabilityName}. Seeing how they pair up will help you choose your focus.',
    curiosityHook:
      'Just a few quick questions about you left.',
  },
  part_c_development_opportunity: {
    insightId: 'part_c_development_opportunity',
    pillarId: 'strengths_growth',
    sectionCode: 'C',
    priority: 60,
    ctaLabel: 'Continue',
    headlineTemplate: 'Here’s a fresh space worth exploring.',
    messageTemplate:
      '{capabilityName} has plenty of open room for both know-how and practice—a great place to start building new range.',
    curiosityHook:
      'Just a few quick questions about you left.',
  },
  part_c_fallback: {
    insightId: 'part_c_fallback',
    pillarId: 'strengths_growth',
    sectionCode: 'C',
    priority: 10,
    ctaLabel: 'Continue',
    headlineTemplate: 'Strengths done. One last stretch.',
    messageTemplate:
      'Your answers from Part C are saved and ready for your final profile.',
    curiosityHook:
      'Just a few quick questions about you left.',
  },

  // Part D — Profile & Next Steps
  part_d_consultation_requested: {
    insightId: 'part_d_consultation_requested',
    pillarId: 'profile_next_steps',
    sectionCode: 'D',
    priority: 90,
    ctaLabel: 'Reveal my profile',
    headlineTemplate: 'Your profile is in.',
    messageTemplate:
      'You’ve mapped how you work, where you are on your path, and where to build next. Everything is ready below.',
    curiosityHook:
      'Your full profile is open right below.',
  },
  part_d_self_directed: {
    insightId: 'part_d_self_directed',
    pillarId: 'profile_next_steps',
    sectionCode: 'D',
    priority: 80,
    ctaLabel: 'Reveal my profile',
    headlineTemplate: 'Your profile is in.',
    messageTemplate:
      'You’ve mapped how you work, where you are on your path, and where to build next. Everything is ready below.',
    curiosityHook:
      'Your full profile is open right below.',
  },
};

export const MIXED_STAGE_OBSERVATION =
  'You’re between stages—some parts of your work feel well ahead while others are still warming up. That contrast makes it clearer where to focus next.';

export interface PartAMetricsSummary {
  partAConfigApproved: boolean;
  answeredCount: number;
  totalQuestions: number;
  pattern: ProfessionalStyleResult['pattern'];
  topStyleId: StyleId | null;
  topStyleName: string | null;
  topCount: number;
  topSharePct: number;
  secondaryStyleId: StyleId | null;
  secondaryStyleName: string | null;
  secondaryCount: number;
  secondarySharePct: number;
  tiedAtTopCount: number;
  clusteredNearTopCount: number;
  activeStylesCount: number;
  leadGap: number;
}

export interface PartBMetricsSummary {
  unroundedAverage: number;
  roundedStageLevel: 1 | 2 | 3 | 4 | 5;
  stageName: string;
  spread: number;
  mixedStageFlag: boolean;
  hasChallenge: boolean;
  hasTwelveMonthGoal: boolean;
}

export interface PartCMetricsSummary {
  pillarCount: number;
  understandingTotal: number;
  maxUnderstanding: number;
  experienceTotal: number;
  maxExperience: number;
  minExperience: number;
  maxSingleExperience: number;
  experienceSpread: number;
  strongBothLeader: CapabilityResultItem | null;
  understandingAheadTarget: CapabilityResultItem | null;
  understandingAheadGap: number;
  experienceAheadTarget: CapabilityResultItem | null;
  experienceAheadGap: number;
  balancedPairLabel: string | null;
  developmentTarget: CapabilityResultItem | null;
}

export interface PartDMetricsSummary {
  wantsConsultation: boolean;
  consultationIntent: 'book' | 'more_info' | 'none';
  respondentName: string;
}

export interface PillarEvaluationMetrics {
  pillarId: AssessmentSectionId;
  partA?: PartAMetricsSummary;
  partB?: PartBMetricsSummary;
  partC?: PartCMetricsSummary;
  partD?: PartDMetricsSummary;
}

export interface PillarInsightRule {
  insightId: string;
  pillarId: AssessmentSectionId;
  priority: number;
  patternKey: string;
  matches: (metrics: PillarEvaluationMetrics) => boolean;
  resolve: (metrics: PillarEvaluationMetrics) => PillarInsightResult;
}

function interpolateTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : ''
  );
}

const STAGE_INSIGHT_IDS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'part_b_stage_1',
  2: 'part_b_stage_2',
  3: 'part_b_stage_3',
  4: 'part_b_stage_4',
  5: 'part_b_stage_5',
};

export const pillarInsightRules: PillarInsightRule[] = [
  // ================= PILLAR 1: PROFESSIONAL STYLE =================
  {
    insightId: 'part_a_unapproved_neutral',
    pillarId: 'professional_style',
    priority: insightTemplates.part_a_unapproved_neutral.priority,
    patternKey: 'unapproved_mapping',
    matches: (m) => Boolean(m.partA && !m.partA.partAConfigApproved),
    resolve: (m) => {
      const a = m.partA!;
      const tmpl = insightTemplates.part_a_unapproved_neutral;
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'unapproved_mapping',
        headline: interpolateTemplate(tmpl.headlineTemplate, {
          answeredCount: a.answeredCount,
        }),
        message: interpolateTemplate(tmpl.messageTemplate, {
          answeredCount: a.answeredCount,
        }),
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        primaryMetric: {
          id: 'part_a_responses_captured',
          label: 'Part A scenarios',
          value: a.answeredCount,
          max: Math.max(1, a.totalQuestions),
          displayValue: `${a.answeredCount} / ${Math.max(1, a.totalQuestions)}`,
          sublabel: 'Responses saved',
          tone: 'muted',
          isPending: true,
        },
        previewSummary: {
          unlockedLabel: 'Part A choices saved',
          unlockedDetail: `${a.answeredCount} of ${a.totalQuestions} scenario instincts recorded`,
          obscuredHint:
            'Your working style profile opens right after Part D.',
          partAConfigApproved: false,
        },
        isFallback: false,
      };
    },
  },
  {
    insightId: 'part_a_concentrated_lead',
    pillarId: 'professional_style',
    priority: insightTemplates.part_a_concentrated_lead.priority,
    patternKey: 'concentrated_lead',
    matches: (m) => {
      const a = m.partA;
      if (!a || !a.partAConfigApproved || !a.topStyleName) return false;
      return (
        a.tiedAtTopCount === 1 &&
        a.topCount >= PILLAR_INSIGHT_THRESHOLDS.partA.concentratedMinCount &&
        a.leadGap >= PILLAR_INSIGHT_THRESHOLDS.partA.concentratedMinGap
      );
    },
    resolve: (m) => {
      const a = m.partA!;
      const tmpl = insightTemplates.part_a_concentrated_lead;
      const leadName = a.topStyleName ?? 'Your leading orientation';
      const secondaryMetric: CircularMetricSpec | undefined =
        a.secondaryStyleName && a.secondaryCount > 0
          ? {
              id: 'part_a_secondary_style',
              label: `Secondary: ${a.secondaryStyleName}`,
              value: a.secondarySharePct,
              max: 100,
              displayValue: `${a.secondarySharePct}%`,
              sublabel: `${a.secondaryCount} of ${a.answeredCount} choices`,
              tone: 'gold',
            }
          : undefined;
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'concentrated_lead',
        headline: interpolateTemplate(tmpl.headlineTemplate, {
          leadStyle: leadName,
        }),
        message: interpolateTemplate(tmpl.messageTemplate, {
          leadStyle: leadName,
        }),
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        spotlightLabel: leadName,
        primaryMetric: {
          id: 'part_a_lead_style',
          label: leadName,
          value: a.topSharePct,
          max: 100,
          displayValue: `${a.topSharePct}%`,
          sublabel: `${a.topCount} of ${a.answeredCount} style choices`,
          tone: 'accent',
        },
        secondaryMetric,
        previewSummary: {
          unlockedLabel: 'Emerging lead orientation',
          unlockedDetail: `${leadName} (${a.topSharePct}% of your scenario picks)`,
          obscuredHint:
            'Contributions, watch-out to balance, and reflection prompt unlock at the end.',
          partAConfigApproved: true,
        },
        isFallback: false,
      };
    },
  },
  {
    insightId: 'part_a_two_closely_matched',
    pillarId: 'professional_style',
    priority: insightTemplates.part_a_two_closely_matched.priority,
    patternKey: 'two_closely_matched',
    matches: (m) => {
      const a = m.partA;
      if (
        !a ||
        !a.partAConfigApproved ||
        !a.topStyleName ||
        !a.secondaryStyleName ||
        a.secondaryCount === 0
      ) {
        return false;
      }
      const isTwoWayTie = a.tiedAtTopCount === 2;
      const isClosePair =
        a.tiedAtTopCount === 1 &&
        a.leadGap <= 1 &&
        a.clusteredNearTopCount === 2 &&
        a.topCount >= PILLAR_INSIGHT_THRESHOLDS.partA.emergingMinCount;
      return isTwoWayTie || isClosePair;
    },
    resolve: (m) => {
      const a = m.partA!;
      const tmpl = insightTemplates.part_a_two_closely_matched;
      const leadName = a.topStyleName ?? 'Primary orientation';
      const secName = a.secondaryStyleName ?? 'Secondary orientation';
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'two_closely_matched',
        headline: interpolateTemplate(tmpl.headlineTemplate, {
          leadStyle: leadName,
          secondaryStyle: secName,
        }),
        message: interpolateTemplate(tmpl.messageTemplate, {
          leadStyle: leadName,
          secondaryStyle: secName,
        }),
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        spotlightLabel: `${leadName} + ${secName}`,
        primaryMetric: {
          id: 'part_a_lead_style',
          label: leadName,
          value: a.topSharePct,
          max: 100,
          displayValue: `${a.topSharePct}%`,
          sublabel: `${a.topCount} of ${a.answeredCount} choices`,
          tone: 'accent',
        },
        secondaryMetric: {
          id: 'part_a_secondary_style',
          label: secName,
          value: a.secondarySharePct,
          max: 100,
          displayValue: `${a.secondarySharePct}%`,
          sublabel: `${a.secondaryCount} of ${a.answeredCount} choices`,
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: 'Paired orientations emerging',
          unlockedDetail: `${leadName} (${a.topSharePct}%) & ${secName} (${a.secondarySharePct}%)`,
          obscuredHint:
            'Full pairing breakdown and watch-out guidance reveal in your complete report.',
          partAConfigApproved: true,
        },
        isFallback: false,
      };
    },
  },
  {
    insightId: 'part_a_broadly_distributed',
    pillarId: 'professional_style',
    priority: insightTemplates.part_a_broadly_distributed.priority,
    patternKey: 'broadly_distributed',
    matches: (m) => {
      const a = m.partA;
      if (!a || !a.partAConfigApproved || a.answeredCount === 0) return false;
      return (
        a.tiedAtTopCount >= PILLAR_INSIGHT_THRESHOLDS.partA.broadMinTiedCount ||
        a.clusteredNearTopCount >= 4 ||
        (a.topCount <= PILLAR_INSIGHT_THRESHOLDS.partA.broadMaxTopCount &&
          a.tiedAtTopCount >= 2)
      );
    },
    resolve: (m) => {
      const a = m.partA!;
      const tmpl = insightTemplates.part_a_broadly_distributed;
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'broadly_distributed',
        headline: tmpl.headlineTemplate,
        message: tmpl.messageTemplate,
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        spotlightLabel: `${a.activeStylesCount} of 6 orientations active`,
        primaryMetric: {
          id: 'part_a_breadth',
          label: 'Active orientations',
          value: a.activeStylesCount,
          max: 6,
          displayValue: `${a.activeStylesCount} / 6`,
          sublabel: `Top share: ${a.topStyleName ?? 'Balanced'} (${a.topSharePct}%)`,
          tone: 'accent',
          segments: 6,
        },
        previewSummary: {
          unlockedLabel: 'Multi-oriented preference pattern',
          unlockedDetail: `${a.activeStylesCount} of 6 professional styles surfaced in Part A`,
          obscuredHint:
            'Cluster comparison and adaptability guidance appear in your final report.',
          partAConfigApproved: true,
        },
        isFallback: false,
      };
    },
  },
  {
    insightId: 'part_a_emerging_style',
    pillarId: 'professional_style',
    priority: insightTemplates.part_a_emerging_style.priority,
    patternKey: 'emerging_style',
    matches: (m) => {
      const a = m.partA;
      if (!a || !a.partAConfigApproved || !a.topStyleName) return false;
      return a.topCount >= PILLAR_INSIGHT_THRESHOLDS.partA.emergingMinCount;
    },
    resolve: (m) => {
      const a = m.partA!;
      const tmpl = insightTemplates.part_a_emerging_style;
      const leadName = a.topStyleName ?? 'Your leading style';
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'emerging_style',
        headline: interpolateTemplate(tmpl.headlineTemplate, {
          leadStyle: leadName,
        }),
        message: interpolateTemplate(tmpl.messageTemplate, {
          leadStyle: leadName,
        }),
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        spotlightLabel: leadName,
        primaryMetric: {
          id: 'part_a_lead_style',
          label: leadName,
          value: a.topSharePct,
          max: 100,
          displayValue: `${a.topSharePct}%`,
          sublabel: `${a.topCount} of ${a.answeredCount} choices`,
          tone: 'accent',
        },
        secondaryMetric:
          a.secondaryStyleName && a.secondaryCount > 0
            ? {
                id: 'part_a_secondary_style',
                label: `Secondary: ${a.secondaryStyleName}`,
                value: a.secondarySharePct,
                max: 100,
                displayValue: `${a.secondarySharePct}%`,
                sublabel: `${a.secondaryCount} of ${a.answeredCount} choices`,
                tone: 'gold',
              }
            : undefined,
        previewSummary: {
          unlockedLabel: 'Emerging style signal',
          unlockedDetail: `${leadName} surfaced ${a.topCount} times across Section A`,
          obscuredHint:
            'Full working-style breakdown and watch-out guidance unlock at the end.',
          partAConfigApproved: true,
        },
        isFallback: false,
      };
    },
  },
  {
    insightId: 'part_a_fallback',
    pillarId: 'professional_style',
    priority: insightTemplates.part_a_fallback.priority,
    patternKey: 'fallback',
    matches: () => true,
    resolve: (m) => {
      const a = m.partA;
      const tmpl = insightTemplates.part_a_fallback;
      const answered = a?.answeredCount ?? 0;
      const total = Math.max(1, a?.totalQuestions ?? 9);
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'fallback',
        headline: tmpl.headlineTemplate,
        message: tmpl.messageTemplate,
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        primaryMetric: {
          id: 'part_a_responses_captured',
          label: 'Section A scenarios',
          value: answered,
          max: total,
          displayValue: `${answered} / ${total}`,
          sublabel: 'Responses saved',
          tone: 'muted',
          isPending: !a?.partAConfigApproved,
        },
        previewSummary: {
          unlockedLabel: 'Section A recorded',
          unlockedDetail: `${answered} of ${total} preferences captured`,
          obscuredHint: 'Full discovery insights unlock at the end.',
          partAConfigApproved: Boolean(a?.partAConfigApproved),
        },
        isFallback: true,
      };
    },
  },

  // ================= PILLAR 2: YOUR GROWTH JOURNEY =================
  {
    insightId: 'part_b_mixed_stage',
    pillarId: 'growth_journey',
    priority: insightTemplates.part_b_mixed_stage.priority,
    patternKey: 'mixed_stage',
    matches: (m) =>
      Boolean(
        m.partB &&
          m.partB.mixedStageFlag &&
          m.partB.spread >= PILLAR_INSIGHT_THRESHOLDS.partB.mixedStageMinSpread
      ),
    resolve: (m) => {
      const b = m.partB!;
      const stageId = STAGE_INSIGHT_IDS[b.roundedStageLevel];
      const stageTemplate = insightTemplates[stageId];
      const tmpl = insightTemplates.part_b_mixed_stage;
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: `mixed_stage_${b.roundedStageLevel}`,
        headline: stageTemplate.headlineTemplate,
        message: stageTemplate.messageTemplate,
        secondaryObservation: MIXED_STAGE_OBSERVATION,
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        spotlightLabel: `${b.stageName} · Mixed-stage pattern`,
        primaryMetric: {
          id: 'part_b_growth_stage',
          label: `${b.stageName} (Stage ${b.roundedStageLevel} of ${GROWTH_STAGES.length})`,
          value: b.roundedStageLevel,
          max: GROWTH_STAGES.length,
          displayValue: `Stage ${b.roundedStageLevel} / ${GROWTH_STAGES.length}`,
          sublabel: 'Where you are focused right now',
          tone: 'accent',
          segments: GROWTH_STAGES.length,
        },
        previewSummary: {
          unlockedLabel: `Your stage: ${b.stageName}`,
          unlockedDetail: `Average ${b.unroundedAverage.toFixed(2)} across your four path reflections`,
          obscuredHint:
            'Your full path map and next focus areas open at the end.',
          partAConfigApproved: true,
        },
        isFallback: false,
      };
    },
  },
  ...([1, 2, 3, 4, 5] as const).map(
    (level): PillarInsightRule => ({
      insightId: `part_b_stage_${level}`,
      pillarId: 'growth_journey',
      priority: insightTemplates[`part_b_stage_${level}`].priority,
      patternKey: `aligned_stage_${level}`,
      matches: (m) =>
        Boolean(m.partB && !m.partB.mixedStageFlag && m.partB.roundedStageLevel === level),
      resolve: (m) => {
        const b = m.partB!;
        const tmpl = insightTemplates[`part_b_stage_${level}`];
        return {
          insightId: tmpl.insightId,
          pillarId: tmpl.pillarId,
          sectionCode: tmpl.sectionCode,
          priority: tmpl.priority,
          patternKey: `aligned_stage_${level}`,
          headline: tmpl.headlineTemplate,
          message: tmpl.messageTemplate,
          curiosityHook: tmpl.curiosityHook,
          ctaLabel: tmpl.ctaLabel,
          spotlightLabel: b.stageName,
          primaryMetric: {
            id: 'part_b_growth_stage',
            label: `${b.stageName} (Stage ${b.roundedStageLevel} of ${GROWTH_STAGES.length})`,
            value: b.roundedStageLevel,
            max: GROWTH_STAGES.length,
            displayValue: `Stage ${b.roundedStageLevel} / ${GROWTH_STAGES.length}`,
            sublabel: 'Where you are focused right now',
            tone: 'accent',
            segments: GROWTH_STAGES.length,
          },
          previewSummary: {
            unlockedLabel: `Your stage: ${b.stageName}`,
            unlockedDetail: `Seated steadily around Stage ${b.roundedStageLevel} (${b.stageName})`,
            obscuredHint:
              'Your full path map and focus areas open at the end.',
            partAConfigApproved: true,
          },
          isFallback: false,
        };
      },
    })
  ),
  {
    insightId: 'part_b_fallback',
    pillarId: 'growth_journey',
    priority: insightTemplates.part_b_fallback.priority,
    patternKey: 'fallback',
    matches: () => true,
    resolve: (m) => {
      const b = m.partB;
      const tmpl = insightTemplates.part_b_fallback;
      const level = b?.roundedStageLevel ?? 1;
      const name = b?.stageName ?? STAGE_MAP[level].name;
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'fallback',
        headline: tmpl.headlineTemplate,
        message: tmpl.messageTemplate,
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        primaryMetric: {
          id: 'part_b_growth_stage',
          label: `${name} (Stage ${level} of 5)`,
          value: level,
          max: 5,
          displayValue: `Stage ${level} / 5`,
          sublabel: 'Where you are focused right now',
          tone: 'muted',
          segments: 5,
        },
        previewSummary: {
          unlockedLabel: 'Path reflections saved',
          unlockedDetail: `Current stage: ${name}`,
          obscuredHint: 'Full discovery insights open at completion.',
          partAConfigApproved: true,
        },
        isFallback: true,
      };
    },
  },

  // ================= PILLAR 3: STRENGTHS & GROWTH AREAS =================
  {
    insightId: 'part_c_strong_both',
    pillarId: 'strengths_growth',
    priority: insightTemplates.part_c_strong_both.priority,
    patternKey: 'strong_both',
    matches: (m) => Boolean(m.partC && m.partC.strongBothLeader !== null),
    resolve: (m) => {
      const c = m.partC!;
      const leader = c.strongBothLeader!;
      const tmpl = insightTemplates.part_c_strong_both;
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'strong_both',
        headline: tmpl.headlineTemplate,
        message: interpolateTemplate(tmpl.messageTemplate, {
          capabilityName: leader.name,
        }),
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        spotlightLabel: leader.name,
        primaryMetric: {
          id: 'part_c_understanding',
          label: 'What you know',
          value: c.understandingTotal,
          max: c.maxUnderstanding,
          displayValue: `${c.understandingTotal} / ${c.maxUnderstanding}`,
          sublabel: 'Scenario instincts across six areas',
          tone: 'accent',
        },
        secondaryMetric: {
          id: 'part_c_experience',
          label: 'What you’ve done',
          value: c.experienceTotal,
          max: c.maxExperience,
          displayValue: `${c.experienceTotal} / ${c.maxExperience}`,
          sublabel: 'Hands-on mileage so far',
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: `Highlighted strength: ${leader.name}`,
          unlockedDetail: `What you know ${c.understandingTotal}/${c.maxUnderstanding} · What you’ve done ${c.experienceTotal}/${c.maxExperience}`,
          obscuredHint:
            'Your area-by-area notes and focus steps unlock at the end.',
          partAConfigApproved: true,
        },
        isFallback: false,
      };
    },
  },
  {
    insightId: 'part_c_understanding_ahead',
    pillarId: 'strengths_growth',
    priority: insightTemplates.part_c_understanding_ahead.priority,
    patternKey: 'understanding_ahead',
    matches: (m) => {
      const c = m.partC;
      if (!c || !c.understandingAheadTarget) return false;
      if (
        c.experienceAheadTarget &&
        c.experienceAheadGap > c.understandingAheadGap
      ) {
        return false;
      }
      return true;
    },
    resolve: (m) => {
      const c = m.partC!;
      const target = c.understandingAheadTarget!;
      const tmpl = insightTemplates.part_c_understanding_ahead;
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'understanding_ahead',
        headline: tmpl.headlineTemplate,
        message: interpolateTemplate(tmpl.messageTemplate, {
          capabilityName: target.name,
        }),
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        spotlightLabel: target.name,
        primaryMetric: {
          id: 'part_c_understanding',
          label: 'What you know',
          value: c.understandingTotal,
          max: c.maxUnderstanding,
          displayValue: `${c.understandingTotal} / ${c.maxUnderstanding}`,
          sublabel: 'Scenario instincts across six areas',
          tone: 'accent',
        },
        secondaryMetric: {
          id: 'part_c_experience',
          label: 'What you’ve done',
          value: c.experienceTotal,
          max: c.maxExperience,
          displayValue: `${c.experienceTotal} / ${c.maxExperience}`,
          sublabel: 'Room to add more practice',
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: `Ready for practice: ${target.name}`,
          unlockedDetail: `What you know ${c.understandingTotal}/${c.maxUnderstanding} · What you’ve done ${c.experienceTotal}/${c.maxExperience}`,
          obscuredHint:
            'Practical ways to turn your instincts into real work unlock at the end.',
          partAConfigApproved: true,
        },
        isFallback: false,
      };
    },
  },
  {
    insightId: 'part_c_experience_ahead',
    pillarId: 'strengths_growth',
    priority: insightTemplates.part_c_experience_ahead.priority,
    patternKey: 'experience_ahead',
    matches: (m) => Boolean(m.partC && m.partC.experienceAheadTarget !== null),
    resolve: (m) => {
      const c = m.partC!;
      const target = c.experienceAheadTarget!;
      const tmpl = insightTemplates.part_c_experience_ahead;
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'experience_ahead',
        headline: tmpl.headlineTemplate,
        message: interpolateTemplate(tmpl.messageTemplate, {
          capabilityName: target.name,
        }),
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        spotlightLabel: target.name,
        primaryMetric: {
          id: 'part_c_understanding',
          label: 'What you know',
          value: c.understandingTotal,
          max: c.maxUnderstanding,
          displayValue: `${c.understandingTotal} / ${c.maxUnderstanding}`,
          sublabel: 'Scenario instincts across six areas',
          tone: 'accent',
        },
        secondaryMetric: {
          id: 'part_c_experience',
          label: 'What you’ve done',
          value: c.experienceTotal,
          max: c.maxExperience,
          displayValue: `${c.experienceTotal} / ${c.maxExperience}`,
          sublabel: 'Strong hands-on momentum',
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: `Hands-on area: ${target.name}`,
          unlockedDetail: `What you know ${c.understandingTotal}/${c.maxUnderstanding} · What you’ve done ${c.experienceTotal}/${c.maxExperience}`,
          obscuredHint:
            'Fresh strategic angles to pair with your mileage unlock at the end.',
          partAConfigApproved: true,
        },
        isFallback: false,
      };
    },
  },
  {
    insightId: 'part_c_balanced_spread',
    pillarId: 'strengths_growth',
    priority: insightTemplates.part_c_balanced_spread.priority,
    patternKey: 'balanced_spread',
    matches: (m) => {
      const c = m.partC;
      if (!c || c.pillarCount === 0) return false;
      return (
        c.experienceSpread <=
          PILLAR_INSIGHT_THRESHOLDS.partC.balancedMaxExperienceSpread &&
        c.experienceTotal >=
          PILLAR_INSIGHT_THRESHOLDS.partC.balancedMinExperienceTotal
      );
    },
    resolve: (m) => {
      const c = m.partC!;
      const tmpl = insightTemplates.part_c_balanced_spread;
      const pairLabel = c.balancedPairLabel ?? 'your core media areas';
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'balanced_spread',
        headline: tmpl.headlineTemplate,
        message: interpolateTemplate(tmpl.messageTemplate, {
          capabilityName: pairLabel,
        }),
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        spotlightLabel: pairLabel,
        primaryMetric: {
          id: 'part_c_understanding',
          label: 'What you know',
          value: c.understandingTotal,
          max: c.maxUnderstanding,
          displayValue: `${c.understandingTotal} / ${c.maxUnderstanding}`,
          sublabel: 'Scenario instincts across six areas',
          tone: 'accent',
        },
        secondaryMetric: {
          id: 'part_c_experience',
          label: 'What you’ve done',
          value: c.experienceTotal,
          max: c.maxExperience,
          displayValue: `${c.experienceTotal} / ${c.maxExperience}`,
          sublabel: 'Steady footing across areas',
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: 'Balanced strength footing',
          unlockedDetail: `What you know ${c.understandingTotal}/${c.maxUnderstanding} · What you’ve done ${c.experienceTotal}/${c.maxExperience}`,
          obscuredHint:
            'Side-by-side strengths and focus ideas unlock at the end.',
          partAConfigApproved: true,
        },
        isFallback: false,
      };
    },
  },
  {
    insightId: 'part_c_development_opportunity',
    pillarId: 'strengths_growth',
    priority: insightTemplates.part_c_development_opportunity.priority,
    patternKey: 'development_opportunity',
    matches: (m) => Boolean(m.partC && m.partC.developmentTarget !== null),
    resolve: (m) => {
      const c = m.partC!;
      const target = c.developmentTarget!;
      const tmpl = insightTemplates.part_c_development_opportunity;
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'development_opportunity',
        headline: tmpl.headlineTemplate,
        message: interpolateTemplate(tmpl.messageTemplate, {
          capabilityName: target.name,
        }),
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        spotlightLabel: target.name,
        primaryMetric: {
          id: 'part_c_understanding',
          label: 'What you know',
          value: c.understandingTotal,
          max: c.maxUnderstanding,
          displayValue: `${c.understandingTotal} / ${c.maxUnderstanding}`,
          sublabel: 'Scenario instincts across six areas',
          tone: 'accent',
        },
        secondaryMetric: {
          id: 'part_c_experience',
          label: 'What you’ve done',
          value: c.experienceTotal,
          max: c.maxExperience,
          displayValue: `${c.experienceTotal} / ${c.maxExperience}`,
          sublabel: 'Fresh room to grow',
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: `Fresh focus: ${target.name}`,
          unlockedDetail: `What you know ${c.understandingTotal}/${c.maxUnderstanding} · What you’ve done ${c.experienceTotal}/${c.maxExperience}`,
          obscuredHint:
            'Simple first steps for your focus areas unlock at the end.',
          partAConfigApproved: true,
        },
        isFallback: false,
      };
    },
  },
  {
    insightId: 'part_c_fallback',
    pillarId: 'strengths_growth',
    priority: insightTemplates.part_c_fallback.priority,
    patternKey: 'fallback',
    matches: () => true,
    resolve: (m) => {
      const c = m.partC;
      const tmpl = insightTemplates.part_c_fallback;
      const u = c?.understandingTotal ?? 0;
      const maxU = c?.maxUnderstanding ?? 6;
      const e = c?.experienceTotal ?? 0;
      const maxE = c?.maxExperience ?? 24;
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'fallback',
        headline: tmpl.headlineTemplate,
        message: tmpl.messageTemplate,
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        primaryMetric: {
          id: 'part_c_understanding',
          label: 'What you know',
          value: u,
          max: maxU,
          displayValue: `${u} / ${maxU}`,
          sublabel: 'Scenario instincts',
          tone: 'accent',
        },
        secondaryMetric: {
          id: 'part_c_experience',
          label: 'What you’ve done',
          value: e,
          max: maxE,
          displayValue: `${e} / ${maxE}`,
          sublabel: 'Hands-on mileage',
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: 'Strengths saved',
          unlockedDetail: `What you know ${u}/${maxU} · What you’ve done ${e}/${maxE}`,
          obscuredHint: 'Your full profile unlocks at the end.',
          partAConfigApproved: true,
        },
        isFallback: true,
      };
    },
  },

  // Part D — Profile & Next Steps
  {
    insightId: 'part_d_consultation_requested',
    pillarId: 'profile_next_steps',
    priority: insightTemplates.part_d_consultation_requested.priority,
    patternKey: 'consultation_requested',
    matches: (m) => Boolean(m.partD && m.partD.wantsConsultation),
    resolve: (m) => {
      const d = m.partD!;
      const tmpl = insightTemplates.part_d_consultation_requested;
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: `consultation_${d.consultationIntent}`,
        headline: tmpl.headlineTemplate,
        message: tmpl.messageTemplate,
        curiosityHook:
          d.consultationIntent === 'book'
            ? 'We’ve noted you’d like a chat—and your full profile is ready right below.'
            : 'We’ve noted you’d like more info—and your full profile is ready right below.',
        ctaLabel: tmpl.ctaLabel,
        primaryMetric: {
          id: 'part_d_completion',
          label: 'Discovery parts',
          value: 4,
          max: 4,
          displayValue: '4 / 4',
          sublabel: 'All four parts complete',
          tone: 'accent',
          segments: 4,
        },
        previewSummary: {
          unlockedLabel: 'Profile ready',
          unlockedDetail:
            'Your working style, path stage, six strengths, and focus ideas are ready.',
          obscuredHint:
            'Click below to reveal your full profile.',
          partAConfigApproved: true,
        },
        isFallback: false,
      };
    },
  },
  {
    insightId: 'part_d_self_directed',
    pillarId: 'profile_next_steps',
    priority: insightTemplates.part_d_self_directed.priority,
    patternKey: 'self_directed',
    matches: () => true,
    resolve: () => {
      const tmpl = insightTemplates.part_d_self_directed;
      return {
        insightId: tmpl.insightId,
        pillarId: tmpl.pillarId,
        sectionCode: tmpl.sectionCode,
        priority: tmpl.priority,
        patternKey: 'self_directed',
        headline: tmpl.headlineTemplate,
        message: tmpl.messageTemplate,
        curiosityHook: tmpl.curiosityHook,
        ctaLabel: tmpl.ctaLabel,
        primaryMetric: {
          id: 'part_d_completion',
          label: 'Discovery parts',
          value: 4,
          max: 4,
          displayValue: '4 / 4',
          sublabel: 'All four parts complete',
          tone: 'accent',
          segments: 4,
        },
        previewSummary: {
          unlockedLabel: 'Profile ready',
          unlockedDetail:
            'Your working style, path stage, six strengths, and focus ideas are ready.',
          obscuredHint:
            'Click below to reveal your full profile.',
          partAConfigApproved: true,
        },
        isFallback: false,
      };
    },
  },
];

export function selectBestInsight(
  pillarId: AssessmentSectionId,
  metrics: PillarEvaluationMetrics
): PillarInsightResult {
  const candidates = pillarInsightRules
    .filter((r) => r.pillarId === pillarId && r.matches(metrics))
    .sort((a, b) => b.priority - a.priority);

  const selected =
    candidates[0] ??
    pillarInsightRules.find(
      (r) => r.pillarId === pillarId && r.patternKey === 'fallback'
    );

  if (!selected) {
    return {
      insightId: `${pillarId}_default_fallback`,
      pillarId,
      sectionCode: 'A',
      priority: 0,
      patternKey: 'default_fallback',
      headline: 'Your responses have been captured.',
      message:
        'Your selections in this section have been recorded toward your final KWS Discovery Report.',
      ctaLabel: 'Continue',
      primaryMetric: {
        id: `${pillarId}_default`,
        label: 'Section completed',
        value: 1,
        max: 1,
        displayValue: '1 / 1',
        sublabel: 'Responses saved',
        tone: 'accent',
      },
      previewSummary: {
        unlockedLabel: 'Responses saved',
        unlockedDetail: 'Captured toward your full report',
        obscuredHint: 'Full discovery revealed at the end.',
        partAConfigApproved: false,
      },
      isFallback: true,
    };
  }

  return selected.resolve(metrics);
}

/**
 * Pure metrics builder from already-computed scoring results.
 * Safe for both client and server (never touches secret option-to-style or Part C keys).
 */
export function buildPartAMetricsFromResult(
  professionalStyle: ProfessionalStyleResult,
  answers: RespondentAnswers,
  questions?: AssessmentQuestion[]
): PartAMetricsSummary {
  const activeOrientationQuestions = (questions ?? []).filter(
    (q) => q.kind === 'orientation' && q.active !== false
  );
  const totalQuestions =
    activeOrientationQuestions.length > 0 ? activeOrientationQuestions.length : 9;
  const answeredCount =
    activeOrientationQuestions.length > 0
      ? activeOrientationQuestions.filter((q) => Boolean(answers.selections[q.id]))
          .length
      : Object.keys(answers.selections).filter((k) => k.startsWith('style_q')).length;

  if (professionalStyle.status !== 'complete') {
    return {
      partAConfigApproved: false,
      answeredCount,
      totalQuestions,
      pattern: null,
      topStyleId: null,
      topStyleName: null,
      topCount: 0,
      topSharePct: 0,
      secondaryStyleId: null,
      secondaryStyleName: null,
      secondaryCount: 0,
      secondarySharePct: 0,
      tiedAtTopCount: 0,
      clusteredNearTopCount: 0,
      activeStylesCount: 0,
      leadGap: 0,
    };
  }

  const sorted = [...professionalStyle.styleScores].sort(
    (a, b) => b.count - a.count
  );
  if (sorted.length === 0) {
    const first = professionalStyle.leadingStyles[0];
    const second =
      professionalStyle.leadingStyles[1] ?? professionalStyle.secondaryStyle;
    const isCoLead = professionalStyle.pattern === 'co_leading';
    const isBlend = professionalStyle.pattern === 'blend';
    const topCountEst = professionalStyle.pattern === 'dominant' ? 4 : isCoLead || isBlend ? 3 : 2;
    const secCountEst = isCoLead ? 3 : isBlend ? 2 : second ? 1 : 0;
    const shareTop = isCoLead ? 33 : isBlend ? 33 : professionalStyle.pattern === 'dominant' ? 44 : 22;
    const shareSec = isCoLead ? 33 : isBlend ? 22 : second ? 11 : 0;

    return {
      partAConfigApproved: true,
      answeredCount,
      totalQuestions,
      pattern: professionalStyle.pattern,
      topStyleId: first?.styleId ?? null,
      topStyleName: first?.name ?? null,
      topCount: topCountEst,
      topSharePct: shareTop,
      secondaryStyleId: second?.styleId ?? null,
      secondaryStyleName: second?.name ?? null,
      secondaryCount: secCountEst,
      secondarySharePct: shareSec,
      tiedAtTopCount: isCoLead ? 2 : professionalStyle.pattern === 'broad' ? 3 : 1,
      clusteredNearTopCount: professionalStyle.pattern === 'clustered' ? 3 : isCoLead || isBlend ? 2 : 1,
      activeStylesCount: Math.max(1, professionalStyle.leadingStyles.length + (second ? 1 : 0)),
      leadGap: topCountEst - secCountEst,
    };
  }

  const totalScored = Math.max(
    1,
    sorted.reduce((sum, s) => sum + s.count, 0)
  );
  const top = sorted[0];
  const second = sorted[1];
  const topCount = top?.count ?? 0;
  const secondCount = second?.count ?? 0;
  const tiedAtTopCount = sorted.filter((s) => s.count === topCount).length;
  const clusteredNearTopCount = sorted.filter(
    (s) => s.count >= Math.max(1, topCount - 1)
  ).length;
  const activeStylesCount = sorted.filter((s) => s.count > 0).length;

  return {
    partAConfigApproved: true,
    answeredCount,
    totalQuestions,
    pattern: professionalStyle.pattern,
    topStyleId: top?.styleId ?? professionalStyle.leadingStyles[0]?.styleId ?? null,
    topStyleName:
      top?.name ??
      professionalStyle.leadingStyles[0]?.name ??
      (top ? STYLE_MAP[top.styleId]?.name : null),
    topCount,
    topSharePct: Math.round((topCount / totalScored) * 100),
    secondaryStyleId:
      second?.styleId ?? professionalStyle.secondaryStyle?.styleId ?? null,
    secondaryStyleName:
      second?.name ?? professionalStyle.secondaryStyle?.name ?? null,
    secondaryCount: secondCount,
    secondarySharePct: Math.round((secondCount / totalScored) * 100),
    tiedAtTopCount,
    clusteredNearTopCount,
    activeStylesCount,
    leadGap: topCount - secondCount,
  };
}

export function buildPartBMetricsFromResult(
  growthJourney: GrowthJourneyResult
): PartBMetricsSummary {
  return {
    unroundedAverage: growthJourney.unroundedAverage,
    roundedStageLevel: growthJourney.roundedStageLevel,
    stageName: growthJourney.indicativeStage.name,
    spread: growthJourney.spread,
    mixedStageFlag: growthJourney.mixedStageFlag,
    hasChallenge: Boolean(growthJourney.biggestChallengeText),
    hasTwelveMonthGoal: Boolean(growthJourney.twelveMonthProgressText),
  };
}

export function buildPartCMetricsFromResult(
  capabilities: CapabilityResultItem[]
): PartCMetricsSummary {
  const maxU =
    capabilities.length * PILLAR_INSIGHT_THRESHOLDS.partC.maxUnderstandingPerPillar;
  const maxE =
    capabilities.length * PILLAR_INSIGHT_THRESHOLDS.partC.maxExperiencePerPillar;
  const understandingTotal = capabilities.reduce(
    (acc, c) => acc + c.understandingScore,
    0
  );
  const experienceTotal = capabilities.reduce(
    (acc, c) => acc + c.experienceScore,
    0
  );

  const expValues = capabilities.map((c) => c.experienceScore);
  const minExperience = expValues.length > 0 ? Math.min(...expValues) : 0;
  const maxSingleExperience = expValues.length > 0 ? Math.max(...expValues) : 0;
  const experienceSpread = maxSingleExperience - minExperience;

  // 1. Differentiated strength: understanding === 1 AND experience >= 3
  const strongBothCandidates = capabilities
    .filter(
      (c) =>
        c.understandingScore === 1 &&
        c.experienceScore >= PILLAR_INSIGHT_THRESHOLDS.partC.strongExperienceMin
    )
    .sort((a, b) => b.experienceScore - a.experienceScore);
  const strongBothLeader = strongBothCandidates[0] ?? null;

  // 2a. Understanding ahead of practical experience (understanding === 1 && experience <= 1)
  const understandingAheadCandidates = capabilities
    .filter(
      (c) =>
        c.understandingScore === 1 &&
        c.experienceScore <= PILLAR_INSIGHT_THRESHOLDS.partC.limitedExperienceMax
    )
    .sort((a, b) => a.experienceScore - b.experienceScore);
  const understandingAheadTarget = understandingAheadCandidates[0] ?? null;
  const understandingAheadGap = understandingAheadTarget
    ? 1 - understandingAheadTarget.experienceScore / 4
    : 0;

  // 2b. Practical experience ahead of understanding (understanding === 0 && experience >= 2)
  const experienceAheadCandidates = capabilities
    .filter(
      (c) =>
        c.understandingScore === 0 &&
        c.experienceScore >=
          PILLAR_INSIGHT_THRESHOLDS.partC.practicalAheadExperienceMin
    )
    .sort((a, b) => b.experienceScore - a.experienceScore);
  const experienceAheadTarget = experienceAheadCandidates[0] ?? null;
  const experienceAheadGap = experienceAheadTarget
    ? experienceAheadTarget.experienceScore / 4
    : 0;

  // 3. Complementary balanced pair
  const topByCombined = [...capabilities].sort(
    (a, b) =>
      b.experienceScore +
      b.understandingScore * 2 -
      (a.experienceScore + a.understandingScore * 2)
  );
  const balancedPairLabel =
    topByCombined.length >= 2
      ? `${topByCombined[0].name} and ${topByCombined[1].name}`
      : topByCombined[0]?.name ?? null;

  // 4. Constructive development opportunity
  const developmentCandidates = capabilities
    .filter(
      (c) =>
        c.understandingScore === 0 &&
        c.experienceScore <=
          PILLAR_INSIGHT_THRESHOLDS.partC.developmentLowExperienceMax
    )
    .sort((a, b) => a.experienceScore - b.experienceScore);
  const developmentTarget = developmentCandidates[0] ?? null;

  return {
    pillarCount: capabilities.length,
    understandingTotal,
    maxUnderstanding: maxU,
    experienceTotal,
    maxExperience: maxE,
    minExperience,
    maxSingleExperience,
    experienceSpread,
    strongBothLeader,
    understandingAheadTarget,
    understandingAheadGap,
    experienceAheadTarget,
    experienceAheadGap,
    balancedPairLabel,
    developmentTarget,
  };
}

export function buildPartDMetricsFromResult(
  nextStep: NextStepResult,
  answers: RespondentAnswers
): PartDMetricsSummary {
  return {
    wantsConsultation: nextStep.wantsConsultation,
    consultationIntent: nextStep.consultationIntent,
    respondentName: answers.contact.fullName.trim(),
  };
}

export function buildAllPillarInsightsFromResults(params: {
  answers: RespondentAnswers;
  professionalStyle: ProfessionalStyleResult;
  growthJourney: GrowthJourneyResult;
  capabilities: CapabilityResultItem[];
  nextStep: NextStepResult;
  questions?: AssessmentQuestion[];
}): AssessmentPillarInsightsBundle {
  const partA = selectBestInsight('professional_style', {
    pillarId: 'professional_style',
    partA: buildPartAMetricsFromResult(
      params.professionalStyle,
      params.answers,
      params.questions
    ),
  });

  const partB = selectBestInsight('growth_journey', {
    pillarId: 'growth_journey',
    partB: buildPartBMetricsFromResult(params.growthJourney),
  });

  const partC = selectBestInsight('strengths_growth', {
    pillarId: 'strengths_growth',
    partC: buildPartCMetricsFromResult(params.capabilities),
  });

  const partD = selectBestInsight('profile_next_steps', {
    pillarId: 'profile_next_steps',
    partD: buildPartDMetricsFromResult(params.nextStep, params.answers),
  });

  return {
    professionalStyle: partA,
    growthJourney: partB,
    strengthsGrowth: partC,
    profileNextSteps: partD,
  };
}
