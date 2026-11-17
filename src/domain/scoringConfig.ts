import assessmentSpec from '../../content/assessment.json';
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

const RAW_STYLE_NAME_TO_ID: Record<string, StyleId> = {
  storyteller: 'STORYTELLER',
  strategist: 'STRATEGIST',
  creator: 'CREATOR',
  connector: 'CONNECTOR',
  executor: 'EXECUTOR',
  opportunity_builder: 'OPPORTUNITY_BUILDER',
};

const CARD_ID_TO_PILLAR_ID: Record<string, PillarId> = {
  C1: 'media_industry_intelligence',
  C2: 'marketing_brand_strategy',
  C3: 'strategic_communications_storytelling',
  C4: 'digital_content_media_production',
  C5: 'campaign_project_execution',
  C6: 'creative_business_professional_development',
};

function buildDefaultOptionToStyle(): Record<string, StyleId | null> {
  const rawMap = (
    assessmentSpec as {
      scoring?: {
        partA_styleMap_DRAFT_PENDING_KWS_APPROVAL?: Record<
          string,
          Record<string, string>
        >;
      };
    }
  ).scoring?.partA_styleMap_DRAFT_PENDING_KWS_APPROVAL;

  const result: Record<string, StyleId | null> = {};
  if (!rawMap) return result;

  for (const [questionId, optionMap] of Object.entries(rawMap)) {
    for (const [optionKey, rawStyle] of Object.entries(optionMap)) {
      const styleId = RAW_STYLE_NAME_TO_ID[rawStyle.toLowerCase()];
      if (styleId) {
        result[`${questionId}-${optionKey}`] = styleId;
      }
    }
  }
  return result;
}

function buildPartCUnderstandingKeys(): Record<PillarId, string> {
  const cards =
    (
      assessmentSpec as {
        partC?: {
          cards?: Array<{ id: string; correctUnderstandingKey?: string }>;
        };
      }
    ).partC?.cards ?? [];

  const out: Partial<Record<PillarId, string>> = {};
  for (const card of cards) {
    const pillarId = CARD_ID_TO_PILLAR_ID[card.id];
    if (pillarId && card.correctUnderstandingKey) {
      out[pillarId] = `${card.id}-U-${card.correctUnderstandingKey}`;
    }
  }

  return out as Record<PillarId, string>;
}

/**
 * Part A — Professional Style Configurable Scoring Matrix
 *
 * Server-only scoring matrix derived from content/assessment.json.
 * Never exposed to respondent client bundles.
 */
export const DEFAULT_PART_A_SCORING_CONFIG: PartAScoringConfig = {
  approved: true,
  closeScoreThreshold: 1,
  notes:
    'KWS Academy Part A scoring matrix loaded from master specification JSON (draft map active for instant results; pending formal sign-off).',
  optionToStyle: buildDefaultOptionToStyle(),
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
 * Part B — Growth Journey Option Values (B1–B4 only)
 * B5 and B6 are diagnostic only and excluded from stage calculation.
 */
export const PART_B_SCORED_QUESTION_IDS = ['B1', 'B2', 'B3', 'B4'] as const;

export const PART_B_OPTION_VALUES: Record<string, GrowthStageLevel> = {
  'B1-A': 1,
  'B1-B': 2,
  'B1-C': 3,
  'B1-D': 4,
  'B1-E': 5,
  'B2-A': 1,
  'B2-B': 2,
  'B2-C': 3,
  'B2-D': 4,
  'B2-E': 5,
  'B3-A': 1,
  'B3-B': 2,
  'B3-C': 3,
  'B3-D': 4,
  'B3-E': 5,
  'B4-A': 1,
  'B4-B': 2,
  'B4-C': 3,
  'B4-D': 4,
  'B4-E': 5,
};

/**
 * Part C — Strengths & Growth Areas Approved Answer Keys & Experience Scale
 * Loaded directly from content/assessment.json (server-only, never exposed to respondents).
 */
export const PART_C_UNDERSTANDING_CORRECT_OPTIONS: Record<PillarId, string> =
  buildPartCUnderstandingKeys();

export const PART_C_EXPERIENCE_VALUES: Record<string, 0 | 1 | 2 | 3 | 4> = {
  'C1-E-A': 0,
  'C1-E-B': 1,
  'C1-E-C': 2,
  'C1-E-D': 3,
  'C1-E-E': 4,
  'C2-E-A': 0,
  'C2-E-B': 1,
  'C2-E-C': 2,
  'C2-E-D': 3,
  'C2-E-E': 4,
  'C3-E-A': 0,
  'C3-E-B': 1,
  'C3-E-C': 2,
  'C3-E-D': 3,
  'C3-E-E': 4,
  'C4-E-A': 0,
  'C4-E-B': 1,
  'C4-E-C': 2,
  'C4-E-D': 3,
  'C4-E-E': 4,
  'C5-E-A': 0,
  'C5-E-B': 1,
  'C5-E-C': 2,
  'C5-E-D': 3,
  'C5-E-E': 4,
  'C6-E-A': 0,
  'C6-E-B': 1,
  'C6-E-C': 2,
  'C6-E-D': 3,
  'C6-E-E': 4,
};
