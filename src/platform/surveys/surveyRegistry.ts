import type { FeatureSurveyConfig } from './useSurveyEligibility'

/**
 * Registry of all feature surveys.
 * Add new surveys here when targeting specific features for feedback.
 */
export const FEATURE_SURVEYS: Record<string, FeatureSurveyConfig> = {
  // Example survey - replace with actual feature surveys
  // 'simple-mode': {
  //   featureId: 'simple-mode',
  //   typeformId: 'abc123',
  //   triggerThreshold: 3,
  //   delayMs: 5000,
  //   enabled: true
  // }
}

/** @public */
export type FeatureId = keyof typeof FEATURE_SURVEYS

export function getSurveyConfig(
  featureId: string
): FeatureSurveyConfig | undefined {
  return FEATURE_SURVEYS[featureId]
}

export function getEnabledSurveys(): FeatureSurveyConfig[] {
  return Object.values(FEATURE_SURVEYS).filter((config) => config.enabled)
}
