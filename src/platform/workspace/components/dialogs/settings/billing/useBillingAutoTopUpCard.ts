import { useAsyncState, useDocumentVisibility } from '@vueuse/core'
import { computed, watch } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'

type AutoTopUpCardState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'loaded'; settings: AutoReloadSettings }

export function useBillingAutoTopUpCard() {
  const read = useAsyncState(() => workspaceApi.getBillingAutoReload(), null, {
    resetOnExecute: false,
    onError: (error) =>
      reportError(error, {
        errorType: 'auto_top_up_read_failed',
        surface: 'billing'
      })
  })

  const state = computed<AutoTopUpCardState>(() => {
    if (read.error.value !== undefined) return { kind: 'unavailable' }
    const settings = read.state.value
    if (settings !== null) return { kind: 'loaded', settings }
    return read.isLoading.value ? { kind: 'loading' } : { kind: 'unavailable' }
  })

  async function retry() {
    await read.execute()
  }

  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === 'visible') void read.execute()
  })

  return { state, retry }
}
