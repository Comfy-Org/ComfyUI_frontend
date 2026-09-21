/**
 * The app's single billing SDK instance and the top-up effects the poller
 * performs today, moved onto the lifecycle's state: the progress toast, the
 * in-page challenge, and — for an operation this tab reattached to rather
 * than issued — the refresh, dialog routing, toast, and telemetry that the
 * dialog performs for the operations it issues itself.
 */
import type {
  BillingOperationState,
  BillingEventsReadOptions,
  BillingOperationTelemetryEvent,
  BillingResult,
  CapabilitiesReadOptions,
  EmbeddedChallengePort,
  PendingBillingOperation,
  PreviewSubscribeInput,
  SubscribeInput
} from '@comfyorg/account-core/billing'
import {
  BILLING_OPERATION_TELEMETRY_EVENT,
  validateActionUrl
} from '@comfyorg/account-core/billing'
import { loadStripe } from '@stripe/stripe-js/pure'
import { until, useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useTelemetry } from '@/platform/telemetry'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type {
  BillingBalanceResponse,
  BillingCapabilitiesResponse,
  BillingEventsResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  CreateTopupResponse,
  PreviewSubscribeResponse,
  SavedPaymentMethod,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { workspaceApiUrl } from '@/platform/workspace/api/workspaceApiUrl'
import { needsCustomerAttention } from '@/platform/workspace/billing/customerAttention'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useDialogStore } from '@/stores/dialogStore'

