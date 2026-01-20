import { computed } from 'vue'

import { getSurveyConfig } from './surveyRegistry'
import { useFeatureUsageTracker } from './useFeatureUsageTracker'

/**
 * Convenience composable for tracking feature usage for surveys.
 * Use this at the feature site to track when a feature is used.
 *
 * @example
 * ```typescript
 * const { trackFeatureUsed } = useSurveyFeatureTracking('simple-mode')
 *
 * function onFeatureAction() {
 *   trackFeatureUsed()
 * }
 * ```
 */
export function useSurveyFeatureTracking(featureId: string) {
  const config = getSurveyConfig(featureId)

  if (!config?.enabled) {
    return {
      trackFeatureUsed: () => {},
      useCount: computed(() => 0)
    }
  }

  const { trackUsage, useCount } = useFeatureUsageTracker(featureId)

  return {
    trackFeatureUsed: trackUsage,
    useCount
  }
}
