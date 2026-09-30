import { storeToRefs } from 'pinia'

import { useExecutionErrorStore } from '@/stores/executionErrorStore'

export function useErrorClassification() {
  return storeToRefs(useExecutionErrorStore()).errorClassification
}
