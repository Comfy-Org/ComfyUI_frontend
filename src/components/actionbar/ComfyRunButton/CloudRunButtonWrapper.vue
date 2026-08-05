<template>
  <ComfyQueueButton
    v-if="canRunWorkflows || paymentRecoveryLock"
    :payment-recovery-lock="paymentRecoveryLock"
    @payment-recovery-click="showPaymentRecoveryDialog"
  />
  <SubscribeToRunButton v-else />
</template>
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

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
const isUpdatingPayment = ref(false)
let recoverySession = 0
let paymentPortalRequest: {
  session: number
  controller: AbortController
  promise: Promise<void>
} | null = null
let isUnmounted = false

onUnmounted(() => {
  isUnmounted = true
  recoverySession++
  paymentPortalRequest?.controller.abort()
  paymentPortalRequest = null
  closePaymentRecoveryDialog()
})

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

watch(paymentRecoveryLock, (lock, previousLock) => {
  if (!previousLock || lock === previousLock) return

  recoverySession++
  isUpdatingPayment.value = false
  paymentPortalRequest?.controller.abort()
  paymentPortalRequest = null
  closePaymentRecoveryDialog()
})

function updatePayment(session: number): Promise<void> {
  if (
    isUnmounted ||
    session !== recoverySession ||
    paymentRecoveryLock.value !== 'owner'
  ) {
    return Promise.resolve()
  }
  if (paymentPortalRequest?.session === session) {
    return paymentPortalRequest.promise
  }

  const controller = new AbortController()
  const request = (async () => {
    isUpdatingPayment.value = true
    dialogStore.updateDialog({
      key: DIALOG_KEY,
      contentProps: { isUpdatingPayment: true }
    })
    try {
      await manageSubscription(controller.signal)
      if (
        !isUnmounted &&
        session === recoverySession &&
        paymentRecoveryLock.value
      ) {
        closePaymentRecoveryDialog()
      }
    } catch (error) {
      if (
        !isUnmounted &&
        session === recoverySession &&
        paymentRecoveryLock.value
      ) {
        toastErrorHandler(error)
      }
    } finally {
      if (session === recoverySession) isUpdatingPayment.value = false
      if (paymentPortalRequest?.session === session) {
        paymentPortalRequest = null
      }
      if (
        !isUnmounted &&
        session === recoverySession &&
        paymentRecoveryLock.value
      ) {
        dialogStore.updateDialog({
          key: DIALOG_KEY,
          contentProps: { isUpdatingPayment: false }
        })
      }
    }
  })()

  paymentPortalRequest = { session, controller, promise: request }
  return request
}

function showPaymentRecoveryDialog() {
  if (!paymentRecoveryLock.value) return
  const session = recoverySession
  dialogService.showLayoutDialog({
    key: DIALOG_KEY,
    component: SubscriptionPausedDialog,
    props: {
      canManage: paymentRecoveryLock.value === 'owner',
      isUpdatingPayment: isUpdatingPayment.value,
      onClose: () => {
        if (session === recoverySession) closePaymentRecoveryDialog()
      },
      onUpdatePayment: () => updatePayment(session)
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
