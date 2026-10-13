import { readonly, shallowRef } from 'vue'

import type { useRetentionOffer as useActualRetentionOffer } from '@/platform/cloud/subscription/composables/useRetentionOffer'
import type { RetentionOfferPhase } from '@/platform/cloud/subscription/utils/retentionOffer'

const phase = shallowRef<RetentionOfferPhase>('offered')

export function resetRetentionOfferMock() {
  phase.value = 'offered'
}

export function useRetentionOffer(): ReturnType<
  typeof useActualRetentionOffer
> {
  return {
    phase: readonly(phase),
    async accept() {
      phase.value = 'applied'
    },
    async recordShown() {}
  }
}
