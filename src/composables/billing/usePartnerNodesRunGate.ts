import { createSharedComposable } from '@vueuse/core'
import { computed, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  scanPartnerNodesInGraph,
  usePartnerNodesInGraph
} from '@/composables/node/usePartnerNodesInGraph'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'

import type { PartnerNodeInfo } from '@/composables/node/usePartnerNodesInGraph'

type PartnerRunGate = 'sign-in' | 'none'

/**
 * A gate block has no server backstop, so every one is reported: a spike with
 * isLoggedIn true means the detection is wrong in production (see the Sentry
 * alert issue #16504).
 */
function reportGateBlocked(
  trigger: 'run-button' | 'auto-queue',
  partnerNodes: PartnerNodeInfo[],
  isLoggedIn: boolean
) {
  reportError(new Error(`Partner run gate blocked ${trigger}`), {
    errorType: 'partner_run_gate_blocked',
    level: 'warning',
    tags: { trigger, isLoggedIn, partnerNodeCount: partnerNodes.length },
    context: { partnerNodeTypes: partnerNodes.map((n) => n.nodeName) }
  })
}

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
  if (isLoggedIn.value) return false
  const partnerNodes = scanPartnerNodesInGraph()
  if (partnerNodes.length === 0) return false
  reportGateBlocked('auto-queue', partnerNodes, isLoggedIn.value)
  return true
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

  watch(
    gate,
    (value) => {
      if (value !== 'sign-in') return
      reportGateBlocked('run-button', partnerNodes.value, isLoggedIn.value)
    },
    { immediate: true }
  )

  return { gate, partnerNodes }
})
