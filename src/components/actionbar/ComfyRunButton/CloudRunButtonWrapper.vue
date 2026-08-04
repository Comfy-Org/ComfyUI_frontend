<template>
  <ComfyQueueButton
    v-if="canRunWorkflows || paymentRecoveryLock"
    :payment-recovery-lock="paymentRecoveryLock"
    @payment-recovery-click="showPaymentRecoveryDialog"
  />
  <SubscribeToRunButton v-else />
</template>
<script setup lang="ts">
import { computed } from 'vue'

import ComfyQueueButton from '@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'
import SubscriptionPausedDialog from '@/platform/workspace/components/SubscriptionPausedDialog.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'subscription-paused'
const { canRunWorkflows, billingStatus, manageSubscription } =
  useBillingContext()
const { flags } = useFeatureFlags()
const { permissions } = useWorkspaceUI()
const dialogService = useDialogService()
const dialogStore = useDialogStore()
const { toastErrorHandler } = useErrorHandling()

const paymentRecoveryLock = computed<'owner' | 'member' | null>(() =>
  flags.v1PaymentRecovery && billingStatus.value === 'paused'
    ? permissions.value.canManageSubscription
      ? 'owner'
      : 'member'
    : null
)

function closePaymentRecoveryDialog() {
  dialogStore.closeDialog({ key: DIALOG_KEY })
}

async function updatePayment() {
  try {
    await manageSubscription()
    closePaymentRecoveryDialog()
  } catch (error) {
    toastErrorHandler(error)
  }
}

function showPaymentRecoveryDialog() {
  dialogService.showLayoutDialog({
    key: DIALOG_KEY,
    component: SubscriptionPausedDialog,
    props: {
      canManage: paymentRecoveryLock.value === 'owner',
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
