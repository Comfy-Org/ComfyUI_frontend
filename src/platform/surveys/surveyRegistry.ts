import type { FeatureSurveyConfig } from './useSurveyEligibility'

/**
 * Registry of all feature surveys.
 * Add new surveys here when targeting specific features for feedback.
 */
export const FEATURE_SURVEYS: Record<string, FeatureSurveyConfig> = {
  'node-search': {
    featureId: 'node-search',
    typeformId: 'goZLqjKL',
    triggerThreshold: 3,
    delayMs: 5000
  },
  'error-panel': {
    featureId: 'error-panel',
    typeformId: 'iFp4p4mV',
    triggerThreshold: 3,
    presentation: 'inline-cta'
  }
}

export function getSurveyConfig(
  featureId: string
): FeatureSurveyConfig | undefined {
  return FEATURE_SURVEYS[featureId]
}

export function getEnabledSurveys(): FeatureSurveyConfig[] {
  return Object.values(FEATURE_SURVEYS).filter(
    (config) => config.enabled !== false
  )
}

/**
 * Surveys that should auto-popup via the global controller.
 * Inline-CTA surveys are excluded because their feature-site renders them.
 */
export function getFloatingSurveys(): FeatureSurveyConfig[] {
  return getEnabledSurveys().filter(
    (config) => (config.presentation ?? 'floating') === 'floating'
  )
}
