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
    }

// Clock skew can make a fresh snapshot look already expired, and setTimeout
// overflows past ~24.8 days into firing immediately. Either would spin the
// refetch into a loop, so the scheduled delay is clamped.
const MIN_REFRESH_DELAY_MS = 5_000
const MAX_REFRESH_DELAY_MS = 24 * 60 * 60 * 1000

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

  function expiryOf(state: CapabilityReadState): number | null {
    if (state.status !== 'resolved') return null
    const expiresAt = Date.parse(state.response.expires_at)
    return Number.isFinite(expiresAt) ? expiresAt : null
  }

  // `capabilities` is a computed, and wall-clock time is not a reactive
  // dependency, so expiry has to be pushed rather than read lazily. The timer
  // runs only while the document is visible: staleness is unobservable in a
  // hidden tab, and returning to the tab is itself a visibility transition.
  function scheduleRefresh(): void {
    clearRefreshTimer()
    const expiresAt = expiryOf(readState.value)
    if (expiresAt === null) return
    if (defaultDocument?.visibilityState === 'hidden') return

    const delay = Math.min(
      MAX_REFRESH_DELAY_MS,
      Math.max(MIN_REFRESH_DELAY_MS, expiresAt - Date.now())
    )
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
    const expiresAt = expiryOf(readState.value)
    if (expiresAt === null) return
    if (expiresAt <= Date.now()) void fetchCapabilities()
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

  function resetRead(): void {
    clearRefreshTimer()
    latestRequestId++
    activeRequest?.controller.abort()
    activeRequest = null
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

    resetRead()
    const requestId = ++latestRequestId
    const controller = new AbortController()
    const abortRequest = () => controller.abort()
    if (signal?.aborted) controller.abort()
    else signal?.addEventListener('abort', abortRequest, { once: true })
    readState.value = {
      status: 'pending',
      authUid: userId,
      workspaceId
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
                response
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
          readState.value = { status: 'idle' }
          return
        }

        const denied =
          (error instanceof WorkspaceApiError &&
            (error.status === 401 || error.status === 403)) ||
          (error instanceof Error && error.name === 'AuthStoreError')
        readState.value = {
          status: denied ? 'denied' : 'unavailable',
          authUid: userId,
          workspaceId
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

  return { canTopUp, canSubscribeSelfServe, isReady, initialize, refresh }
}

export const useBillingCapabilities = createSharedComposable(
  useBillingCapabilitiesInternal
)
