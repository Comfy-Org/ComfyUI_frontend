import { computed } from 'vue'

import { useErrorClassification } from './useErrorClassification'

export function useHasBlockingError() {
  const errorClassification = useErrorClassification()

  return computed(() => errorClassification.value.hasBlockingError)
}
