import { watch } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphEventMap } from '@comfyorg/graph-model/LGraphEventMap'
import {
  isTrackedProperty,
  provideNodeChangeSource
} from '@/platform/nodeApi/nodeChanges'

import { useCanvasStore } from './canvasStore'

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
        if (!isTrackedProperty(property)) return
        onChange({
          graphId: graph.id,
          nodeId: String(nodeId),
          property,
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
    const stopWatching = watch(() => canvasStore.currentGraph, sync, {
      flush: 'sync'
    })

    return () => {
      stopWatching()
      for (const detach of bound.values()) detach()
      bound.clear()
    }
  })
}
