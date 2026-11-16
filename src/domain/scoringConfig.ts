import { ASSESSMENT_QUESTIONS } from './assessmentContent.ts';
import type {
  AssessmentQuestion,
  GrowthStageLevel,
  PillarId,
  StyleId,
} from './types.ts';

export interface PartAScoringConfig {
  approved: boolean;
  closeScoreThreshold: number;
  notes: string;
  optionToStyle: Record<string, StyleId | null>;
}

/**
 * Part A — Professional Style Configurable Scoring Matrix
 *
 * All scoring configuration lives strictly in this file so KWS Academy can
 * adjust mappings or the close-score threshold without touching scoring logic.
 * Default closeScoreThreshold is 1 (top two scores within 1 point show as a broad profile).
 */
export const DEFAULT_PART_A_SCORING_CONFIG: PartAScoringConfig = {
  approved: true,
  closeScoreThreshold: 1,
  notes:
    'KWS Academy Part A scoring matrix (draft map active for instant results; pending formal sign-off).',
  optionToStyle: {
    // Q1: A=Opportunity Builder, B=Creator, C=Connector, D=Executor
    style_q01_opt_6: 'OPPORTUNITY_BUILDER',
    style_q01_opt_3: 'CREATOR',
    style_q01_opt_4: 'CONNECTOR',
    style_q01_opt_5: 'EXECUTOR',
    // Q2: A=Connector, B=Opportunity Builder, C=Strategist, D=Executor
    style_q02_opt_4: 'CONNECTOR',
    style_q02_opt_6: 'OPPORTUNITY_BUILDER',
    style_q02_opt_2: 'STRATEGIST',
    style_q02_opt_5: 'EXECUTOR',
    // Q3: A=Creator, B=Opportunity Builder, C=Executor, D=Strategist
    style_q03_opt_3: 'CREATOR',
    style_q03_opt_6: 'OPPORTUNITY_BUILDER',
    style_q03_opt_5: 'EXECUTOR',
    style_q03_opt_2: 'STRATEGIST',
    // Q4: A=Connector, B=Storyteller, C=Opportunity Builder, D=Creator
    style_q04_opt_4: 'CONNECTOR',
    style_q04_opt_1: 'STORYTELLER',
    style_q04_opt_6: 'OPPORTUNITY_BUILDER',
    style_q04_opt_3: 'CREATOR',
    // Q5: A=Executor, B=Storyteller, C=Connector, D=Creator
    style_q05_opt_5: 'EXECUTOR',
    style_q05_opt_1: 'STORYTELLER',
    style_q05_opt_4: 'CONNECTOR',
    style_q05_opt_3: 'CREATOR',
    // Q6: A=Connector, B=Strategist, C=Opportunity Builder, D=Storyteller
    style_q06_opt_4: 'CONNECTOR',
    style_q06_opt_2: 'STRATEGIST',
    style_q06_opt_6: 'OPPORTUNITY_BUILDER',
    style_q06_opt_1: 'STORYTELLER',
    // Q7: A=Strategist, B=Executor, C=Storyteller, D=Connector
    style_q07_opt_2: 'STRATEGIST',
    style_q07_opt_5: 'EXECUTOR',
    style_q07_opt_1: 'STORYTELLER',
    style_q07_opt_4: 'CONNECTOR',
    // Q8: A=Creator, B=Storyteller, C=Opportunity Builder, D=Strategist
    style_q08_opt_3: 'CREATOR',
    style_q08_opt_1: 'STORYTELLER',
    style_q08_opt_6: 'OPPORTUNITY_BUILDER',
    style_q08_opt_2: 'STRATEGIST',
    // Q9: A=Executor, B=Creator, C=Storyteller, D=Strategist
    style_q09_opt_5: 'EXECUTOR',
    style_q09_opt_3: 'CREATOR',
    style_q09_opt_1: 'STORYTELLER',
    style_q09_opt_2: 'STRATEGIST',
  },
};

export interface PartAConfigValidation {
  valid: boolean;
  approved: boolean;
  missingOptionIds: string[];
  invalidOptionIds: string[];
}

const VALID_STYLES: Set<string> = new Set<StyleId>([
  'STORYTELLER',
  'STRATEGIST',
  'CREATOR',
  'CONNECTOR',
  'EXECUTOR',
  'OPPORTUNITY_BUILDER',
]);

