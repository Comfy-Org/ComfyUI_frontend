/**
 * Feeds node property changes from the graph to the published node API.
 *
 * The API lives in `platform/` and cannot import `renderer/`, so the source is
 * pushed down rather than pulled up — the same seam `nodeMoveBridge` uses.
 *
 * `LGraph.trigger` dispatches on the node's own graph: a subgraph's nodes emit
 * on the subgraph's event target, not the root's. So a listener is bound per
 * graph, and which graphs those are is what the subscriber's scope names:
 *
 * - `visible` binds the graph on screen and rebinds on navigation.
 * - `document` binds the root graph and every subgraph definition, re-syncing
 *   whenever the set of definitions can have changed — created, released with
 *   the last node instancing them, or replaced wholesale by a workflow load.
 *
 * Each event carries the id of the graph it came from, because node ids are
 * unique only within a graph and the API resolves the node inside the graph
 * that owns it.
 */
import { watch } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphEventMap } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import { provideNodeChangeSource } from '@/platform/nodeApi/nodeChanges'
import type { TrackedProperty } from '@/platform/nodeApi/nodeChanges'

import { useCanvasStore } from './canvasStore'

const TRACKED: readonly string[] = [
  'title',
  'mode',
  'color',
  'bgcolor',
  'shape',
  'showAdvanced'
]

export function installNodeChangeBridge(): void {
  provideNodeChangeSource((scope, onChange) => {
    const canvasStore = useCanvasStore()
    const bound = new Map<LGraph, () => void>()

    function observed(): readonly LGraph[] {
      const visible = canvasStore.currentGraph
      if (!visible) return []
      if (scope === 'visible') return [visible]
      const { rootGraph } = visible
      return [rootGraph, ...rootGraph.subgraphs.values()]
    }

    function sync() {
      const wanted = observed()
      for (const [graph, detach] of bound) {
        if (wanted.includes(graph)) continue
        detach()
        bound.delete(graph)
      }
      for (const graph of wanted) {
        if (!bound.has(graph)) bound.set(graph, attach(graph))
      }
    }

    function attach(graph: LGraph): () => void {
      const onProperty = (
        event: CustomEvent<LGraphEventMap['node:property:changed']>
      ) => {
        const { nodeId, property, oldValue, newValue } = event.detail
        // Only fields the API names. A property the host starts tracking later
        // must be added to the published union deliberately, not leak out.
        if (!TRACKED.includes(property)) return
        onChange({
          graphId: graph.id,
          nodeId: String(nodeId),
          property: property as TrackedProperty,
          from: oldValue,
          to: newValue
        })
      }
      graph.events.addEventListener('node:property:changed', onProperty)
      if (scope === 'visible') {
        return () =>
          graph.events.removeEventListener('node:property:changed', onProperty)
      }

      const onNodeRemoved = (
        event: CustomEvent<LGraphEventMap['node:removed']>
      ) => {
        // Removing the last instance of a subgraph releases its definition.
        if (event.detail.node.isSubgraphNode()) sync()
      }
      graph.events.addEventListener('subgraph-created', sync)
      graph.events.addEventListener('configured', sync)
      graph.events.addEventListener('node:removed', onNodeRemoved)
      return () => {
        graph.events.removeEventListener('node:property:changed', onProperty)
        graph.events.removeEventListener('subgraph-created', sync)
        graph.events.removeEventListener('configured', sync)
        graph.events.removeEventListener('node:removed', onNodeRemoved)
      }
    }

    sync()
    const stopWatching = watch(() => canvasStore.currentGraph, sync)

    return () => {
      stopWatching()
      for (const detach of bound.values()) detach()
      bound.clear()
    }
  })
}
