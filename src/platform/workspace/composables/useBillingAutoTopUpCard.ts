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
  let refreshSerial = 0
  let inFlightScope: string | null = null
  let committed: ScopedRead | null = null

  async function readCurrentScope(): Promise<ScopedRead | null> {
    const requestScope = scope.value
    if (requestScope === null) return null
    const serial = ++refreshSerial
    inFlightScope = requestScope
    try {
      const next = {
        scope: requestScope,
        settings: await workspaceApi.getBillingAutoReload()
      }
      if (serial !== refreshSerial) return committed
      committed = next
      return next
    } catch (error) {
      reportError(error, {
        errorType: 'auto_top_up_read_failed',
        surface: 'billing'
      })
      if (serial !== refreshSerial) return committed
      if (committed?.scope === requestScope && committed.settings) {
        return committed
      }
      const failed = { scope: requestScope, settings: null }
      committed = failed
      return failed
    } finally {
      if (inFlightScope === requestScope) inFlightScope = null
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
    if (read.isLoading.value && !settings) return { kind: 'loading' }
    if (settings) return { kind: 'loaded', settings }
    return { kind: 'unavailable' }
  })

  const isReady = computed(() => answer.value !== null && !read.isLoading.value)

  function refresh() {
    if (scope.value === null || inFlightScope === scope.value) return
    void read.execute()
  }

  function ensureRead() {
    requested = true
    if (scope.value === null) return
    if (answer.value !== null) return
    refresh()
  }

  async function retry() {
    await read.execute()
  }

  watch(scope, () => {
    if (requested) ensureRead()
  })

  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === 'visible' && requested) refresh()
  })

  return { state, isReady, ensureRead, retry }
}

export const useBillingAutoTopUpCard = createSharedComposable(
  useBillingAutoTopUpCardInternal
)
