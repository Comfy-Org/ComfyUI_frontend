import type { BillingCapabilitiesResponse } from '@comfyorg/ingest-types'
import {
  createSharedComposable,
  defaultDocument,
  useEventListener
} from '@vueuse/core'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { onCapabilityRevision } from '@/platform/workspace/api/capabilityRevision'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'

type CapabilityReadState =
  | { status: 'idle' }
  | {
      status: 'pending' | 'unavailable' | 'denied'
      authUid: string
      workspaceId: string
    }
  | {
      status: 'resolved'
      authUid: string
      workspaceId: string
      response: BillingCapabilitiesResponse
      refreshAt: number
    }

// A remaining lifetime below the floor means the client clock disagrees with
// the server's, so it cannot pace the refetch and the fixed interval is used
// instead; clamping it would only slow the loop. The ceiling bounds the
// opposite skew, where a lagging clock reads expires_at as far in the future.
const MIN_REFRESH_DELAY_MS = 5_000
const MAX_REFRESH_DELAY_MS = 60 * 60 * 1000
const FALLBACK_REFRESH_DELAY_MS = 60_000

interface ActiveCapabilityRequest {
  requestId: number
  authUid: string
  workspaceId: string
  controller: AbortController
  promise: Promise<void>
}

function useBillingCapabilitiesInternal() {
  const authStore = useAuthStore()
  const workspaceStore = useTeamWorkspaceStore()
  const readState = shallowRef<CapabilityReadState>({ status: 'idle' })
  let initialized = false
  let latestRequestId = 0
  let activeRequest: ActiveCapabilityRequest | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | null = null

  const capabilities = computed(() => {
    const userId = authStore.currentUser?.uid
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

    return state.response.capabilities
  })
  const readUnavailableForCurrentScope = computed(() => {
    const state = readState.value
    return (
      state.status === 'unavailable' &&
      state.authUid === authStore.currentUser?.uid &&
      state.workspaceId === workspaceStore.activeWorkspaceId
    )
  })
  const canTopUp = computed(() => {
    if (!isCloud) return workspaceStore.activeWorkspace?.role !== 'member'
    // An unreadable capability keeps top-up available only for owners, so a
    // transient outage does not strand the one role that can actually top up.
    // Every other role - including an unresolved one - fails closed.
    return (
      capabilities.value?.can_top_up ??
      (readUnavailableForCurrentScope.value &&
        workspaceStore.activeWorkspace?.role === 'owner')
    )
  })
  const canSubscribeSelfServe = computed(
    () => isCloud && (capabilities.value?.can_subscribe_self_serve ?? false)
  )
  const canCancel = computed(
    () => isCloud && (capabilities.value?.can_cancel ?? false)
  )
  const canReactivate = computed(
    () => isCloud && (capabilities.value?.can_reactivate ?? false)
  )
  const canChangeSeats = computed(
    () => isCloud && (capabilities.value?.can_change_seats ?? false)
  )
  const canInviteMembers = computed(
    () => isCloud && (capabilities.value?.can_invite_members ?? false)
  )
  const canDowngradeToPersonal = computed(
    () => isCloud && (capabilities.value?.can_downgrade_to_personal ?? false)
  )
  const isReady = computed(() => {
    if (!isCloud) return true
    const state = readState.value
    if (state.status === 'idle' || state.status === 'pending') return false
    return (
      state.authUid === authStore.currentUser?.uid &&
      state.workspaceId === workspaceStore.activeWorkspaceId
    )
  })

  function clearRefreshTimer(): void {
    if (refreshTimer === null) return
    clearTimeout(refreshTimer)
    refreshTimer = null
  }

  function scheduledRefreshAt(state: CapabilityReadState): number | null {
    return state.status === 'resolved' ? state.refreshAt : null
  }

  // NaN from an unparseable timestamp fails the comparison and lands on the
  // fixed interval.
  function nextRefreshAt(response: BillingCapabilitiesResponse): number {
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
    const userId = authStore.currentUser?.uid
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
    // resolved snapshot readable so its affordances do not blink out once per
    // snapshot lifetime. A scope change makes it wrong, not stale, so it resets.
    const currentState = readState.value
    const priorSnapshot =
      currentState.status === 'resolved' &&
      currentState.authUid === userId &&
      currentState.workspaceId === workspaceId
        ? currentState
        : null

    if (priorSnapshot) cancelActiveRead()
    else resetRead()

    const requestId = ++latestRequestId
    const controller = new AbortController()
    const abortRequest = () => controller.abort()
    if (signal?.aborted) controller.abort()
    else signal?.addEventListener('abort', abortRequest, { once: true })
    if (!priorSnapshot) {
      readState.value = {
        status: 'pending',
        authUid: userId,
        workspaceId
      }
    }

    const promise = (async () => {
      try {
        const response = await workspaceApi.getBillingCapabilities(
          controller.signal
        )
        if (
          requestId !== latestRequestId ||
          userId !== authStore.currentUser?.uid ||
          workspaceId !== workspaceStore.activeWorkspaceId
        ) {
          return
        }

        readState.value =
          response.resolved_for.workspace_id === workspaceId
            ? {
                status: 'resolved',
                authUid: userId,
                workspaceId,
                response,
                refreshAt: nextRefreshAt(response)
              }
            : { status: 'unavailable', authUid: userId, workspaceId }
        scheduleRefresh()
      } catch (error) {
        if (
          requestId !== latestRequestId ||
          userId !== authStore.currentUser?.uid ||
          workspaceId !== workspaceStore.activeWorkspaceId
        ) {
          return
        }
        if (controller.signal.aborted) {
          if (!priorSnapshot) readState.value = { status: 'idle' }
          return
        }

        const denied =
          (error instanceof WorkspaceApiError &&
            (error.status === 401 || error.status === 403)) ||
          (error instanceof Error && error.name === 'AuthStoreError')
        // A transient failure keeps the last good snapshot - stale, not wrong -
        // and retries. A denial is the server answering about this actor, so it
        // replaces the snapshot even mid-revalidation.
        if (priorSnapshot && !denied) {
          readState.value = {
            ...priorSnapshot,
            refreshAt: Date.now() + FALLBACK_REFRESH_DELAY_MS
          }
          scheduleRefresh()
        } else {
          readState.value = {
            status: denied ? 'denied' : 'unavailable',
            authUid: userId,
            workspaceId
          }
        }
        reportError(error, {
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
        if (activeRequest?.requestId === requestId) activeRequest = null
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
    if (!isCloud) return
    do {
      await fetchCapabilities(signal)
    } while (
      !signal?.aborted &&
      !!authStore.currentUser?.uid &&
      !!workspaceStore.activeWorkspaceId &&
      !isReady.value
    )
  }

  async function refresh(): Promise<void> {
    await initialize()
  }

  watch(
    [
      () => authStore.currentUser?.uid,
      () => workspaceStore.activeWorkspaceId,
      () => workspaceStore.activeWorkspace?.role
    ],
    () => {
      resetRead()
      if (initialized && isCloud) void fetchCapabilities()
    }
  )

  return {
    canTopUp,
    canSubscribeSelfServe,
    canCancel,
    canReactivate,
    canChangeSeats,
    canInviteMembers,
    canDowngradeToPersonal,
    isReady,
    initialize,
    refresh
  }
}

export const useBillingCapabilities = createSharedComposable(
  useBillingCapabilitiesInternal
)
