<template>
  <ComfyQueueButton
    v-if="
      !showsSubscribeToRunPrompt || paymentRecoveryLock || isSalesManagedPlan
    "
    :payment-recovery-lock="paymentRecoveryLock"
    @payment-recovery-click="showPaymentRecoveryDialog"
  />
  <SubscribeToRunButton v-else />
</template>
<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, onUnmounted, ref } from 'vue'

import ComfyQueueButton from '@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'
import { isSalesManagedTier } from '@/platform/cloud/subscription/constants/tierPricing'
import SubscriptionPausedDialog from '@/platform/workspace/components/SubscriptionPausedDialog.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'subscription-paused'
const {
  showsSubscribeToRunPrompt,
  billingStatus,
  subscription,
  manageSubscription,
  fetchStatus,
  fetchBalance
} = useBillingContext()

// A sales-managed plan has no self-serve checkout to upsell into; the run
// button stays a run button and lapsed access routes through sales.
const isSalesManagedPlan = computed(() =>
  isSalesManagedTier(subscription.value?.tier)
)
const { flags } = useFeatureFlags()
const { permissions } = useWorkspaceUI()
const dialogService = useDialogService()
const dialogStore = useDialogStore()
const { toastErrorHandler } = useErrorHandling()
const isUpdatingPayment = ref(false)
let paymentPortalRequest: Promise<void> | null = null
let billingRefreshRequest: Promise<void> | null = null
let isUnmounted = false
let refreshBillingOnFocus = false

onUnmounted(() => {
  isUnmounted = true
})

const paymentRecoveryLock = computed<'owner' | 'member' | null>(() =>
  flags.v1PaymentRecovery && billingStatus.value === 'paused'
    ? permissions.value.canManageSubscription
      ? 'owner'
      : 'member'
    : null
)

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
    fetchBalance()
  ]).then(() => undefined)
  void billingRefreshRequest.finally(() => {
    billingRefreshRequest = null
  })
}

useEventListener(window, 'focus', refreshStaleBillingState)
useEventListener(document, 'visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshStaleBillingState()
})

function closePaymentRecoveryDialog() {
  dialogStore.closeDialog({ key: DIALOG_KEY })
}

function updatePayment(): Promise<void> {
  if (paymentPortalRequest) return paymentPortalRequest

  paymentPortalRequest = (async () => {
    isUpdatingPayment.value = true
    dialogStore.updateDialog({
      key: DIALOG_KEY,
      contentProps: { isUpdatingPayment: true }
    })
    try {
      await manageSubscription()
      if (!isUnmounted) {
        refreshBillingOnFocus = true
        closePaymentRecoveryDialog()
      }
    } catch (error) {
      if (!isUnmounted) toastErrorHandler(error)
    } finally {
      isUpdatingPayment.value = false
      paymentPortalRequest = null
      if (!isUnmounted) {
        dialogStore.updateDialog({
          key: DIALOG_KEY,
          contentProps: { isUpdatingPayment: false }
        })
      }
    }
  })()

  return paymentPortalRequest
}

function showPaymentRecoveryDialog() {
  dialogService.showLayoutDialog({
    key: DIALOG_KEY,
    component: SubscriptionPausedDialog,
    props: {
      canManage: paymentRecoveryLock.value === 'owner',
      isUpdatingPayment: isUpdatingPayment.value,
      onClose: closePaymentRecoveryDialog,
      onUpdatePayment: updatePayment
    },
    dialogComponentProps: {
      renderer: 'reka',
      headless: true,
      contentClass:
        'w-[min(360px,95vw)] max-w-[min(360px,95vw)] sm:max-w-[min(360px,95vw)] border-0 bg-transparent shadow-none'
    }
  })
}
</script>
