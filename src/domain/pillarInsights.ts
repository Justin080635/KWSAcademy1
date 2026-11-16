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
  // Pillar 1 — Your Professional Style
  part_a_unapproved_neutral: {
    insightId: 'part_a_unapproved_neutral',
    pillarId: 'professional_style',
    sectionCode: 'A',
    priority: 100,
    ctaLabel: 'Discover Your Growth Journey',
    headlineTemplate: 'Your {answeredCount} working-style instincts are captured.',
    messageTemplate:
      'You responded across {answeredCount} real workplace scenarios in Section A. Because KWS Academy’s final style mapping is awaiting configuration approval, no specific style label is assigned yet—your responses are safely preserved.',
    curiosityHook:
      'Next, Part B locates where your current momentum sits across five stages of professional growth.',
  },
  part_a_concentrated_lead: {
    insightId: 'part_a_concentrated_lead',
    pillarId: 'professional_style',
    sectionCode: 'A',
    priority: 90,
    ctaLabel: 'Discover Your Growth Journey',
    headlineTemplate: 'Strong pull toward {leadStyle}.',
    messageTemplate:
      'Wow! Your responses show a strong preference for {leadStyle}. You consistently gravitated towards this way of contributing across different situations.',
    curiosityHook:
      'Next, Part B reveals which stage of the five-step professional growth journey matches your current focus.',
  },
  part_a_two_closely_matched: {
    insightId: 'part_a_two_closely_matched',
    pillarId: 'professional_style',
    sectionCode: 'A',
    priority: 80,
    ctaLabel: 'Discover Your Growth Journey',
    headlineTemplate: 'A natural combination of {leadStyle} and {secondaryStyle}.',
    messageTemplate:
      'Interesting! Your responses suggest a combination of {leadStyle} and {secondaryStyle}. You seem to draw on two different ways of approaching professional situations.',
    curiosityHook:
      'Next, see how your current growth stage shapes where these two orientations have the highest leverage.',
  },
  part_a_broadly_distributed: {
    insightId: 'part_a_broadly_distributed',
    pillarId: 'professional_style',
    sectionCode: 'A',
    priority: 70,
    ctaLabel: 'Discover Your Growth Journey',
    headlineTemplate: 'You draw across several ways of contributing.',
    messageTemplate:
      'You’re not easily boxed into one approach. Your responses show interest across several ways of contributing, suggesting a versatile professional orientation.',
    curiosityHook:
      'Next, Part B uncovers which growth stage best reflects your current priorities and challenges.',
  },
  part_a_emerging_style: {
    insightId: 'part_a_emerging_style',
    pillarId: 'professional_style',
    sectionCode: 'A',
    priority: 60,
    ctaLabel: 'Discover Your Growth Journey',
    headlineTemplate: 'An emerging pattern around {leadStyle}.',
    messageTemplate:
      'There’s an interesting pattern emerging around {leadStyle}. It appeared repeatedly in your choices, even across different situations.',
    curiosityHook:
      'Up next, Part B maps where you currently stand on your professional growth journey.',
  },
  part_a_fallback: {
    insightId: 'part_a_fallback',
    pillarId: 'professional_style',
    sectionCode: 'A',
    priority: 10,
    ctaLabel: 'Discover Your Growth Journey',
    headlineTemplate: 'Your Section A preferences are recorded.',
    messageTemplate:
      'Your scenario responses in Section A are saved and will feed into your final discovery profile.',
    curiosityHook:
      'Continue to Section B to explore where you currently sit across five stages of growth.',
  },

  // Pillar 2 — Your Growth Journey
  part_b_stage_1: {
    insightId: 'part_b_stage_1',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 70,
    ctaLabel: 'Explore My Strengths',
    headlineTemplate: 'Every great professional journey starts with discovery.',
    messageTemplate:
      'Your answers show that you’re actively exploring your interests and possibilities. You’re at a point where clarity about your direction can make a meaningful difference.',
    curiosityHook:
      'Next, Section C separates what you understand conceptually from what you’ve practiced hands-on across six capabilities.',
  },
  part_b_stage_2: {
    insightId: 'part_b_stage_2',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 70,
    ctaLabel: 'Explore My Strengths',
    headlineTemplate: 'You’re building your professional foundation.',
    messageTemplate:
      'You’re investing in the knowledge and capabilities that can help turn your interests into something practical. That’s an important part of your journey.',
    curiosityHook:
      'Next, Section C examines where your understanding and practical exposure already align—or diverge.',
  },
  part_b_stage_3: {
    insightId: 'part_b_stage_3',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 70,
    ctaLabel: 'Explore My Strengths',
    headlineTemplate: 'You’re moving beyond learning.',
    messageTemplate:
      'Your responses suggest that you’re beginning to put what you know into practice. This is where experience starts turning knowledge into something you can demonstrate.',
    curiosityHook:
      'Next, see which of the six media and marketing pillars show your strongest hands-on momentum.',
  },
  part_b_stage_4: {
    insightId: 'part_b_stage_4',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 70,
    ctaLabel: 'Explore My Strengths',
    headlineTemplate: 'You’re building evidence of what you can do.',
    messageTemplate:
      'Your answers reflect a focus on experience, credibility and professional visibility. You’re working towards having something tangible that speaks for your capabilities.',
    curiosityHook:
      'Next, discover where your situational judgment and practical repetition stand across all six pillars.',
  },
  part_b_stage_5: {
    insightId: 'part_b_stage_5',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 70,
    ctaLabel: 'Explore My Strengths',
    headlineTemplate: 'You’re thinking beyond the basics.',
    messageTemplate:
      'Your responses suggest that you’re looking to deepen your expertise, expand your opportunities and increase the value you create.',
    curiosityHook:
      'Next, pinpoint which pillars offer the sharpest leverage for your next phase of growth.',
  },
  part_b_mixed_stage: {
    insightId: 'part_b_mixed_stage',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 90,
    ctaLabel: 'Explore My Strengths',
    headlineTemplate: '{stageHeadline}',
    messageTemplate: '{stageMessage}',
    curiosityHook:
      'Section C reveals how that uneven momentum shows up across six specific capability areas.',
  },
  part_b_fallback: {
    insightId: 'part_b_fallback',
    pillarId: 'growth_journey',
    sectionCode: 'B',
    priority: 10,
    ctaLabel: 'Explore My Strengths',
    headlineTemplate: 'Your growth reflections are saved.',
    messageTemplate:
      'Your Part B reflections have been recorded and will shape the priorities in your final discovery report.',
    curiosityHook:
      'Continue to Section C to map your strengths and practical exposure.',
  },

  // Pillar 3 — Your Strengths & Growth Areas
  part_c_strong_both: {
    insightId: 'part_c_strong_both',
    pillarId: 'strengths_growth',
    sectionCode: 'C',
    priority: 95,
    ctaLabel: 'See What’s Next for Me',
    headlineTemplate: 'Now that’s an interesting combination!',
    messageTemplate:
      'You’re showing encouraging signs of both understanding and practical application in {capabilityName}. This is an area worth continuing to develop.',
    curiosityHook:
      'One brief section remains before your complete discovery report opens with tailored next-step priorities.',
  },
  part_c_understanding_ahead: {
    insightId: 'part_c_understanding_ahead',
    pillarId: 'strengths_growth',
    sectionCode: 'C',
    priority: 86,
    ctaLabel: 'See What’s Next for Me',
    headlineTemplate:
      'You may know more than you’ve had the chance to demonstrate.',
    messageTemplate:
      'Your responses show encouraging understanding in {capabilityName}, while your practical experience is still developing. Putting that knowledge into practice could be your next big opportunity.',
    curiosityHook:
      'Complete Section D next to unlock your tailored priority roadmap alongside these scores.',
  },
  part_c_experience_ahead: {
    insightId: 'part_c_experience_ahead',
    pillarId: 'strengths_growth',
    sectionCode: 'C',
    priority: 85,
    ctaLabel: 'See What’s Next for Me',
    headlineTemplate: 'You’ve been learning by doing.',
    messageTemplate:
      'Your experience in {capabilityName} appears stronger than your current understanding score. Strengthening the foundations behind what you already do could help you progress further.',
    curiosityHook:
      'Finish Section D to bring your practical track record together with your working style and growth stage.',
  },
  part_c_balanced_spread: {
    insightId: 'part_c_balanced_spread',
    pillarId: 'strengths_growth',
    sectionCode: 'C',
    priority: 70,
    ctaLabel: 'See What’s Next for Me',
    headlineTemplate: 'Your interests stretch across more than one area.',
    messageTemplate:
      'Your responses show a relatively balanced pattern across several capabilities, including {capabilityName}. You may enjoy exploring how these areas work together.',
    curiosityHook:
      'Section D connects this breadth to your current goals and opens your complete report.',
  },
  part_c_development_opportunity: {
    insightId: 'part_c_development_opportunity',
    pillarId: 'strengths_growth',
    sectionCode: 'C',
    priority: 60,
    ctaLabel: 'See What’s Next for Me',
    headlineTemplate: 'Here’s an area worth exploring.',
    messageTemplate:
      '{capabilityName} currently appears to offer room for further development in both understanding and experience. This gives you a useful starting point for your next steps.',
    curiosityHook:
      'Finish Section D next to reveal concrete ways to build momentum here immediately.',
  },
  part_c_fallback: {
    insightId: 'part_c_fallback',
    pillarId: 'strengths_growth',
    sectionCode: 'C',
    priority: 10,
    ctaLabel: 'See What’s Next for Me',
    headlineTemplate: 'Your six capability snapshots are captured.',
    messageTemplate:
      'Your understanding and practical experience responses across Section C are saved for your final discovery report.',
    curiosityHook:
      'Continue to the final section to open your complete report.',
  },

  // Pillar 4 — Profile & Next Steps
  part_d_consultation_requested: {
    insightId: 'part_d_consultation_requested',
    pillarId: 'profile_next_steps',
    sectionCode: 'D',
    priority: 90,
    ctaLabel: 'Reveal My Professional Discovery Report',
    headlineTemplate: 'Your discovery is ready.',
    messageTemplate:
      'You’ve explored how you contribute, reflected on your professional journey and identified areas where you can grow. We’ve brought your responses together into a personal discovery report.',
    curiosityHook:
      'Your consultation request is recorded—and your full report is ready to explore immediately below.',
  },
  part_d_self_directed: {
    insightId: 'part_d_self_directed',
    pillarId: 'profile_next_steps',
    sectionCode: 'D',
    priority: 80,
    ctaLabel: 'Reveal My Professional Discovery Report',
    headlineTemplate: 'Your discovery is ready.',
    messageTemplate:
      'You’ve explored how you contribute, reflected on your professional journey and identified areas where you can grow. We’ve brought your responses together into a personal discovery report.',
    curiosityHook:
      'Open your full report below for your complete style breakdown, growth map, and self-directed priorities.',
  },
};

