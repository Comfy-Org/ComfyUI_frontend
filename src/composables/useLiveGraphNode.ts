import { useEventListener } from '@vueuse/core'
import type { ComputedRef } from 'vue'
import { computed, shallowRef, watch } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { app } from '@/scripts/app'

/** The node `resolve` returns, resolved again each time the root graph is configured. */
export function useLiveGraphNode(
  resolve: () => LGraphNode | null | undefined
): ComputedRef<LGraphNode | undefined> {
  const node = shallowRef(resolve() ?? undefined)
  watch(resolve, (current) => (node.value = current ?? undefined), {
    flush: 'sync'
  })
  useEventListener(
    () => app.rootGraphOrUndefined?.events,
    'configured',
    () => (node.value = resolve() ?? undefined)
  )
  return computed(() => node.value)
}
