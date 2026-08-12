/**
 * Feeds node property changes from the graph to the published node API.
 *
 * The API lives in `platform/` and cannot import `renderer/`, so the source is
 * pushed down rather than pulled up — the same seam `nodeMoveBridge` uses.
 *
 * Bound to the graph on screen and rebound when it changes, because
 * `LGraph.trigger` dispatches on the node's own graph: a subgraph's nodes emit
 * on the subgraph's event target, not the root's. Binding to the root alone
 * would report nothing while the user is inside a subgraph. Rebinding here
 * keeps that knowledge next to `currentGraph`, which is the only place that
 * tracks it.
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
  provideNodeChangeSource((onChange) => {
    const canvasStore = useCanvasStore()

    const handler = (
      event: CustomEvent<LGraphEventMap['node:property:changed']>
    ) => {
      const { nodeId, property, oldValue, newValue } = event.detail
      // Only fields the API names. A property the host starts tracking later
      // must be added to the published union deliberately, not leak out.
      if (!TRACKED.includes(property)) return
      onChange(String(nodeId), property as TrackedProperty, oldValue, newValue)
    }

    let bound: LGraph | undefined
    const bind = (graph: LGraph | null | undefined) => {
      if (graph === bound) return
      bound?.events.removeEventListener('node:property:changed', handler)
      graph?.events.addEventListener('node:property:changed', handler)
      bound = graph ?? undefined
    }

    bind(canvasStore.currentGraph)
    const stopWatching = watch(() => canvasStore.currentGraph, bind)

    return () => {
      stopWatching()
      bind(undefined)
    }
  })
}