import { projectBillingCapabilities } from './billingCapabilitiesView'
import { projectBillingPlans } from './billingPlansView'
import { toBillingTelemetryEvent } from './billingSdkTelemetry'
import { projectBillingStatus } from './billingStatusView'
import { createBillingSdk } from './createBillingSdk'
import type { BillingOperationRecordView } from './operationRecordView'
import { projectOperationRecord } from './operationRecordView'
import type { SubscriptionRailOutcome } from './subscriptionOperationView'
import {
  projectPaymentPortalResult,
  projectPreviewSubscribeResult,
  projectSubscribeResult,
  projectSubscriptionResult
} from './subscriptionOperationView'
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
  const workspaceStore = useTeamWorkspaceStore()
  const toastStore = useToastStore()
  const { flags } = useFeatureFlags()

  const operations = shallowRef<readonly BillingOperationState[]>([])
  const dismissed = shallowRef<ReadonlySet<string>>(new Set())
  const resumedOperations = new Set<string>()
  const drivenChallenges = new Set<string>()
  const offeredActions = new Map<string, Set<string>>()
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
    hostedDestination: () => flags.hostedBillingDestination,
    onTelemetry: reportTelemetry,
    challengePort: loadChallengePort
  })

  sdk.lifecycle.subscribe((state) => {
    operations.value = sdk.lifecycle.getSnapshot()
    if (state.kind === 'topup') onTopupChanged(state)
    else onSubscriptionChanged(state)
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

  // The lifecycle already refuses anything but https on the way in
  // (`operationLifecycle.ts` adoption, `operationState.ts` on every poll); the
  // same predicate runs again here so the rule holds for whoever publishes a
  // state, and so the guarantee is readable where the URL is handed out.
  const hostedActionUrl = (state: BillingOperationState): string | undefined =>
    state.phase === 'pending' ? validateActionUrl(state.actionUrl) : undefined

  const subscriptionActionUrl = computed(
    () =>
      operations.value.flatMap((state) =>
        state.kind === 'subscription' ? (hostedActionUrl(state) ?? []) : []
      )[0] ?? null
  )

  // The four below mirror `billingOperationStore`'s own predicates, including
  // where it does and does not scope to the active workspace: the lifecycle
  // keeps operations from a scope it has left, and a consumer switching rails
  // must not find a different answer on the other side.
  const operationRecords = computed(() =>
    operations.value.flatMap((state) => projectOperationRecord(state) ?? [])
  )

  const hasPendingOperations = computed(() =>
    operationRecords.value.some((record) => record.status === 'pending')
  )

  const isSettingUp = computed(() =>
    operationRecords.value.some(
      (record) =>
        record.kind === 'subscription' &&
        record.status === 'pending' &&
        record.authenticationState !== 'requires_action' &&
        record.authenticationState !== 'failed_retryable' &&
        record.workspaceId === workspaceStore.activeWorkspaceId
    )
  )

  const subscriptionActionOperation = computed(() =>
    operationRecords.value.find(
      (record) =>
        record.kind === 'subscription' &&
        record.workspaceId === workspaceStore.activeWorkspaceId &&
        needsCustomerAttention(record)
    )
  )

  function getOperation(opId: string): BillingOperationRecordView | undefined {
    return operationRecords.value.find((record) => record.opId === opId)
  }

  // A top-up the dialog issued is reported by the dialog, exactly as before;
  // the lifecycle's events stand in for the poller's only on an operation
  // this tab reattached to. A cancel or resubscribe has no such second
  // reporter on this rail — the poller owned both ends of it on the legacy
  // one — so the lifecycle's events are the only ones it emits.
  function reportTelemetry(event: BillingOperationTelemetryEvent) {
    if (event.operation_type === 'topup' && !event.resumed) return
    if (
      event.resumed &&
      event.name === BILLING_OPERATION_TELEMETRY_EVENT.started
    ) {
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

  // A subscribe the SDK settles has no dialog watching it, so the two customer
  // steps the checkout performs for the legacy response — driving the in-page
  // challenge and opening the hosted payment page — are performed here, or the
  // operation waits on a customer who was never shown anything.
  function onSubscriptionChanged(state: BillingOperationState) {
    if (state.phase !== 'pending') {
      offeredActions.delete(state.id)
      return
    }
    void driveRequiredChallenge(state)
    openHostedAction(state)
  }

  // One offer per hosted step, not per poll, and not again for a step this
  // operation already offered: the open runs off the lifecycle rather than a
  // click, so a browser that blocked the first one blocks every retry and each
  // retry would repeat the warning. A step the customer still owes stays on
  // `subscriptionActionUrl` for the checkout to put behind a button of their
  // own.
  function openHostedAction(state: PendingBillingOperation) {
    const actionUrl = hostedActionUrl(state)
    if (actionUrl === undefined) return
    const offered = offeredActions.get(state.id) ?? new Set<string>()
    if (offered.has(actionUrl)) return
    offeredActions.set(state.id, offered.add(actionUrl))
    if (window.open(actionUrl, '_blank')) return
    toastStore.add({
      severity: 'warn',
      summary: t('g.warning'),
      detail: t('subscription.preview.paymentPopupBlocked')
    })
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

  // The backend gate on these routes is independent of the client flag, so a
  // 404 means the rail is on too early. One answer settles it for the tab:
  // every later action goes straight to the legacy call.
  let subscriptionRouteAvailable = true

  async function onSubscriptionRoute<T>(
    run: () => Promise<SubscriptionRailOutcome<T>>
  ): Promise<SubscriptionRailOutcome<T>> {
    if (!subscriptionRouteAvailable) return { status: 'unavailable' }
    const outcome = await run()
    if (outcome.status === 'unavailable') subscriptionRouteAvailable = false
    return outcome
  }

  async function runSubscriptionCommand<T>(
    command: () => Promise<SubscriptionRailOutcome<T>>,
    refresh: () => Promise<void>
  ): Promise<SubscriptionRailOutcome<T>> {
    const outcome = await onSubscriptionRoute(command)
    if (outcome.status === 'ok') await refresh()
    return outcome
  }

  // What the poller refreshes when one of its operations succeeds, so the
  // panels read the same state whichever rail settled the operation.
  async function refreshAfterCancel(): Promise<void> {
    const billingContext = useBillingContext()
    await Promise.allSettled([
      billingContext.fetchStatus(),
      billingContext.fetchBalance(),
      useBillingCapabilities().refresh()
    ])
  }

  async function refreshAfterSubscriptionChange(): Promise<void> {
    const billingContext = useBillingContext()
    await Promise.allSettled([
      billingContext.reconcileSubscriptionSuccess(),
      useBillingCapabilities().refresh()
    ])
  }

  function cancelSubscription(): Promise<SubscriptionRailOutcome> {
    return runSubscriptionCommand(
      async () =>
        projectSubscriptionResult(await sdk.commands.cancelSubscription()),
      refreshAfterCancel
    )
  }

  function resubscribe(): Promise<SubscriptionRailOutcome> {
    return runSubscriptionCommand(
      async () => projectSubscriptionResult(await sdk.commands.resubscribe()),
      refreshAfterSubscriptionChange
    )
  }

  function subscribe(
    input: SubscribeInput
  ): Promise<SubscriptionRailOutcome<SubscribeResponse>> {
    return runSubscriptionCommand(
      async () => projectSubscribeResult(await sdk.commands.subscribe(input)),
      refreshAfterSubscriptionChange
    )
  }

  // A quote changes nothing, so it refreshes nothing; it shares the route
  // latch because the backend gates it with the rest of them.
  async function previewSubscribe(
    input: PreviewSubscribeInput
  ): Promise<SubscriptionRailOutcome<PreviewSubscribeResponse>> {
    return onSubscriptionRoute(async () =>
      projectPreviewSubscribeResult(await sdk.commands.previewSubscribe(input))
    )
  }

  async function openPaymentPortal(
    returnUrl: string
  ): Promise<SubscriptionRailOutcome<string>> {
    const outcome = await onSubscriptionRoute(async () =>
      projectPaymentPortalResult(
        await sdk.commands.openPaymentPortal({ returnUrl })
      )
    )
    // The portal may add or remove a card and says nothing on the way back, so
    // handing the URL out is the last moment this tab's list is known good.
    if (outcome.status === 'ok') sdk.paymentMethods.invalidate()
    return outcome
  }

  function recover() {
    void sdk.lifecycle.recover()
  }

  /**
   * Adopt the operation the server reports pending and resolve once it settles,
   * for the caller that has something to decide on the outcome.
   * `lifecycle.recover()` resolves at adoption, not at settlement, and it
   * adopts whatever the server names — so an id other than the one asked for
   * means the pointer this caller held is stale.
   */
  async function recoverPendingOperation(
    opId: string
  ): Promise<BillingOperationRecordView | undefined> {
    const adopted = await sdk.lifecycle.recover()
    if (adopted.status === 'error' || adopted.value?.id !== opId) {
      return undefined
    }
    const record = computed(() => getOperation(opId))
    return until(record).toMatch(
      (view) => view === undefined || view.status !== 'pending'
    )
  }

  // The readers the commands above already refresh after a success, exposed
  // so the panels read the state the rail settled rather than a second read
  // through the workspace client.
  async function readStatus(): Promise<BillingResult<BillingStatusResponse>> {
    const result = await sdk.status.read()
    if (result.status === 'error') return result
    const status = projectBillingStatus(result.value.status)
    return status === undefined
      ? { status: 'error', code: 'MALFORMED_RESPONSE' }
      : { status: 'ok', value: status }
  }

  async function readBalance(): Promise<BillingResult<BillingBalanceResponse>> {
    const result = await sdk.credits.read()
    return result.status === 'ok'
      ? { status: 'ok', value: result.value.balance }
      : result
  }

  async function readPlans(): Promise<BillingResult<BillingPlansResponse>> {
    const result = await sdk.plans.read()
    if (result.status === 'error') return result
    const plans = projectBillingPlans(result.value.data)
    return plans === undefined
      ? { status: 'error', code: 'MALFORMED_RESPONSE' }
      : { status: 'ok', value: plans }
  }

  async function readCapabilities(
    options: CapabilitiesReadOptions
  ): Promise<BillingResult<BillingCapabilitiesResponse>> {
    const result = await sdk.capabilities.read(options)
    return result.status === 'ok'
      ? { status: 'ok', value: projectBillingCapabilities(result.value) }
      : result
  }

  async function readPaymentMethods(): Promise<
    BillingResult<SavedPaymentMethod[]>
  > {
    const result = await sdk.paymentMethods.read()
    return result.status === 'ok'
      ? { status: 'ok', value: [...result.value.methods] }
      : result
  }

  // The one read with nothing to project: the events response carries no
  // int64, so the decoded page already holds the numbers the host's type
  // says it does. Only the scope and read instant the snapshot adds are
  // dropped here.
  async function readEvents(
    options?: BillingEventsReadOptions
  ): Promise<BillingResult<BillingEventsResponse>> {
    const result = await sdk.events.read(options)
    if (result.status === 'error') return result
    const { events, page, limit, total, totalPages } = result.value
    return {
      status: 'ok',
      value: { events: [...events], page, limit, total, totalPages }
    }
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
    subscriptionActionUrl,
    hasPendingOperations,
    isSettingUp,
    subscriptionActionOperation,
    getOperation,
    recoverPendingOperation,
    createTopup,
    subscribe,
    previewSubscribe,
    cancelSubscription,
    resubscribe,
    openPaymentPortal,
    recover,
    readStatus,
    readBalance,
    readPlans,
    readCapabilities,
    readPaymentMethods,
    readEvents,
    retryPaymentAuthentication,
    dismissOperation
  }
})
