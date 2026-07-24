import { ref, shallowRef } from 'vue'

import { checkAvailability } from '../api/modelDownloadApi'
import type { AvailabilityEntry } from '../types'

/**
 * Bulk-checks whether the models declared by a workflow are present,
 * downloading, or missing. Pass a `model_id -> source URL` map and badge
 * each model from the returned entries.
 */
export function useModelAvailability() {
  const results = shallowRef<Record<string, AvailabilityEntry>>({})
  const isChecking = ref(false)
  const error = ref<unknown>(null)

  async function check(models: Record<string, string>) {
    if (Object.keys(models).length === 0) {
      results.value = {}
      return results.value
    }
    isChecking.value = true
    error.value = null
    try {
      const response = await checkAvailability(models)
      results.value = response.models
      return response.models
    } catch (e) {
      error.value = e
      throw e
    } finally {
      isChecking.value = false
    }
  }

  return {
    results,
    isChecking,
    error,
    check
  }
}
