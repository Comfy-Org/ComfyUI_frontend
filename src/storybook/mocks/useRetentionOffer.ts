import { readonly, shallowRef } from 'vue'

import type { useRetentionOffer as useActualRetentionOffer } from '@/platform/cloud/subscription/composables/useRetentionOffer'
import type { RetentionOfferPhase } from '@/platform/cloud/subscription/utils/retentionOffer'

export function useRetentionOffer(): ReturnType<
  typeof useActualRetentionOffer
> {
  const phase = shallowRef<RetentionOfferPhase>('offered')
  return {
    phase: readonly(phase),
    async accept() {
      phase.value = 'applied'
    },
    async recordShown() {}
  }
}
