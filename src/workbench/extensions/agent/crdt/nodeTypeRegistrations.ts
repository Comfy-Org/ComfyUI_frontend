import { useChainCallback } from '@/composables/functional/useChainCallback'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'

const listeners = new Set<(type: string) => void>()
let chained = false

/**
 * Subscribe to node type registrations. The global callback is chained once
 * for the whole session and never restored, so unsubscribing one listener
 * cannot detach another consumer's callback.
 */
export function onNodeTypeRegistered(
  listener: (type: string) => void
): () => void {
  if (!chained) {
    chained = true
    LiteGraph.onNodeTypeRegistered = useChainCallback(
      LiteGraph.onNodeTypeRegistered,
      (type) => {
        for (const subscriber of listeners) subscriber(type)
      }
    )
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
