import type { BillingCapabilitiesResponse } from '@comfyorg/ingest-types'
import { createSharedComposable } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'

type CapabilityReadState =
  | { status: 'idle' | 'pending' }
  | {
      status: 'resolved'
      authUid: string
      response: BillingCapabilitiesResponse
    }
  | {
      status: 'unavailable'
      authUid: string
      workspaceId: string
    }

function useBillingCapabilitiesInternal() {
  const authStore = useAuthStore()
  const workspaceStore = useTeamWorkspaceStore()
  const readState = shallowRef<CapabilityReadState>({ status: 'idle' })
  let initialized = false
  let latestRequestId = 0

  const capabilities = computed(() => {
    const userId = authStore.currentUser?.uid
    const workspaceId = workspaceStore.activeWorkspaceId
    const state = readState.value
    if (
      !userId ||
      !workspaceId ||
      state.status !== 'resolved' ||
      state.authUid !== userId ||
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
    if (!isCloud) return true
    return (
      capabilities.value?.can_top_up ?? readUnavailableForCurrentScope.value
    )
  })
  const canSubscribeSelfServe = computed(
    () => isCloud && (capabilities.value?.can_subscribe_self_serve ?? false)
  )

  async function fetchCapabilities(signal?: AbortSignal): Promise<void> {
    const requestId = ++latestRequestId
    const userId = authStore.currentUser?.uid
    const workspaceId = workspaceStore.activeWorkspaceId
    readState.value = { status: 'pending' }
    if (!userId || !workspaceId) {
      return
    }

    try {
      const response = await workspaceApi.getBillingCapabilities(signal)
      if (
        requestId !== latestRequestId ||
        userId !== authStore.currentUser?.uid ||
        workspaceId !== workspaceStore.activeWorkspaceId
      ) {
        return
      }

      readState.value =
        response.resolved_for.workspace_id === workspaceId
          ? { status: 'resolved', authUid: userId, response }
          : { status: 'unavailable', authUid: userId, workspaceId }
    } catch {
      if (
        requestId === latestRequestId &&
        userId === authStore.currentUser?.uid &&
        workspaceId === workspaceStore.activeWorkspaceId
      ) {
        readState.value = {
          status: 'unavailable',
          authUid: userId,
          workspaceId
        }
      }
    }
  }

  async function initialize(signal?: AbortSignal): Promise<void> {
    initialized = true
    if (!isCloud) return
    await fetchCapabilities(signal)
  }

  watch(
    [() => authStore.currentUser?.uid, () => workspaceStore.activeWorkspaceId],
    () => {
      latestRequestId++
      readState.value = { status: 'idle' }
      if (initialized && isCloud) void fetchCapabilities()
    }
  )

  return { canTopUp, canSubscribeSelfServe, initialize }
}

export const useBillingCapabilities = createSharedComposable(
  useBillingCapabilitiesInternal
)
