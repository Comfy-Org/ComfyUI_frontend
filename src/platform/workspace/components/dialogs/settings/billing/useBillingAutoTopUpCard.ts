import { useAsyncState } from '@vueuse/core'
import { computed } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'

type AutoTopUpCardState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'loaded'; settings: AutoReloadSettings }

export function useBillingAutoTopUpCard() {
  const read = useAsyncState(() => workspaceApi.getBillingAutoReload(), null, {
    onError: (error) =>
      reportError(error, {
        errorType: 'auto_top_up_read_failed',
        surface: 'billing'
      })
  })

  const state = computed<AutoTopUpCardState>(() => {
    if (read.isLoading.value) return { kind: 'loading' }
    const settings = read.state.value
    if (settings === null) return { kind: 'unavailable' }
    return { kind: 'loaded', settings }
  })

  async function retry() {
    await read.execute()
  }

  return { state, retry }
}
