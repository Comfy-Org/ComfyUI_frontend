import { useAsyncState, useDocumentVisibility } from '@vueuse/core'
import type { AutoTopUpCardStatus } from '@comfyorg/account-core/billing'
import { computed, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'

type AutoTopUpCardState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'loaded'; settings: AutoReloadSettings }

export function useBillingAutoTopUpCard(
  visible: MaybeRefOrGetter<boolean> = true
) {
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

  let reportedStatus: AutoTopUpCardStatus | undefined

  watch(
    () => {
      const current = state.value
      return toValue(visible) && read.isReady.value && current.kind === 'loaded'
        ? current.settings.status
        : undefined
    },
    (status) => {
      if (!status || status === reportedStatus) return
      reportedStatus = status
      useTelemetry()?.trackBillingEvent({
        operation: 'auto_top_up_card',
        stage: 'viewed',
        outcome: 'pending',
        status
      })
    },
    { immediate: true }
  )

  async function retry() {
    await read.execute()
  }

  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === 'visible') void read.execute()
  })

  return { state, retry }
}
