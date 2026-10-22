import {
  createSharedComposable,
  useAsyncState,
  useDocumentVisibility
} from '@vueuse/core'
import { computed, watch } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

type AutoTopUpCardState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'loaded'; settings: AutoReloadSettings }

interface ScopedRead {
  scope: string
  settings: AutoReloadSettings | null
}

function useBillingAutoTopUpCardInternal() {
  const authStore = useAuthStore()
  const apiKeyAuthStore = useApiKeyAuthStore()
  const workspaceStore = useTeamWorkspaceStore()

  const scope = computed(() => {
    const actorId = authStore.userId ?? apiKeyAuthStore.currentUser?.id
    const workspaceId = workspaceStore.activeWorkspaceId
    return actorId && workspaceId ? `${actorId}:${workspaceId}` : null
  })

  let requested = false
  let inFlightScope: string | null = null

  async function readCurrentScope(): Promise<ScopedRead | null> {
    const requestScope = scope.value
    if (requestScope === null) return null
    inFlightScope = requestScope
    try {
      return {
        scope: requestScope,
        settings: await workspaceApi.getBillingAutoReload()
      }
    } catch (error) {
      reportError(error, {
        errorType: 'auto_top_up_read_failed',
        surface: 'billing'
      })
      return { scope: requestScope, settings: null }
    } finally {
      inFlightScope = null
    }
  }

  const read = useAsyncState(readCurrentScope, null, {
    immediate: false,
    resetOnExecute: false
  })

  const answer = computed(() => {
    const current = read.state.value
    return current?.scope === scope.value ? current : null
  })

  const state = computed<AutoTopUpCardState>(() => {
    const settings = answer.value?.settings
    if (settings) return { kind: 'loaded', settings }
    if (answer.value === null && read.isLoading.value)
      return { kind: 'loading' }
    return { kind: 'unavailable' }
  })

  const isReady = computed(() => answer.value !== null && !read.isLoading.value)

  function ensureRead() {
    requested = true
    if (scope.value === null) return
    if (answer.value !== null || inFlightScope === scope.value) return
    void read.execute()
  }

  async function retry() {
    await read.execute()
  }

  watch(scope, () => {
    if (requested) ensureRead()
  })

  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === 'visible' && requested) void read.execute()
  })

  return { state, isReady, ensureRead, retry }
}

export const useBillingAutoTopUpCard = createSharedComposable(
  useBillingAutoTopUpCardInternal
)
