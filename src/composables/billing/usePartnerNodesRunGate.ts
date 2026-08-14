import { createSharedComposable, useEventListener } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { usePartnerNodesInGraph } from '@/composables/node/usePartnerNodesInGraph'
import { isCloud } from '@/platform/distribution/types'
import { useAuthStore } from '@/stores/authStore'

import type { PartnerNodeInfo } from '@/composables/node/usePartnerNodesInGraph'

type PartnerRunGate = 'sign-in' | 'add-credits' | 'none'

/**
 * fetchBalance resolves null for 404 "new customer" without writing
 * authStore.balance, so the store alone cannot distinguish "known zero"
 * from "never fetched". The probe owns that distinction; 'unknown'
 * (network failure) fails open and is retried on the next trigger
 * (server errors remain the backstop).
 */
type BalanceProbe = 'idle' | 'pending' | 'zero' | 'positive' | 'unknown'

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
  const { isLoggedIn, resolvedUserInfo } = useCurrentUser()
  const authStore = useAuthStore()

  // Covers both auth modes: Firebase uid and API-key user id.
  const userId = computed(() => resolvedUserInfo.value?.id)

  const probe = ref<BalanceProbe>('idle')
  let probeGeneration = 0

  /** Only Firebase sign-in nulls authStore.balance; after an API-key switch it still holds the previous user's figure. */
  const isStoreBalanceStale = ref(false)

  const isStoreBalanceTrusted = computed(
    () => authStore.balance !== null && !isStoreBalanceStale.value
  )

  const probeBalance = async () => {
    const generation = ++probeGeneration
    const requestUserId = userId.value
    probe.value = 'pending'
    let result: BalanceProbe
    try {
      const balance = await authStore.fetchBalance()
      const micros = balance?.amount_micros
      result =
        typeof micros === 'number' && Number.isFinite(micros) && micros > 0
          ? 'positive'
          : 'zero'
    } catch (error) {
      console.warn('[partnerNodesRunGate] balance probe failed', error)
      result = 'unknown'
    }
    // A newer probe or an identity switch owns the state now.
    if (generation !== probeGeneration || userId.value !== requestUserId) {
      return
    }
    probe.value = result
    if (result !== 'unknown') isStoreBalanceStale.value = false
  }

  watch(
    [isLoggedIn, hasPartnerNodes, userId],
    ([loggedIn, hasNodes, id], previous) => {
      // The immediate run reports previous as [], which is not an identity change.
      const switchedIdentity = previous.length > 0 && id !== previous[2]
      if (!loggedIn || switchedIdentity) {
        probe.value = 'idle'
        // Only an identity change can leave another account's balance behind.
        if (switchedIdentity) isStoreBalanceStale.value = true
      }
      if (
        loggedIn &&
        hasNodes &&
        (probe.value === 'idle' || probe.value === 'unknown') &&
        !isStoreBalanceTrusted.value
      ) {
        void probeBalance()
      }
    },
    { immediate: true }
  )

  const hasNoCredits = computed(() => {
    if (isStoreBalanceTrusted.value) {
      return (authStore.balance?.amount_micros ?? 0) <= 0
    }
    return probe.value === 'zero'
  })

  const gate = computed<PartnerRunGate>(() => {
    if (!hasPartnerNodes.value) return 'none'
    if (!isLoggedIn.value) return 'sign-in'
    return hasNoCredits.value ? 'add-credits' : 'none'
  })

  // Top-up happens in an external Stripe tab; refresh when the user returns.
  // Also retries a probe that previously failed ('unknown').
  useEventListener(window, 'focus', () => {
    if (!isLoggedIn.value || !hasPartnerNodes.value) return
    if (gate.value === 'add-credits' || probe.value === 'unknown') {
      void probeBalance()
    }
  })

  return { gate, partnerNodes }
})
