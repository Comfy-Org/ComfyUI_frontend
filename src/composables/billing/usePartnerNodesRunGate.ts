import { createSharedComposable } from '@vueuse/core'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { usePartnerNodesInGraph } from '@/composables/node/usePartnerNodesInGraph'
import { isCloud } from '@/platform/distribution/types'

import type { PartnerNodeInfo } from '@/composables/node/usePartnerNodesInGraph'

type PartnerRunGate = 'sign-in' | 'none'

/**
 * Decides whether the local/desktop Run button must be replaced because the
 * graph contains partner nodes the user cannot run yet. Cloud has its own
 * billing-driven gating (CloudRunButtonWrapper) and always resolves 'none'.
 */
export const usePartnerNodesRunGate = createSharedComposable(() => {
  if (isCloud) {
    return {
      gate: computed<PartnerRunGate>(() => 'none'),
      partnerNodes: computed<PartnerNodeInfo[]>(() => [])
    }
  }

  const { partnerNodes, hasPartnerNodes } = usePartnerNodesInGraph()
  const { isLoggedIn } = useCurrentUser()

  const gate = computed<PartnerRunGate>(() =>
    hasPartnerNodes.value && !isLoggedIn.value ? 'sign-in' : 'none'
  )

  return { gate, partnerNodes }
})