export const MIXED_STAGE_OBSERVATION =
  'There’s an interesting difference between the stages of your journey. Some areas appear further developed than others, which gives us a more useful picture of where your next growth opportunity may lie.';

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
          label: 'Section A scenarios',
          value: a.answeredCount,
          max: Math.max(1, a.totalQuestions),
          displayValue: `${a.answeredCount} / ${Math.max(1, a.totalQuestions)}`,
          sublabel: 'Awaiting style mapping approval',
          tone: 'muted',
          isPending: true,
        },
        previewSummary: {
          unlockedLabel: 'Part A choices captured',
          unlockedDetail: `${a.answeredCount} of ${a.totalQuestions} scenario preferences recorded`,
          obscuredHint:
            'Style classification remains hidden until KWS Academy approves the final option mapping.',
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
          sublabel: 'Reflects development focus, not personal worth',
          tone: 'accent',
          segments: GROWTH_STAGES.length,
        },
        previewSummary: {
          unlockedLabel: `Provisional stage: ${b.stageName}`,
          unlockedDetail: `Mean ${b.unroundedAverage.toFixed(2)} across four scored reflections (spread ${b.spread})`,
          obscuredHint:
            'Your stage progression direction and 12-month priority unlock in the full report.',
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
            sublabel: 'Reflects development focus, not personal worth',
            tone: 'accent',
            segments: GROWTH_STAGES.length,
          },
          previewSummary: {
            unlockedLabel: `Provisional stage: ${b.stageName}`,
            unlockedDetail: `Closely aligned around Stage ${b.roundedStageLevel} (${b.stageName})`,
            obscuredHint:
              'Your suggested progress direction and challenge alignment unlock in the full report.',
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
          sublabel: 'Reflects development focus, not personal worth',
          tone: 'muted',
          segments: 5,
        },
        previewSummary: {
          unlockedLabel: 'Growth reflections saved',
          unlockedDetail: `Indicative stage: ${name}`,
          obscuredHint: 'Full progression insight unlocks at completion.',
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
          label: 'Understanding',
          value: c.understandingTotal,
          max: c.maxUnderstanding,
          displayValue: `${c.understandingTotal} / ${c.maxUnderstanding}`,
          sublabel: 'Situational alignment across 6 pillars',
          tone: 'success',
        },
        secondaryMetric: {
          id: 'part_c_experience',
          label: 'Practical experience',
          value: c.experienceTotal,
          max: c.maxExperience,
          displayValue: `${c.experienceTotal} / ${c.maxExperience}`,
          sublabel: 'Self-reported hands-on track record',
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: `Highlighted pillar: ${leader.name}`,
          unlockedDetail: `Understanding ${c.understandingTotal}/${c.maxUnderstanding} · Practical experience ${c.experienceTotal}/${c.maxExperience}`,
          obscuredHint:
            'Pillar-by-pillar constructive interpretations and priorities unlock in the full report.',
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
          label: 'Understanding',
          value: c.understandingTotal,
          max: c.maxUnderstanding,
          displayValue: `${c.understandingTotal} / ${c.maxUnderstanding}`,
          sublabel: 'Situational alignment across 6 pillars',
          tone: 'success',
        },
        secondaryMetric: {
          id: 'part_c_experience',
          label: 'Practical experience',
          value: c.experienceTotal,
          max: c.maxExperience,
          displayValue: `${c.experienceTotal} / ${c.maxExperience}`,
          sublabel: 'Hands-on application opportunity',
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: `Opportunity gap: ${target.name}`,
          unlockedDetail: `Understanding ${c.understandingTotal}/${c.maxUnderstanding} · Practical experience ${c.experienceTotal}/${c.maxExperience}`,
          obscuredHint:
            'Actionable ways to translate conceptual clarity into hands-on practice unlock at the end.',
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
          label: 'Understanding',
          value: c.understandingTotal,
          max: c.maxUnderstanding,
          displayValue: `${c.understandingTotal} / ${c.maxUnderstanding}`,
          sublabel: 'Situational alignment across 6 pillars',
          tone: 'success',
        },
        secondaryMetric: {
          id: 'part_c_experience',
          label: 'Practical experience',
          value: c.experienceTotal,
          max: c.maxExperience,
          displayValue: `${c.experienceTotal} / ${c.maxExperience}`,
          sublabel: 'Strong hands-on momentum',
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: `Hands-on pillar: ${target.name}`,
          unlockedDetail: `Understanding ${c.understandingTotal}/${c.maxUnderstanding} · Practical experience ${c.experienceTotal}/${c.maxExperience}`,
          obscuredHint:
            'Core strategic principles paired with your practical experience unlock at the end.',
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
      const pairLabel = c.balancedPairLabel ?? 'your core media pillars';
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
          label: 'Understanding',
          value: c.understandingTotal,
          max: c.maxUnderstanding,
          displayValue: `${c.understandingTotal} / ${c.maxUnderstanding}`,
          sublabel: 'Situational alignment across 6 pillars',
          tone: 'success',
        },
        secondaryMetric: {
          id: 'part_c_experience',
          label: 'Practical experience',
          value: c.experienceTotal,
          max: c.maxExperience,
          displayValue: `${c.experienceTotal} / ${c.maxExperience}`,
          sublabel: 'Consistent spread across capabilities',
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: 'Balanced capability foundation',
          unlockedDetail: `Understanding ${c.understandingTotal}/${c.maxUnderstanding} · Practical experience ${c.experienceTotal}/${c.maxExperience}`,
          obscuredHint:
            'Side-by-side capability comparison and priority recommendations unlock at the end.',
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
          label: 'Understanding',
          value: c.understandingTotal,
          max: c.maxUnderstanding,
          displayValue: `${c.understandingTotal} / ${c.maxUnderstanding}`,
          sublabel: 'Situational alignment across 6 pillars',
          tone: 'success',
        },
        secondaryMetric: {
          id: 'part_c_experience',
          label: 'Practical experience',
          value: c.experienceTotal,
          max: c.maxExperience,
          displayValue: `${c.experienceTotal} / ${c.maxExperience}`,
          sublabel: 'Early starting foundation',
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: `Starting focus: ${target.name}`,
          unlockedDetail: `Understanding ${c.understandingTotal}/${c.maxUnderstanding} · Practical experience ${c.experienceTotal}/${c.maxExperience}`,
          obscuredHint:
            'Practical starting steps for your priority areas unlock in the final report.',
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
          label: 'Understanding',
          value: u,
          max: maxU,
          displayValue: `${u} / ${maxU}`,
          sublabel: 'Situational alignment',
          tone: 'success',
        },
        secondaryMetric: {
          id: 'part_c_experience',
          label: 'Practical experience',
          value: e,
          max: maxE,
          displayValue: `${e} / ${maxE}`,
          sublabel: 'Hands-on exposure',
          tone: 'gold',
        },
        previewSummary: {
          unlockedLabel: 'Capabilities recorded',
          unlockedDetail: `Understanding ${u}/${maxU} · Experience ${e}/${maxE}`,
          obscuredHint: 'Detailed capability map unlocks in your final report.',
          partAConfigApproved: true,
        },
        isFallback: true,
      };
    },
  },

  // ================= PILLAR 4: PROFILE & NEXT STEPS =================
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
            ? 'Your consultation request is saved—and your complete discovery report opens immediately below.'
            : 'Your information preference is noted—and your complete discovery report opens immediately below.',
        ctaLabel: tmpl.ctaLabel,
        primaryMetric: {
          id: 'part_d_completion',
          label: 'Assessment sections',
          value: 4,
          max: 4,
          displayValue: '4 / 4',
          sublabel: 'All discovery pillars completed',
          tone: 'success',
          segments: 4,
        },
        previewSummary: {
          unlockedLabel: 'Complete discovery synthesized',
          unlockedDetail:
            'Your working style, growth stage, six capabilities, and priorities are assembled.',
          obscuredHint:
            'Click below to reveal your complete interactive report immediately.',
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
          label: 'Assessment sections',
          value: 4,
          max: 4,
          displayValue: '4 / 4',
          sublabel: 'All discovery pillars completed',
          tone: 'success',
          segments: 4,
        },
        previewSummary: {
          unlockedLabel: 'Complete discovery synthesized',
          unlockedDetail:
            'Your working style, growth stage, six capabilities, and priorities are assembled.',
          obscuredHint:
            'Click below to reveal your complete interactive report immediately.',
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
