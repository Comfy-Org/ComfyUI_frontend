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
  const { trackUsage, useCount } = useFeatureUsageTracker(featureId)

  function trackFeatureUsed() {
    if (!config?.enabled) return
    trackUsage()
  }

  return {
    trackFeatureUsed,
    useCount
  }
}
