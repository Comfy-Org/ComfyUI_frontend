/**
 * The app's single billing SDK instance and the top-up effects the poller
 * performs today, moved onto the lifecycle's state: the progress toast, the
 * in-page challenge, and — for an operation this tab reattached to rather
 * than issued — the refresh, dialog routing, toast, and telemetry that the
 * dialog performs for the operations it issues itself.
 */
import type {
  BillingOperationState,
  BillingOperationTelemetryEvent,
  EmbeddedChallengePort,
  PendingBillingOperation
} from '@comfyorg/account/billing'
import { BILLING_OPERATION_TELEMETRY_EVENT } from '@comfyorg/account/billing'
import { loadStripe } from '@stripe/stripe-js/pure'
import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useTelemetry } from '@/platform/telemetry'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { CreateTopupResponse } from '@/platform/workspace/api/workspaceApi'
import { workspaceApiUrl } from '@/platform/workspace/api/workspaceApiUrl'
import { needsCustomerAttention } from '@/platform/workspace/billing/customerAttention'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useDialogStore } from '@/stores/dialogStore'

import { toBillingTelemetryEvent } from './billingSdkTelemetry'
import { createBillingSdk } from './createBillingSdk'
import {
  declineDetail,
  projectTopupOperation,
  projectTopupResult
} from './topupOperationView'

type ProgressKind = 'processing' | 'action'
type ToastMessage = Parameters<ReturnType<typeof useToastStore>['add']>[0]

async function loadChallengePort(): Promise<EmbeddedChallengePort | undefined> {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  const stripe = publishableKey
    ? await loadStripe(publishableKey).catch(() => null)
    : null
  if (!stripe) return undefined
  return {
    handleNextAction: (clientSecret) =>
      stripe.handleNextAction({ clientSecret })
  }
}

export const useBillingSdkStore = defineStore('billingSdk', () => {
  const workspaceAuthStore = useWorkspaceAuthStore()
  const toastStore = useToastStore()
  const { flags } = useFeatureFlags()

  const operations = shallowRef<readonly BillingOperationState[]>([])
  const dismissed = shallowRef<ReadonlySet<string>>(new Set())
  const resumedOperations = new Set<string>()
  const drivenChallenges = new Set<string>()
  const progressToasts = new Map<
    string,
    { kind: ProgressKind; message: ToastMessage }
  >()

  const sdk = createBillingSdk({
    session: workspaceAuthStore.getUnifiedSessionClient(),
    resolveUrl: workspaceApiUrl,
    workspaceId: () => workspaceAuthStore.getUnifiedMintWorkspaceId(),
    pointerStorage: sessionStorage,
    embeddedCheckoutAvailable: () =>
      flags.embeddedCheckoutEnabled &&
      Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY),
    onTelemetry: reportTelemetry,
    challengePort: loadChallengePort
  })

  sdk.lifecycle.subscribe((state) => {
    operations.value = sdk.lifecycle.getSnapshot()
    if (state.kind === 'topup') onTopupChanged(state)
  })

  const wake = () => {
    if (document.visibilityState === 'visible') sdk.lifecycle.wake()
  }
  useEventListener(document, 'visibilitychange', wake)
  useEventListener(window, 'focus', wake)

  const topupViews = computed(() =>
    operations.value
      .filter((state) => !dismissed.value.has(state.id))
      .flatMap((state) => projectTopupOperation(state) ?? [])
  )
  const isAddingCredits = computed(() =>
    topupViews.value.some(
      (view) =>
        view.status === 'pending' &&
        view.authenticationState !== 'failed_retryable'
    )
  )
  const topupActionOperation = computed(() =>
    topupViews.value.find(needsCustomerAttention)
  )

  // A top-up the dialog issued is reported by the dialog, exactly as before;
  // the lifecycle's events stand in for the poller's only on an operation
  // this tab reattached to.
  function reportTelemetry(event: BillingOperationTelemetryEvent) {
    if (!event.resumed) return
    if (event.name === BILLING_OPERATION_TELEMETRY_EVENT.started) {
      resumedOperations.add(event.billing_op_id)
    }
    useTelemetry()?.trackBillingEvent(toBillingTelemetryEvent(event))
  }

  function onTopupChanged(state: BillingOperationState) {
    if (state.phase === 'pending') {
      syncProgressToast(state)
      void driveRequiredChallenge(state)
      return
    }
    clearProgressToast(state.id)
    dismissed.value = new Set(
      [...dismissed.value].filter((id) => id !== state.id)
    )
    if (state.phase === 'timed_out') {
      toastStore.add({
        severity: 'error',
        summary: t('billingOperation.topupTimeout')
      })
    }
    if (resumedOperations.delete(state.id)) void settleResumed(state)
  }

  function syncProgressToast(state: PendingBillingOperation) {
    const kind: ProgressKind =
      state.actionUrl === undefined ? 'processing' : 'action'
    const current = progressToasts.get(state.id)
    if (current?.kind === kind) return
    if (current) toastStore.remove(current.message)
    const message: ToastMessage = {
      severity: kind === 'action' ? 'warn' : 'info',
      summary: t(
        kind === 'action'
          ? 'billingOperation.topupActionRequired'
          : 'billingOperation.topupProcessing'
      ),
      group: 'billing-operation'
    }
    progressToasts.set(state.id, { kind, message })
    toastStore.add(message)
  }

  function clearProgressToast(operationId: string) {
    const current = progressToasts.get(operationId)
    if (!current) return
    toastStore.remove(current.message)
    progressToasts.delete(operationId)
  }

  // One in-page challenge per operation, as the poller drives it: a later
  // challenge for the same operation waits for the customer's retry.
  async function driveRequiredChallenge(state: PendingBillingOperation) {
    if (state.challenge?.status !== 'required') return
    if (drivenChallenges.has(state.id)) return
    drivenChallenges.add(state.id)
    await sdk.driveChallenge(state.id)
  }

  async function settleResumed(state: BillingOperationState) {
    if (state.phase === 'succeeded') {
      const billingContext = useBillingContext()
      await Promise.allSettled([
        billingContext.fetchStatus(),
        billingContext.fetchBalance(),
        useBillingCapabilities().refresh()
      ])
      useDialogStore().closeDialog({ key: 'top-up-credits' })
      useSettingsDialog().show(isCloud ? 'workspace' : 'credits')
      toastStore.add({
        severity: 'success',
        summary: t('billingOperation.topupSuccess'),
        life: 5000
      })
      return
    }
    if (state.phase === 'failed') {
      toastStore.add({
        severity: 'error',
        summary: t('billingOperation.topupFailed'),
        detail: declineDetail(state.declineReason),
        life: 7000
      })
    }
  }

  async function createTopup(
    amountCents: number
  ): Promise<CreateTopupResponse | undefined> {
    const result = await sdk.topup.createTopupCheckout({ amountCents })
    if (result.status === 'ok') void useBillingCapabilities().refresh()
    return projectTopupResult(result, amountCents)
  }

  function recover() {
    void sdk.lifecycle.recover()
  }

  async function retryPaymentAuthentication(
    operationId: string
  ): Promise<boolean> {
    if (!flags.embeddedCheckoutEnabled) return false
    drivenChallenges.add(operationId)
    return (await sdk.driveChallenge(operationId)) === 'completed'
  }

  function dismissOperation(operationId: string) {
    dismissed.value = new Set([...dismissed.value, operationId])
  }

  return {
    isAddingCredits,
    topupActionOperation,
    createTopup,
    recover,
    retryPaymentAuthentication,
    dismissOperation
  }
})
