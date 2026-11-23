import { useEventListener } from '@vueuse/core'
import type { ComputedRef } from 'vue'
import { computed, shallowRef, watchSyncEffect } from 'vue'

import type { LGraphNode } from '@comfyorg/litegraph/LGraphNode'
import { useApp } from '@/scripts/appInstance'

/** The node `resolve` returns, resolved again each time the root graph is configured. */
export function useLiveGraphNode(
  resolve: () => LGraphNode | null | undefined
): ComputedRef<LGraphNode | undefined> {
  const node = shallowRef<LGraphNode>()
  const refresh = () => (node.value = resolve() ?? undefined)
  watchSyncEffect(refresh)
  useEventListener(
    () => useApp().rootGraphOrUndefined?.events,
    'configured',
    refresh
  )
  return computed(() => node.value)
}
