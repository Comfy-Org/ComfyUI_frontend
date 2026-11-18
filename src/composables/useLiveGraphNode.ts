import { useEventListener } from '@vueuse/core'
import type { ComputedRef } from 'vue'
import { computed, shallowRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useApp } from '@/scripts/appInstance'

/** The node `resolve` returns, resolved again each time the root graph is configured. */
export function useLiveGraphNode(
  resolve: () => LGraphNode | null | undefined
): ComputedRef<LGraphNode | undefined> {
  const node = shallowRef(resolve() ?? undefined)
  useEventListener(
    () => useApp().rootGraphOrUndefined?.events,
    'configured',
    () => (node.value = resolve() ?? undefined)
  )
  return computed(() => node.value)
}
