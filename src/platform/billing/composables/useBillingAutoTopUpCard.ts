import {
  createSharedComposable,
  useAsyncState,
  useDocumentVisibility
} from '@vueuse/core'
import { computed, onScopeDispose, watch } from 'vue'

import { deriveAutoTopUpCard } from '@comfyorg/account-core/billing'
import type { AutoTopUpCardState } from '@comfyorg/account-core/billing'
import { reportError } from '@comfyorg/telemetry/reportError'
import { billingApi } from '@/platform/billing/api/billingApi'
import {
  busyRereadDelayMs,
  isSubscriptionChangeInProgress,
  MAX_BUSY_REREADS
} from '@/platform/billing/composables/autoTopUpReadBusy'
import type { AutoReloadSettings } from '@comfyorg/billing-core'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

interface ScopedRead {
  scope: string
  settings: AutoReloadSettings | null
}

function useBillingAutoTopUpCardInternal() {
  const authStore = useAuthStore()
  const apiKeyAuthStore = useApiKeyAuthStore()
  const workspaceStore = useWorkspaceIdentity()

  const scope = computed(() => {
    const actorId = authStore.userId ?? apiKeyAuthStore.currentUser?.id
    const workspaceId = workspaceStore.activeWorkspaceId
    return actorId && workspaceId ? `${actorId}:${workspaceId}` : null
  })

  let requested = false
  let refreshSerial = 0
  let inFlightScope: string | null = null
  let committed: ScopedRead | null = null
  let busyScope: string | null = null
  let busyRereads = 0
  let busyTimer: ReturnType<typeof setTimeout> | null = null

  function clearBusyReread() {
    if (busyTimer !== null) clearTimeout(busyTimer)
    busyTimer = null
  }

  function scheduleBusyReread(requestScope: string, error: unknown) {
    if (busyScope !== requestScope) {
      busyScope = requestScope
      busyRereads = 0
    }
    if (busyRereads >= MAX_BUSY_REREADS) return
    busyRereads++
    clearBusyReread()
    busyTimer = setTimeout(() => {
      busyTimer = null
      if (scope.value === requestScope) refresh()
    }, busyRereadDelayMs(error))
  }

  async function readCurrentScope(): Promise<ScopedRead | null> {
    const requestScope = scope.value
    if (requestScope === null) return null
    const serial = ++refreshSerial
    inFlightScope = requestScope
    try {
      const next = {
        scope: requestScope,
        settings: await billingApi.getBillingAutoReload()
      }
      if (serial !== refreshSerial) return committed
      if (busyScope === requestScope) busyScope = null
      committed = next
      return next
    } catch (error) {
      const busy = isSubscriptionChangeInProgress(error)
      if (!busy) {
        reportError(error, {
          errorType: 'auto_top_up_read_failed',
          surface: 'billing'
        })
      }
      if (serial !== refreshSerial) return committed
      if (busy) scheduleBusyReread(requestScope, error)
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

  const state = computed<AutoTopUpCardState>(() =>
    deriveAutoTopUpCard({
      isLoading: read.isLoading.value,
      settings: answer.value?.settings ?? null
    })
  )

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

  onScopeDispose(() => {
    refreshSerial++
    clearBusyReread()
  })

  return { scope, state, isReady, ensureRead, retry }
}

export const useBillingAutoTopUpCard = createSharedComposable(
  useBillingAutoTopUpCardInternal
)
