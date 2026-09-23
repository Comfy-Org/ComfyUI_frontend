import { createSharedComposable } from '@vueuse/core'
import { computed, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  scanPartnerNodesInGraph,
  usePartnerNodesInGraph
} from '@/composables/node/usePartnerNodesInGraph'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

import type { PartnerNodeInfo } from '@/composables/node/usePartnerNodesInGraph'

type PartnerRunGate = 'sign-in' | 'none'
type ApiKeyAuthStore = ReturnType<typeof useApiKeyAuthStore>

/**
 * A gate block has no server backstop, so every one is reported. The gate only
 * blocks when isLoggedIn is false, so the tags read the raw sessions instead:
 * either being true means a signed-in user was blocked (Sentry alert #16504).
 */
function reportGateBlocked(
  trigger: 'run-button' | 'auto-queue',
  partnerNodes: PartnerNodeInfo[],
  apiKeyStore: ApiKeyAuthStore
) {
  reportError(new Error(`Partner run gate blocked ${trigger}`), {
    errorType: 'partner_run_gate_blocked',
    level: 'warning',
    tags: {
      trigger,
      hasFirebaseSession: firebaseIdentity.currentUser() !== null,
      hasStoredApiKey: Boolean(apiKeyStore.getApiKey()),
      partnerNodeCount: partnerNodes.length
    },
    context: { partnerNodeTypes: partnerNodes.map((n) => n.nodeName) }
  })
}

/**
 * A signed-in user reads as logged-out until Firebase resolves and a stored
 * API key validates; never gate on that transient state.
 */
function isAuthResolving(apiKeyStore: ApiKeyAuthStore): boolean {
  return (
    !useAuthStore().isInitialized ||
    (Boolean(apiKeyStore.getApiKey()) && !apiKeyStore.isAuthenticated)
  )
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
  const apiKeyStore = useApiKeyAuthStore()
  if (isAuthResolving(apiKeyStore)) return false
  const { isLoggedIn } = useCurrentUser()
  if (isLoggedIn.value) return false
  const partnerNodes = scanPartnerNodesInGraph()
  if (partnerNodes.length === 0) return false
  reportGateBlocked('auto-queue', partnerNodes, apiKeyStore)
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
  const { isLoggedIn } = useCurrentUser()
  const { flags } = useFeatureFlags()
  const apiKeyStore = useApiKeyAuthStore()

  const gate = computed<PartnerRunGate>(() =>
    flags.partnerRunGateEnabled &&
    !isAuthResolving(apiKeyStore) &&
    hasPartnerNodes.value &&
    !isLoggedIn.value
      ? 'sign-in'
      : 'none'
  )

  watch(
    gate,
    (value) => {
      if (value !== 'sign-in') return
      reportGateBlocked('run-button', partnerNodes.value, apiKeyStore)
    },
    { immediate: true }
  )

  return { gate, partnerNodes }
})
