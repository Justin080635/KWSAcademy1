import type {
  LeadSegmentationConfig,
  LeadSegmentationEvaluation,
  RespondentAnswers,
} from './types.ts';

/**
 * Configurable Internal Lead Segmentation Engine
 *
 * IMPORTANT: The master specification leaves lead qualification thresholds and
 * commercial segmentation weighting to stakeholder configuration.
 * By default, `approved` is `false` and `rules` is empty so submissions remain
 * `'unreviewed'` for human review until KWS Academy configures and approves rules.
 */
export const DEFAULT_LEAD_SEGMENTATION_CONFIG: LeadSegmentationConfig = {
  approved: false,
  version: 'pending-approval-v1',
  notes:
    'Lead segmentation rules are unconfigured pending KWS Academy approval of qualification criteria.',
  defaultCategory: 'unreviewed',
  rules: [],
};

export function validateLeadSegmentationConfig(
  config: LeadSegmentationConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const validCategories = new Set([
    'priority_consultation',
    'potential_consultation',
    'future_opportunity',
    'market_insight',
  ]);
  const validDefaultCategories = new Set(['unreviewed', ...validCategories]);

  if (!validDefaultCategories.has(config.defaultCategory)) {
    errors.push('Default category must be a valid review category.');
  }

  for (const rule of config.rules) {
    if (!rule.id?.trim() || !rule.label?.trim()) {
      errors.push('Every rule must have an ID and descriptive label.');
    }
    if (!validCategories.has(rule.targetCategory)) {
      errors.push(`Rule "${rule.label || rule.id}" has an invalid target category.`);
    }
    const conditionEntries = Object.entries(rule.conditions ?? {}).filter(
      ([, values]) => Array.isArray(values) && values.length > 0
    );
    if (rule.enabled && conditionEntries.length === 0) {
      errors.push(
        `Enabled rule "${rule.label || rule.id}" must include at least one matching condition.`
      );
    }
  }

  if (config.approved && config.rules.filter((r) => r.enabled).length === 0) {
    errors.push(
      'Cannot approve lead segmentation while no enabled segmentation rules exist.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function evaluateLeadSegmentation(
  answers: RespondentAnswers,
  config: LeadSegmentationConfig = DEFAULT_LEAD_SEGMENTATION_CONFIG
): LeadSegmentationEvaluation {
  if (!config.approved) {
    return {
      category: 'unreviewed',
      autoCategorized: false,
      matchedRuleId: null,
      matchedRuleLabel: '',
    };
  }

  const orderedRules = [...config.rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priorityRank - b.priorityRank);

  for (const rule of orderedRules) {
    const entries = Object.entries(rule.conditions ?? {}).filter(
      ([, allowedOptionIds]) =>
        Array.isArray(allowedOptionIds) && allowedOptionIds.length > 0
    );
    if (entries.length === 0) continue;

    const allMatch = entries.every(([questionId, allowedOptionIds]) => {
      const selected = answers.selections[questionId];
      return Boolean(selected && allowedOptionIds!.includes(selected));
    });

    if (allMatch) {
      return {
        category: rule.targetCategory,
        autoCategorized: true,
        matchedRuleId: rule.id,
        matchedRuleLabel: rule.label,
      };
    }
  }

  return {
    category: config.defaultCategory,
    autoCategorized: config.defaultCategory !== 'unreviewed',
    matchedRuleId: null,
    matchedRuleLabel:
      config.defaultCategory !== 'unreviewed' ? 'Default approved category' : '',
  };
}
