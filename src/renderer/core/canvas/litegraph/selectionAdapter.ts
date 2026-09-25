import type {
  SelectableKey,
  SelectionCommand
} from '@/core/selection/selectionState'
import {
  parseSelectableKey,
  toSelectableKey
} from '@/core/selection/selectionState'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { Positionable } from '@/lib/litegraph/src/interfaces'
import {
  LGraphGroup,
  LGraphNode,
  Reroute,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { SubgraphIONodeBase } from '@/lib/litegraph/src/subgraph/SubgraphIONodeBase'
import type { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'
import { useSelectionStore } from '@/renderer/core/canvas/selectionStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

type SelectableItem =
  | LGraphNode
  | LGraphGroup
  | Reroute
  | SubgraphInputNode
  | SubgraphOutputNode

export function selectableKeyOf(item: SelectableItem): SelectableKey
export function selectableKeyOf(item: Positionable): SelectableKey | undefined
export function selectableKeyOf(item: Positionable): SelectableKey | undefined {
  if (item instanceof LGraphNode) return toSelectableKey('node', item.id)
  if (item instanceof LGraphGroup) return toSelectableKey('group', item.id)
  if (item instanceof Reroute) return toSelectableKey('reroute', item.id)
  if (item instanceof SubgraphIONodeBase) return toSelectableKey('io', item.id)
}

export function resolveSelectable(
  graph: LGraph,
  key: SelectableKey
): Positionable | undefined {
  const { kind, id } = parseSelectableKey(key)
  switch (kind) {
    case 'node':
      return graph.getNodeById(toNodeId(id)) ?? undefined
    case 'group':
      return graph._groups.find((group) => String(group.id) === id)
    case 'reroute':
      return graph.getReroute(toRerouteId(Number(id)))
    case 'io':
      if (!(graph instanceof Subgraph)) return undefined
      return [graph.inputNode, graph.outputNode].find(
        (ioNode) => String(ioNode.id) === id
      )
  }
}

export function setCanvasItemSelected(
  canvas: LGraphCanvas,
  item: Positionable,
  selected: boolean
): void {
  const key = selectableKeyOf(item)
  if (!key) return
  item.selected = selected
  canvas.state.selectionChanged = true
  applyCanvasSelection(canvas, {
    type: selected ? 'selection.add' : 'selection.remove',
    key
  })
}

export function applyCanvasSelection(
  canvas: LGraphCanvas,
  command: SelectionCommand
): void {
  applyGraphSelection(canvas.graph, command)
}

export function releaseCanvasSelection(canvas: LGraphCanvas): void {
  for (const item of canvas.selectedItems) item.selected = undefined
  canvas.selected_group = null
}

export function clearGraphSelection(graph: LGraphCanvas['graph']): void {
  applyGraphSelection(graph, { type: 'selection.clear' })
}

export function updateGraphSelection(
  graph: LGraph,
  item: Positionable,
  selected: boolean
): boolean {
  const key = selectableKeyOf(item)
  if (!key || resolveSelectable(graph, key) !== item) return false

  const store = useSelectionStore()
  const scope = graphScopeOf(graph)
  const wasSelected = store.isSelected(scope, key)
  if (wasSelected !== selected) {
    store.apply(scope, {
      type: selected ? 'selection.add' : 'selection.remove',
      key
    })
  }
  return wasSelected
}

function applyGraphSelection(
  graph: LGraphCanvas['graph'],
  command: SelectionCommand
): void {
  if (!graph) return
  useSelectionStore().apply(graphScopeOf(graph), command)
}

export function isCanvasItemSelected(
  canvas: LGraphCanvas,
  item: Positionable
): boolean {
  const { graph } = canvas
  const key = selectableKeyOf(item)
  return (
    !!graph && !!key && useSelectionStore().isSelected(graphScopeOf(graph), key)
  )
}

export function ownsSelectable(
  canvas: LGraphCanvas,
  item: Positionable
): boolean {
  const { graph } = canvas
  const key = selectableKeyOf(item)
  return !!graph && !!key && resolveSelectable(graph, key) === item
}
