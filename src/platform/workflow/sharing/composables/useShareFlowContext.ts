import { computed } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import type { ShareFlowMetadata } from '@/platform/telemetry/types'

type ShareFlowContext = Pick<
  ShareFlowMetadata,
  'source' | 'view_mode' | 'is_app_mode'
>

export function useShareFlowContext() {
  const { mode, isAppMode } = useAppMode()
  return computed<ShareFlowContext>(() => ({
    source: isAppMode.value ? 'app_mode' : 'graph_mode',
    view_mode: mode.value,
    is_app_mode: isAppMode.value
  }))
}
