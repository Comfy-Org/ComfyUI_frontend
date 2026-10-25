import {
  createSharedComposable,
  defaultDocument,
  useEventListener
} from '@vueuse/core'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'

import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { onCapabilityRevision } from '@/platform/billing/api/capabilityRevision'
import type { BillingCapabilitiesRead } from '@/platform/workspace/api/workspaceApi'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { readOnRail } from '@/platform/billing/composables/readOnRail'
import { useBillingReadRail } from '@/platform/billing/composables/useBillingReadRail'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { reportWorkspaceScopeMismatch } from '@/platform/workspace/telemetry/workspaceTelemetryContext'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

type CapabilityReadState =
  | { status: 'idle' }
  | {
      status: 'pending' | 'denied'
      authUid: string
      workspaceId: string
    }
  | {
      status: 'unavailable'
      authUid: string
      workspaceId: string
      retryAt: number
    }
  | {
      status: 'resolved'
      authUid: string
      workspaceId: string
      response: BillingCapabilitiesRead
      refreshAt: number
    }

// A remaining lifetime below the floor means the client clock disagrees with
// the server's, so it cannot pace the refetch and the fixed interval is used
// instead; clamping it would only slow the loop. The ceiling bounds the
// opposite skew, where a lagging clock reads expires_at as far in the future.
const MIN_REFRESH_DELAY_MS = 5_000
const MAX_REFRESH_DELAY_MS = 60 * 60 * 1000
const FALLBACK_REFRESH_DELAY_MS = 60_000
// An outage fails every visible session at once, so a flat retry interval would
// keep them retrying in lockstep. Consecutive failures double up to this
// ceiling, and each delay is jittered to spread the sessions apart.
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000

interface ActiveCapabilityRequest {
  requestId: number
  authUid: string
  workspaceId: string
  controller: AbortController
  promise: Promise<void>
}

/**
 * The read itself, on whichever rail the tab is on. A revalidation already
 * knows the snapshot is stale — a mutation or the expiry timer said so — so it
 * bypasses the SDK's cache; the first read for a scope takes what the SDK
 * already holds, which is what the shared top-up flow read.
 */
function readCapabilitiesResponse(
  signal: AbortSignal,
  revalidating: boolean
): Promise<BillingCapabilitiesRead | undefined> {
  const rail = useBillingReadRail()
  if (rail === null) return workspaceApi.getBillingCapabilities(signal)
  return readOnRail(
    () => rail.readCapabilities({ signal, forceRefresh: revalidating }),
    'getBillingCapabilities'
  )
}