export function validatePartAScoringConfig(
  config: PartAScoringConfig,
  questions: AssessmentQuestion[] = ASSESSMENT_QUESTIONS
): PartAConfigValidation {
  const orientationOptions = questions
    .filter((q) => q.kind === 'orientation' && q.active !== false)
    .flatMap((q) => q.options);

  const missingOptionIds: string[] = [];
  const invalidOptionIds: string[] = [];

  for (const opt of orientationOptions) {
    const mapped = config.optionToStyle[opt.id];
    if (!mapped) {
      missingOptionIds.push(opt.id);
    } else if (!VALID_STYLES.has(mapped)) {
      invalidOptionIds.push(opt.id);
    }
  }

  return {
    valid:
      config.approved &&
      missingOptionIds.length === 0 &&
      invalidOptionIds.length === 0,
    approved: config.approved,
    missingOptionIds,
    invalidOptionIds,
  };
}

/**
 * Part B — Growth Journey Option Values (Questions 1–4 only)
 * Questions 5 and 6 are diagnostic only and excluded from stage calculation.
 */
export const PART_B_SCORED_QUESTION_IDS = [
  'growth_q01',
  'growth_q02',
  'growth_q03',
  'growth_q04',
] as const;

export const PART_B_OPTION_VALUES: Record<string, GrowthStageLevel> = {
  growth_q01_stage_1: 1,
  growth_q01_stage_2: 2,
  growth_q01_stage_3: 3,
  growth_q01_stage_4: 4,
  growth_q01_stage_5: 5,
  growth_q02_stage_1: 1,
  growth_q02_stage_2: 2,
  growth_q02_stage_3: 3,
  growth_q02_stage_4: 4,
  growth_q02_stage_5: 5,
  growth_q03_stage_1: 1,
  growth_q03_stage_2: 2,
  growth_q03_stage_3: 3,
  growth_q03_stage_4: 4,
  growth_q03_stage_5: 5,
  growth_q04_stage_1: 1,
  growth_q04_stage_2: 2,
  growth_q04_stage_3: 3,
  growth_q04_stage_4: 4,
  growth_q04_stage_5: 5,
};

/**
 * Part C — Strengths & Growth Areas Approved Answer Keys & Experience Scale
 *
 * Approved Understanding Keys:
 * - Capability 1 (Media & Industry Intelligence): C -> cap_p1_k_examine
 * - Capability 2 (Marketing & Brand Strategy): D -> cap_p2_k_define
 * - Capability 3 (Strategic Communications & Storytelling): B -> cap_p3_k_revisit
 * - Capability 4 (Digital Content & Media Production): D -> cap_p4_k_clarify
 * - Capability 5 (Campaign & Project Execution): A -> cap_p5_k_coordinate
 * - Capability 6 (Creative Business & Professional Development): C -> cap_p6_k_value_model
 */
export const PART_C_UNDERSTANDING_CORRECT_OPTIONS: Record<PillarId, string> = {
  media_industry_intelligence: 'cap_p1_k_examine',
  marketing_brand_strategy: 'cap_p2_k_define',
  strategic_communications_storytelling: 'cap_p3_k_revisit',
  digital_content_media_production: 'cap_p4_k_clarify',
  campaign_project_execution: 'cap_p5_k_coordinate',
  creative_business_professional_development: 'cap_p6_k_value_model',
};

export const PART_C_EXPERIENCE_VALUES: Record<string, 0 | 1 | 2 | 3 | 4> = {
  cap_p1_e_0: 0,
  cap_p1_e_1: 1,
  cap_p1_e_2: 2,
  cap_p1_e_3: 3,
  cap_p1_e_4: 4,
  cap_p2_e_0: 0,
  cap_p2_e_1: 1,
  cap_p2_e_2: 2,
  cap_p2_e_3: 3,
  cap_p2_e_4: 4,
  cap_p3_e_0: 0,
  cap_p3_e_1: 1,
  cap_p3_e_2: 2,
  cap_p3_e_3: 3,
  cap_p3_e_4: 4,
  cap_p4_e_0: 0,
  cap_p4_e_1: 1,
  cap_p4_e_2: 2,
  cap_p4_e_3: 3,
  cap_p4_e_4: 4,
  cap_p5_e_0: 0,
  cap_p5_e_1: 1,
  cap_p5_e_2: 2,
  cap_p5_e_3: 3,
  cap_p5_e_4: 4,
  cap_p6_e_0: 0,
  cap_p6_e_1: 1,
  cap_p6_e_2: 2,
  cap_p6_e_3: 3,
  cap_p6_e_4: 4,
};
