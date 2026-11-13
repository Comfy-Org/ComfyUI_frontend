import { watch } from 'vue'

import type { NodeLifecycleEvent } from '@comfyorg/graph-model/LGraphEventMap'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { NodeQueryScope } from '@/platform/nodeApi/v4/types'

/**
 * Attaches to each graph in `scope` as it enters the scope, and detaches as it
 * leaves, following the user between graphs. Returns what stops following.
 */
export function followGraphs(
  scope: NodeQueryScope,
  visibleGraph: () => LGraph | null,
  attach: (graph: LGraph) => () => void
): () => void {
  const attached = new Map<LGraph, () => void>()

  function sync(): void {
    const wanted = new Set(graphsIn(scope, visibleGraph()))
    for (const [graph, detach] of attached) {
      if (wanted.has(graph)) continue
      detach()
      attached.delete(graph)
    }
    for (const graph of wanted) {
      if (!attached.has(graph)) attached.set(graph, attach(graph))
    }
  }

  const stopFollowingScreen = watch(visibleGraph, sync, {
    immediate: true,
    flush: 'sync'
  })
  const stopFollowingSubgraphs =
    scope === 'visible'
      ? undefined
      : watch(
          () => visibleGraph()?.rootGraph,
          (root, _previous, onCleanup) => {
            if (root) onCleanup(onSubgraphSetChange(root, sync))
          },
          { immediate: true, flush: 'sync' }
        )

  return () => {
    stopFollowingScreen()
    stopFollowingSubgraphs?.()
    for (const detach of attached.values()) detach()
    attached.clear()
  }
}

function onSubgraphSetChange(root: LGraph, changed: () => void): () => void {
  const onNodeRemoved = (event: NodeLifecycleEvent) => {
    if (event.detail.node.isSubgraphNode()) changed()
  }
  root.events.addEventListener('subgraph-created', changed)
  root.events.addEventListener('configured', changed)
  root.events.addEventListener('node:removed', onNodeRemoved)
  return () => {
    root.events.removeEventListener('subgraph-created', changed)
    root.events.removeEventListener('configured', changed)
    root.events.removeEventListener('node:removed', onNodeRemoved)
  }
}

function graphsIn(
  scope: NodeQueryScope,
  visible: LGraph | null
): readonly LGraph[] {
  if (!visible) return []
  if (scope === 'visible') return [visible]
  const { rootGraph } = visible
  return [rootGraph, ...rootGraph.subgraphs.values()]
}
