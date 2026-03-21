import { useSettingStore } from '@/platform/settings/settingStore'

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
    delayMs: 5000,
    isFeatureActive: () => {
      const settingStore = useSettingStore()
      return (
        settingStore.get('Comfy.NodeSearchBoxImpl') !== 'litegraph (legacy)'
      )
    }
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
