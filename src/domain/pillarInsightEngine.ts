import { ASSESSMENT_QUESTIONS } from './assessmentContent.ts';
import {
  PILLAR_INSIGHT_THRESHOLDS,
  buildAllPillarInsightsFromResults,
  buildPartAMetricsFromResult,
  buildPartBMetricsFromResult,
  buildPartCMetricsFromResult,
  buildPartDMetricsFromResult,
  insightTemplates,
  pillarInsightRules,
  selectBestInsight,
  type PillarEvaluationMetrics,
} from './pillarInsights.ts';
import {
  buildNextStep,
  scorePartAProfessionalStyle,
  scorePartBGrowthJourney,
  scorePartCCapabilities,
} from './scoring.ts';
import {
  DEFAULT_PART_A_SCORING_CONFIG,
  type PartAScoringConfig,
} from './scoringConfig.ts';
import type {
  AssessmentQuestion,
  AssessmentSectionId,
  CapabilityResultItem,
  GrowthJourneyResult,
  NextStepResult,
  PillarInsightResult,
  ProfessionalStyleResult,
  RespondentAnswers,
} from './types.ts';

export interface EvaluatedPillarContext {
  metrics: PillarEvaluationMetrics;
  professionalStyle?: ProfessionalStyleResult;
  growthJourney?: GrowthJourneyResult;
  capabilities?: CapabilityResultItem[];
  nextStep?: NextStepResult;
}

export interface PillarInsightEvaluationOutput extends EvaluatedPillarContext {
  insight: PillarInsightResult;
}

export function evaluatePillarResponses(
  pillarId: AssessmentSectionId,
  answers: RespondentAnswers,
  options?: {
    partAConfig?: PartAScoringConfig;
    questions?: AssessmentQuestion[];
  }
): EvaluatedPillarContext {
  const activeQuestions = options?.questions ?? ASSESSMENT_QUESTIONS;

  if (pillarId === 'professional_style') {
    const partAConfig = options?.partAConfig ?? DEFAULT_PART_A_SCORING_CONFIG;
    const professionalStyle = scorePartAProfessionalStyle(
      answers,
      partAConfig,
      activeQuestions
    );
    return {
      professionalStyle,
      metrics: {
        pillarId,
        partA: buildPartAMetricsFromResult(
          professionalStyle,
          answers,
          activeQuestions
        ),
      },
    };
  }

  if (pillarId === 'growth_journey') {
    const growthJourney = scorePartBGrowthJourney(answers, activeQuestions);
    return {
      growthJourney,
      metrics: {
        pillarId,
        partB: buildPartBMetricsFromResult(growthJourney),
      },
    };
  }

  if (pillarId === 'strengths_growth') {
    const capabilities = scorePartCCapabilities(answers, activeQuestions);
    return {
      capabilities,
      metrics: {
        pillarId,
        partC: buildPartCMetricsFromResult(capabilities),
      },
    };
  }

  const nextStep = buildNextStep(answers, activeQuestions);
  return {
    nextStep,
    metrics: {
      pillarId: 'profile_next_steps',
      partD: buildPartDMetricsFromResult(nextStep, answers),
    },
  };
}

export function getInsightForPillar(
  pillarId: AssessmentSectionId,
  answers: RespondentAnswers,
  options?: {
    partAConfig?: PartAScoringConfig;
    questions?: AssessmentQuestion[];
  }
): PillarInsightEvaluationOutput {
  const evaluated = evaluatePillarResponses(pillarId, answers, options);
  const insight = selectBestInsight(pillarId, evaluated.metrics);
  return {
    ...evaluated,
    insight,
  };
}

export {
  PILLAR_INSIGHT_THRESHOLDS,
  buildAllPillarInsightsFromResults,
  insightTemplates,
  pillarInsightRules,
  selectBestInsight,
};
