import { createSharedComposable } from '@vueuse/core'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  scanPartnerNodesInGraph,
  usePartnerNodesInGraph
} from '@/composables/node/usePartnerNodesInGraph'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'

import type { PartnerNodeInfo } from '@/composables/node/usePartnerNodesInGraph'

type PartnerRunGate = 'sign-in' | 'none'

/**
 * Synchronous, unthrottled gate for the queue boundary: true when a local
 * signed-out user's current graph contains partner nodes they cannot run.
 * Every auto-queue path consults this before submitting, so no throttled
 * reactive snapshot can let a gated graph slip through.
 */
export function partnerRunGateBlocksAutoQueue(): boolean {
  if (isCloud) return false
  if (!useFeatureFlags().flags.partnerRunGateEnabled) return false
  const { isLoggedIn, isAuthResolved } = useCurrentUser()
  // A signed-in user reads as logged-out until Firebase resolves; never gate
  // on that transient state.
  if (!isAuthResolved.value) return false
  return !isLoggedIn.value && scanPartnerNodesInGraph().length > 0
}

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
  const { isLoggedIn, isAuthResolved } = useCurrentUser()
  const { flags } = useFeatureFlags()

  const gate = computed<PartnerRunGate>(() =>
    flags.partnerRunGateEnabled &&
    isAuthResolved.value &&
    hasPartnerNodes.value &&
    !isLoggedIn.value
      ? 'sign-in'
      : 'none'
  )

  return { gate, partnerNodes }
})
