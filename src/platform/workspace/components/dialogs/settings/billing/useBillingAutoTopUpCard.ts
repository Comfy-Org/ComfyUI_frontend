import {
  createSharedComposable,
  useAsyncState,
  useDocumentVisibility
} from '@vueuse/core'
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

function reportCardViewed(status: () => AutoTopUpCardStatus | undefined) {
  let reportedStatus: AutoTopUpCardStatus | undefined

  watch(
    status,
    (current) => {
      if (!current || current === reportedStatus) return
      reportedStatus = current
      useTelemetry()?.trackBillingEvent({
        operation: 'auto_top_up_card',
        stage: 'viewed',
        outcome: 'pending',
        status: current
      })
    },
    { immediate: true }
  )
}

function useBillingAutoTopUpCardInternal(
  visible: MaybeRefOrGetter<boolean> = true,
  enabled: MaybeRefOrGetter<boolean> = true
) {
  const read = useAsyncState(() => workspaceApi.getBillingAutoReload(), null, {
    immediate: false,
    resetOnExecute: false,
    onError: (error) =>
      reportError(error, {
        errorType: 'auto_top_up_read_failed',
        surface: 'billing'
      })
  })

  watch(
    () => toValue(enabled),
    (isEnabled) => {
      if (isEnabled) void read.execute()
    },
    { immediate: true }
  )

  const state = computed<AutoTopUpCardState>(() => {
    if (read.error.value !== undefined) return { kind: 'unavailable' }
    const settings = read.state.value
    if (settings !== null) return { kind: 'loaded', settings }
    return read.isLoading.value ? { kind: 'loading' } : { kind: 'unavailable' }
  })

  reportCardViewed(() => {
    const current = state.value
    return toValue(visible) && read.isReady.value && current.kind === 'loaded'
      ? current.settings.status
      : undefined
  })

  async function retry() {
    await read.execute()
  }

  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === 'visible' && toValue(enabled)) void read.execute()
  })

  return { state, retry }
}

export const useBillingAutoTopUpCard = createSharedComposable(
  useBillingAutoTopUpCardInternal
)