function useBillingCapabilitiesInternal() {
  const authStore = useAuthStore()
  const apiKeyAuthStore = useApiKeyAuthStore()
  const workspaceStore = useTeamWorkspaceStore()
  const actorId = computed(
    () => authStore.userId ?? apiKeyAuthStore.currentUser?.id
  )
  const readState = shallowRef<CapabilityReadState>({ status: 'idle' })
  let initialized = false
  let latestRequestId = 0
  let activeRequest: ActiveCapabilityRequest | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let readFailures = 0
  let invalidatedRequestId = 0

  const resolvedResponse = computed(() => {
    const userId = actorId.value
    const workspaceId = workspaceStore.activeWorkspaceId
    const state = readState.value
    if (
      !userId ||
      !workspaceId ||
      state.status !== 'resolved' ||
      state.authUid !== userId ||
      state.workspaceId !== workspaceId ||
      state.response.resolved_for.workspace_id !== workspaceId
    ) {
      return null
    }

    return state.response
  })
  const capabilities = computed(
    () => resolvedResponse.value?.capabilities ?? null
  )
  const hasResolvedCapabilities = computed(() => capabilities.value !== null)
  const canTopUp = computed(() => capabilities.value?.can_top_up ?? false)
  const topUpDenial = computed<string | undefined>(
    () => resolvedResponse.value?.denied_reasons?.can_top_up
  )
  const canManageBilling = computed(() =>
    receiveServerFact(
      'can_manage_billing',
      capabilities.value?.can_manage_billing ?? false
    )
  )
  const canSubscribeSelfServe = computed(
    () => capabilities.value?.can_subscribe_self_serve ?? false
  )
  const canOpenPlans = computed(() =>
    receiveServerFact(
      'can_open_plans',
      capabilities.value?.can_open_plans ?? false
    )
  )
  const canCancel = computed(() => capabilities.value?.can_cancel ?? false)
  const canReactivate = computed(
    () => capabilities.value?.can_reactivate ?? false
  )
  const canRevertScheduledChange = computed(() =>
    receiveServerFact(
      'can_revert_scheduled_change',
      capabilities.value?.can_revert_scheduled_change ?? false
    )
  )
  const canChangeSeats = computed(
    () => capabilities.value?.can_change_seats ?? false
  )
  const canManageMembers = computed(() =>
    receiveServerFact(
      'can_manage_members',
      capabilities.value?.can_manage_members ?? false
    )
  )
  const canInviteMembers = computed(() =>
    receiveServerFact(
      'can_invite_members',
      capabilities.value?.can_invite_members ?? false
    )
  )
  const canDeleteWorkspace = computed(() =>
    receiveServerFact(
      'can_delete_workspace',
      capabilities.value?.can_delete_workspace ?? false
    )
  )
  const deleteWorkspaceDenial = computed<string | undefined>(
    () => resolvedResponse.value?.denied_reasons?.can_delete_workspace
  )
  const canEditWorkspace = computed(() =>
    receiveServerFact(
      'can_edit_workspace',
      capabilities.value?.can_edit_workspace ?? false
    )
  )
  const canLeaveWorkspace = computed(() =>
    receiveServerFact(
      'can_leave_workspace',
      capabilities.value?.can_leave_workspace ?? false
    )
  )
  const leaveWorkspaceDenial = computed<string | undefined>(
    () => resolvedResponse.value?.denied_reasons?.can_leave_workspace
  )
  const canManageSubscription = computed(() =>
    receiveServerFact(
      'can_manage_subscription',
      capabilities.value?.can_manage_subscription ?? false
    )
  )
  const canDowngradeToPersonal = computed(
    () => capabilities.value?.can_downgrade_to_personal ?? false
  )
  const canManageAutoTopUp = computed(() =>
    receiveServerFact(
      'can_manage_auto_top_up',
      capabilities.value?.can_manage_auto_top_up ?? false
    )
  )
  const autoTopUpSetup = computed(
    () => resolvedResponse.value?.auto_top_up_setup ?? null
  )
  const canRunWorkflows = computed(
    () => capabilities.value?.can_run_workflows ?? false
  )
  const paymentRecoveryAvailable = computed(() =>
    receiveServerFact(
      'payment_recovery_available',
      resolvedResponse.value?.payment_recovery_available ?? false
    )
  )
  const hasParkedBillingOperation = computed(() =>
    receiveServerFact(
      'has_parked_billing_operation',
      resolvedResponse.value?.has_parked_billing_operation === true
    )
  )
  const runWorkflowsDenial = computed(() =>
    receiveServerFact(
      'denied_reasons.can_run_workflows',
      resolvedResponse.value?.denied_reasons?.can_run_workflows
    )
  )
  const runDeniedPaymentPastDue = computed(
    () => runWorkflowsDenial.value === 'payment_past_due'
  )
  const isReady = computed(() => {
    const state = readState.value
    if (state.status === 'idle' || state.status === 'pending') return false
    return (
      state.authUid === actorId.value &&
      state.workspaceId === workspaceStore.activeWorkspaceId
    )
  })

  const snapshotAuthoritative = computed(() => {
    const state = readState.value
    if (state.status !== 'resolved' && state.status !== 'denied') return false
    return (
      state.authUid === actorId.value &&
      state.workspaceId === workspaceStore.activeWorkspaceId
    )
  })

  function trackCapabilityRead(succeeded: boolean): void {
    useTelemetry()?.trackBillingEvent({
      operation: 'capability_read',
      ...(succeeded
        ? { stage: 'succeeded', outcome: 'success' }
        : { stage: 'failed', outcome: 'failure' })
    })
  }

  function clearRefreshTimer(): void {
    if (refreshTimer === null) return
    clearTimeout(refreshTimer)
    refreshTimer = null
  }

  function scheduledRefreshAt(state: CapabilityReadState): number | null {
    if (state.status === 'resolved') return state.refreshAt
    return state.status === 'unavailable' ? state.retryAt : null
  }

  /** Requires `readFailures` to already count this failure. */
  function unavailableState(
    authUid: string,
    workspaceId: string
  ): CapabilityReadState {
    const delay = Math.min(
      FALLBACK_REFRESH_DELAY_MS * 2 ** (readFailures - 1),
      MAX_RETRY_DELAY_MS
    )
    return {
      status: 'unavailable',
      authUid,
      workspaceId,
      retryAt: Date.now() + delay / 2 + Math.random() * (delay / 2)
    }
  }

  // NaN from an unparseable timestamp fails the comparison and lands on the
  // fixed interval.
  function nextRefreshAt(response: BillingCapabilitiesRead): number {
    const now = Date.now()
    const remaining = Date.parse(response.expires_at) - now
    if (remaining >= MIN_REFRESH_DELAY_MS) {
      return now + Math.min(remaining, MAX_REFRESH_DELAY_MS)
    }
    return now + FALLBACK_REFRESH_DELAY_MS
  }

  // `capabilities` is a computed, and wall-clock time is not a reactive
  // dependency, so expiry has to be pushed rather than read lazily. The timer
  // runs only while the document is visible: staleness is unobservable in a
  // hidden tab, and returning to the tab is itself a visibility transition.
  function scheduleRefresh(): void {
    clearRefreshTimer()
    const refreshAt = scheduledRefreshAt(readState.value)
    if (refreshAt === null) return
    if (defaultDocument?.visibilityState === 'hidden') return

    const delay = Math.max(0, refreshAt - Date.now())
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      void fetchCapabilities()
    }, delay)
  }

  useEventListener(defaultDocument, 'visibilitychange', () => {
    if (defaultDocument?.visibilityState === 'hidden') {
      clearRefreshTimer()
      return
    }
    const refreshAt = scheduledRefreshAt(readState.value)
    if (refreshAt === null) return
    if (refreshAt <= Date.now()) void fetchCapabilities()
    else scheduleRefresh()
  })

  const stopRevisionListener = onCapabilityRevision((revision) => {
    // A read already in flight may have loaded its data before this mutation
    // committed, and the revision it returns cannot rule that out: the server
    // mints that number when it serializes the response, not when it read. So
    // the read is refetched once it settles - the dedupe below would otherwise
    // hand back the very request that missed the mutation.
    if (activeRequest) invalidatedRequestId = activeRequest.requestId
    const state = readState.value
    if (state.status !== 'resolved' || state.response.revision === revision) {
      return
    }
    void fetchCapabilities()
  })

  onScopeDispose(() => {
    clearRefreshTimer()
    stopRevisionListener()
  })

  /** Cancels the in-flight read and its timer, leaving the snapshot in place. */
  function cancelActiveRead(): void {
    clearRefreshTimer()
    latestRequestId++
    activeRequest?.controller.abort()
    activeRequest = null
  }

  function resetRead(): void {
    cancelActiveRead()
    readState.value = { status: 'idle' }
  }

  async function fetchCapabilities(signal?: AbortSignal): Promise<void> {
    const userId = actorId.value
    const workspaceId = workspaceStore.activeWorkspaceId
    if (!userId || !workspaceId) {
      resetRead()
      return
    }

    if (
      activeRequest?.authUid === userId &&
      activeRequest.workspaceId === workspaceId &&
      !activeRequest.controller.signal.aborted
    ) {
      return activeRequest.promise
    }

    // Refetching the same scope revalidates in the background, keeping the
    // prior read - a resolved snapshot or the unavailable fallback - readable
    // so its affordances do not blink out once per refresh. A scope change
    // makes it wrong, not stale, so it resets.
    const currentState = readState.value
    const revalidating =
      (currentState.status === 'resolved' ||
        currentState.status === 'unavailable') &&
      currentState.authUid === userId &&
      currentState.workspaceId === workspaceId
    const priorSnapshot =
      revalidating && currentState.status === 'resolved' ? currentState : null

    if (revalidating) cancelActiveRead()
    else resetRead()

    const requestId = ++latestRequestId
    const controller = new AbortController()
    const abortRequest = () => controller.abort()
    if (signal?.aborted) controller.abort()
    else signal?.addEventListener('abort', abortRequest, { once: true })
    if (!revalidating) {
      readState.value = {
        status: 'pending',
        authUid: userId,
        workspaceId
      }
    }

    const promise = (async () => {
      let refetchAfterSettle = false
      try {
        const response = await readCapabilitiesResponse(
          controller.signal,
          revalidating
        )
        if (
          requestId !== latestRequestId ||
          userId !== actorId.value ||
          workspaceId !== workspaceStore.activeWorkspaceId
        ) {
          return
        }
        // The SDK's scope moved on under the read while the stores' did not:
        // a switch mid-flight. It retries on the outage timer, unreported,
        // because the next read answers for whichever scope settles.
        if (response === undefined) {
          readFailures++
          readState.value = priorSnapshot
            ? {
                ...priorSnapshot,
                refreshAt: Date.now() + FALLBACK_REFRESH_DELAY_MS
              }
            : unavailableState(userId, workspaceId)
          scheduleRefresh()
          return
        }

        const resolvedForScope =
          response.resolved_for.workspace_id === workspaceId
        trackCapabilityRead(resolvedForScope)
        if (resolvedForScope) {
          readFailures = 0
          readState.value = {
            status: 'resolved',
            authUid: userId,
            workspaceId,
            response,
            refreshAt: nextRefreshAt(response)
          }
        } else {
          readFailures++
          readState.value = unavailableState(userId, workspaceId)
          reportWorkspaceScopeMismatch(
            workspaceId,
            response.resolved_for.workspace_id
          )
        }
        scheduleRefresh()
        refetchAfterSettle =
          resolvedForScope && invalidatedRequestId === requestId
      } catch (error) {
        if (
          requestId !== latestRequestId ||
          userId !== actorId.value ||
          workspaceId !== workspaceStore.activeWorkspaceId
        ) {
          return
        }
        if (controller.signal.aborted) {
          if (!revalidating) readState.value = { status: 'idle' }
          return
        }

        const denied =
          (error instanceof WorkspaceApiError &&
            (error.status === 401 || error.status === 403)) ||
          (error instanceof Error && error.name === 'AuthStoreError')
        if (!denied) trackCapabilityRead(false)
        // A transient failure keeps the last good snapshot - stale, not wrong -
        // and retries. A denial is the server answering about this actor, so it
        // replaces the snapshot even mid-revalidation.
        const firstFailure = readFailures === 0
        if (!denied) readFailures++
        if (priorSnapshot && !denied) {
          readState.value = {
            ...priorSnapshot,
            refreshAt: Date.now() + FALLBACK_REFRESH_DELAY_MS
          }
        } else {
          readState.value = denied
            ? { status: 'denied', authUid: userId, workspaceId }
            : unavailableState(userId, workspaceId)
        }
        scheduleRefresh()
        // A sustained outage retries on a timer, so reporting every attempt
        // would emit one warning a minute for as long as the tab is open.
        if (!denied && !firstFailure) return
        reportError(error, {
          surface: 'workspace',
          errorType: 'billing_capabilities_read_failure',
          level: 'warning',
          tags: {
            status:
              error instanceof WorkspaceApiError
                ? (error.status ?? 'unknown')
                : 'unknown',
            outcome: denied ? 'denied' : 'unavailable'
          }
        })
      } finally {
        signal?.removeEventListener('abort', abortRequest)
        if (activeRequest?.requestId === requestId) {
          activeRequest = null
          // Deferred to here so the refetch is not deduped onto the request
          // it replaces. It cannot loop: this one is issued after the revision
          // that marked it, so only a further mutation can mark it in turn.
          if (refetchAfterSettle) void fetchCapabilities()
        }
      }
    })()

    activeRequest = {
      requestId,
      authUid: userId,
      workspaceId,
      controller,
      promise
    }
    return promise
  }

  async function initialize(signal?: AbortSignal): Promise<void> {
    initialized = true
    do {
      await fetchCapabilities(signal)
    } while (
      !signal?.aborted &&
      !!actorId.value &&
      !!workspaceStore.activeWorkspaceId &&
      !isReady.value
    )
  }

  async function refresh(): Promise<void> {
    await initialize()
  }

  watch(
    [
      () => actorId.value,
      () => workspaceStore.activeWorkspaceId,
      () => workspaceStore.activeWorkspace?.role
    ],
    () => {
      readFailures = 0
      resetRead()
      if (initialized) void fetchCapabilities()
    }
  )

  return {
    canTopUp,
    topUpDenial,
    canManageBilling,
    canSubscribeSelfServe,
    canOpenPlans,
    canCancel,
    canReactivate,
    canRevertScheduledChange,
    canChangeSeats,
    canInviteMembers,
    canManageMembers,
    canDeleteWorkspace,
    deleteWorkspaceDenial,
    canEditWorkspace,
    canLeaveWorkspace,
    leaveWorkspaceDenial,
    canManageSubscription,
    canDowngradeToPersonal,
    canManageAutoTopUp,
    autoTopUpSetup,
    canRunWorkflows,
    paymentRecoveryAvailable,
    runWorkflowsDenial,
    hasParkedBillingOperation,
    runDeniedPaymentPastDue,
    isReady,
    hasResolvedCapabilities,
    snapshotAuthoritative,
    initialize,
    refresh
  }
}

export const useBillingCapabilities = createSharedComposable(
  useBillingCapabilitiesInternal
)
