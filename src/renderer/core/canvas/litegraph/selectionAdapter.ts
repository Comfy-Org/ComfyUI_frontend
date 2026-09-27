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
import { useSelectionStore } from '@/core/selection/selectionStore'
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
  applyCanvasSelection(canvas, {
    type: selected ? 'selection.add' : 'selection.remove',
    key
  })
}

interface PlannedSelectionChange {
  key: SelectableKey
  node?: LGraphNode
}

function planSelectionChange(
  keys: Set<SelectableKey>,
  changes: PlannedSelectionChange[],
  item: Positionable,
  selected: boolean
): boolean {
  const key = selectableKeyOf(item)
  if (!key || keys.has(key) === selected) return false
  if (selected) keys.add(key)
  else keys.delete(key)
  changes.push({ key, node: item instanceof LGraphNode ? item : undefined })
  return true
}

function groupDescendants(group: LGraphGroup): Positionable[] {
  const seen = new Set<Positionable>([group])
  const descendants: Positionable[] = []
  const stack = [...group._children]
  while (stack.length > 0) {
    const child = stack.pop()!
    if (seen.has(child)) continue
    seen.add(child)
    descendants.push(child)
    if (child instanceof LGraphGroup) stack.push(...child._children)
  }
  return descendants
}

function fireSelectionHooks(
  canvas: LGraphCanvas,
  node: LGraphNode,
  selected: boolean
): void {
  if (selected) {
    node.onSelected?.()
    canvas.onNodeSelected?.(node)
  } else {
    node.onDeselected?.()
    canvas.onNodeDeselected?.(node)
  }
}

function canChangeSelection(
  canvas: LGraphCanvas,
  graph: LGraph,
  item: Positionable,
  selected: boolean
): boolean {
  if (selected) {
    return (
      ownsSelectable(canvas, item) &&
      (!canvas.selectOnly || item instanceof LGraphNode)
    )
  }
  return (
    ownsSelectable(canvas, item) ||
    (item instanceof LGraphNode && graph.nodes.includes(item))
  )
}

function planGroupDescendantChanges(
  canvas: LGraphCanvas,
  graph: LGraph,
  group: LGraphGroup,
  selected: boolean,
  keys: Set<SelectableKey>,
  changes: PlannedSelectionChange[]
): void {
  for (const child of groupDescendants(group)) {
    if (!canChangeSelection(canvas, graph, child, selected)) continue
    planSelectionChange(keys, changes, child, selected)
  }
}

function collectSelectionChanges(
  canvas: LGraphCanvas,
  graph: LGraph,
  items: Iterable<Positionable>,
  selected: boolean,
  selectGroupChildren: boolean,
  keys: Set<SelectableKey>
): PlannedSelectionChange[] {
  const changes: PlannedSelectionChange[] = []
  for (const item of items) {
    if (!canChangeSelection(canvas, graph, item, selected)) continue
    if (!planSelectionChange(keys, changes, item, selected)) continue
    if (!(item instanceof LGraphGroup)) continue

    if (selected) item.recomputeInsideNodes()
    if (!selectGroupChildren) continue
    planGroupDescendantChanges(canvas, graph, item, selected, keys, changes)
  }
  return changes
}

function hasSelectionHooks(
  canvas: LGraphCanvas,
  changes: PlannedSelectionChange[],
  selected: boolean
): boolean {
  return changes.some(({ node }) =>
    selected
      ? Boolean(node?.onSelected || canvas.onNodeSelected)
      : Boolean(node?.onDeselected || canvas.onNodeDeselected)
  )
}

function applySelectionItemWithHooks(
  canvas: LGraphCanvas,
  graph: LGraph,
  scope: ReturnType<typeof graphScopeOf>,
  item: Positionable,
  selected: boolean
): boolean {
  if (canvas.graph !== graph) return false
  if (!canChangeSelection(canvas, graph, item, selected)) return false
  const key = selectableKeyOf(item)
  if (!key) return false

  const store = useSelectionStore()
  if (store.isSelected(scope, key) === selected) return false
  if (selected && item instanceof LGraphGroup) item.recomputeInsideNodes()
  store.apply(scope, {
    type: selected ? 'selection.add' : 'selection.remove',
    key
  })
  if (item instanceof LGraphNode) {
    fireSelectionHooks(canvas, item, selected)
  }
  return true
}

function applySelectionWithHooks(
  canvas: LGraphCanvas,
  graph: LGraph,
  scope: ReturnType<typeof graphScopeOf>,
  items: Positionable[],
  selected: boolean,
  selectGroupChildren: boolean
): boolean {
  let changed = false
  for (const item of items) {
    const itemChanged = applySelectionItemWithHooks(
      canvas,
      graph,
      scope,
      item,
      selected
    )
    changed ||= itemChanged
    if (!itemChanged || !(item instanceof LGraphGroup) || !selectGroupChildren)
      continue
    for (const child of groupDescendants(item)) {
      changed =
        applySelectionItemWithHooks(canvas, graph, scope, child, selected) ||
        changed
    }
  }
  return changed
}

export function changeCanvasSelection(
  canvas: LGraphCanvas,
  items: Iterable<Positionable>,
  selected: boolean,
  selectGroupChildren = canvas.groupSelectChildren
): boolean {
  const { graph } = canvas
  if (!graph) return false

  const scope = graphScopeOf(graph)
  const store = useSelectionStore()
  const keys = new Set(store.selectedKeys(scope))
  const itemList = [...items]
  const changes = collectSelectionChanges(
    canvas,
    graph,
    itemList,
    selected,
    selectGroupChildren,
    keys
  )
  if (changes.length === 0) return false

  if (!hasSelectionHooks(canvas, changes, selected)) {
    store.apply(scope, { type: 'selection.replace', keys: [...keys] })
    return true
  }

  return applySelectionWithHooks(
    canvas,
    graph,
    scope,
    itemList,
    selected,
    selectGroupChildren
  )
}

export function applyCanvasSelection(
  canvas: LGraphCanvas,
  command: SelectionCommand
): void {
  applyGraphSelection(canvas.graph, command)
}

export function releaseCanvasSelection(canvas: LGraphCanvas): void {
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
