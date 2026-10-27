import { useEventListener } from '@vueuse/core'
import type { ComputedRef } from 'vue'
import { computed, shallowRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { app } from '@/scripts/app'

/** The node `resolve` returns, resolved again each time the root graph is configured. */
export function useLiveGraphNode(
  resolve: () => LGraphNode | null | undefined
): ComputedRef<LGraphNode | null> {
  const node = shallowRef(resolve() ?? null)
  useEventListener(
    () => app.rootGraphOrUndefined?.events,
    'configured',
    () => (node.value = resolve() ?? null)
  )
  return computed(() => node.value)
}
