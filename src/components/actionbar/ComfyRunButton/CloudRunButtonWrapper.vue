<template>
  <ComfyQueueButton
    v-if="
      !showsSubscribeToRunPrompt || paymentRecoveryLock || isSalesManagedPlan
    "
    :payment-recovery-lock="paymentRecoveryLock"
    @payment-recovery-click="showPaymentRecoveryDialog(refreshOnReturn)"
  />
  <SubscribeToRunButton v-else />
</template>
<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed } from 'vue'

import ComfyQueueButton from '@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'
import { isSalesManagedTier } from '@/platform/cloud/subscription/constants/tierPricing'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { usePaymentRecoveryDialog } from '@/platform/workspace/composables/usePaymentRecoveryDialog'

const { showsSubscribeToRunPrompt, subscription, fetchStatus, fetchBalance } =
  useBillingContext()
const { paymentRecoveryAvailable, refresh: refreshCapabilities } =
  useBillingCapabilities()
const { showPaymentRecoveryDialog } = usePaymentRecoveryDialog()

// A sales-managed plan has no self-serve checkout to upsell into; the run
// button stays a run button and lapsed access routes through sales.
const isSalesManagedPlan = computed(() =>
  isSalesManagedTier(subscription.value?.tier)
)
let billingRefreshRequest: Promise<void> | null = null
let refreshBillingOnFocus = false

const paymentRecoveryLock = computed<'owner' | null>(() =>
  paymentRecoveryAvailable.value ? 'owner' : null
)

function refreshOnReturn() {
  refreshBillingOnFocus = true
}

function refreshStaleBillingState() {
  if (
    billingRefreshRequest ||
    (!refreshBillingOnFocus &&
      (!showsSubscribeToRunPrompt.value || paymentRecoveryLock.value))
  ) {
    return
  }

  refreshBillingOnFocus = false
  billingRefreshRequest = Promise.allSettled([
    fetchStatus(),
    fetchBalance(),
    refreshCapabilities()
  ]).then(() => undefined)
  void billingRefreshRequest.finally(() => {
    billingRefreshRequest = null
  })
}

useEventListener(window, 'focus', refreshStaleBillingState)
useEventListener(document, 'visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshStaleBillingState()
})
</script>
