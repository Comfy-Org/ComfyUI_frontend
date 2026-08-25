import { watch } from 'vue'
import type { WatchStopHandle } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphEventMap } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetValue } from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'

export type WidgetNode = LGraphNode | null

const nodeSyncs = new Map<LGraphNode, Map<string, WatchStopHandle>>()
const graphsWithRemovalListener = new WeakSet<
  NonNullable<LGraphNode['graph']>
>()

function nodeWidgetId(node: WidgetNode, name: string): WidgetId | null {
  const graphId = node?.graph?.rootGraph?.id
  return graphId ? widgetId(graphId, node.id, name) : null
}

export function nodeWidgetValue(node: WidgetNode, name: string): unknown {
  const id = nodeWidgetId(node, name)
  return id ? useWidgetValueStore().getWidget(id)?.value : undefined
}

export function setNodeWidgetValue(
  node: WidgetNode,
  name: string,
  value: WidgetValue
): boolean {
  const id = nodeWidgetId(node, name)
  if (!id) return false
  const store = useWidgetValueStore()
  const state = store.getWidget(id)
  if (!state) return false
  if (state.value !== value) store.setValue(id, value)
  return true
}

function disposeNodeSyncs(node: LGraphNode): void {
  const active = nodeSyncs.get(node)
  if (!active) return
  for (const stop of active.values()) stop()
  nodeSyncs.delete(node)
}

interface NodeRemovalEventTarget {
  addEventListener(
    type: 'node:before-removed',
    listener: (
      event: CustomEvent<LGraphEventMap['node:before-removed']>
    ) => void
  ): void
}

function ensureRemovalListener(node: LGraphNode): void {
  const graph = node.graph
  const events: NodeRemovalEventTarget | undefined = graph?.events
  if (!graph || !events || graphsWithRemovalListener.has(graph)) return
  graphsWithRemovalListener.add(graph)
  events.addEventListener('node:before-removed', (event) => {
    disposeNodeSyncs(event.detail.node)
  })
}

export function watchNodeWidgetValues(
  node: LGraphNode,
  key: string,
  names: readonly string[],
  onChange: (values: unknown[]) => void
): void {
  if (!node.graph) {
    node.onAdded = useChainCallback(node.onAdded, () => {
      watchNodeWidgetValues(node, key, names, onChange)
    })
    return
  }
  ensureRemovalListener(node)
  let syncs = nodeSyncs.get(node)
  if (!syncs) {
    syncs = new Map()
    nodeSyncs.set(node, syncs)
  }
  syncs.get(key)?.()
  syncs.set(
    key,
    watch(
      () => names.map((name) => nodeWidgetValue(node, name)),
      (values) => onChange(values)
    )
  )
}
