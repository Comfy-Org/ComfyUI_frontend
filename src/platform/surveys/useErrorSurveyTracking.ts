import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { useExecutionErrorStore } from '@/stores/executionErrorStore'

import { useSurveyFeatureTracking } from './useSurveyFeatureTracking'

const FEATURE_ID = 'error-panel'

/**
 * Counts error panel occurrences for nightly survey eligibility.
 * Each transition into an error state (from "no errors anywhere" to
 * "at least one error somewhere") increments the counter. This treats
 * a workflow load with multiple simultaneous error types as one event.
 * `immediate: true` ensures a workflow that loads already in an error
 * state (e.g. missing nodes/models on startup) counts on initial mount.
 */
export function useErrorSurveyTracking() {
  const { trackFeatureUsed } = useSurveyFeatureTracking(FEATURE_ID)
  const { hasAnyError } = storeToRefs(useExecutionErrorStore())

  watch(
    hasAnyError,
    (next, prev) => {
      if (!prev && next) trackFeatureUsed()
    },
    { immediate: true }
  )
}
