import { ASSESSMENT_QUESTIONS } from './assessmentContent.ts';
import type {
  AssessmentQuestion,
  GrowthStageLevel,
  PillarId,
  StyleId,
} from './types.ts';

export interface PartAScoringConfig {
  approved: boolean;
  notes: string;
  optionToStyle: Record<string, StyleId | null>;
}

/**
 * Part A — Professional Style Configurable Scoring Matrix
 *
 * IMPORTANT: The master specification does not contain the final approved
 * mapping of all Part A options to the six internal styles.
 * All option IDs are listed explicitly as `null` and `approved` is `false`
 * until KWS Academy supplies and approves the authoritative mapping.
 */
export const DEFAULT_PART_A_SCORING_CONFIG: PartAScoringConfig = {
  approved: false,
  notes:
    'Part A scoring configuration is incomplete pending KWS Academy approval of the final option-to-style mapping matrix.',
  optionToStyle: Object.fromEntries(
    ASSESSMENT_QUESTIONS.filter((q) => q.kind === 'orientation').flatMap((q) =>
      q.options.map((opt) => [opt.id, null])
    )
  ),
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
