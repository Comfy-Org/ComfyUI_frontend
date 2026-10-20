import { cloneDeep, groupBy, isEqual, omit } from 'es-toolkit'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import {
  collectSubgraphDefinitions,
  parseFlattenableSubgraphDefinitions
} from '@/platform/workflow/core/utils/workflowFlattening'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { ownsNodeHistory } from '@/stores/widgetHistoryStore'
import { parseWidgetId, widgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'

interface SerializedWidgetValues {
  id?: unknown
  widgets_values?: unknown
  widgets_values_named?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nodeHistoryOwnedWidgets(widgets: readonly IBaseWidget[]) {
  const owned = widgets.filter(ownsNodeHistory)
  const mirrored = LiteGraph.vueNodesMode
    ? owned.flatMap((widget) => widget.linkedWidgets ?? [])
    : []
  return new Set([...owned, ...mirrored])
}

export function collectNodeHistoryWidgets(
  rootGraph: LGraph
): Map<WidgetId, number> {
  return new Map(
    [rootGraph, ...rootGraph.subgraphs.values()].flatMap((graph) =>
      graph.nodes.flatMap((node) => {
        const widgets = node.widgets ?? []
        const owned = nodeHistoryOwnedWidgets(widgets)
        return widgets
          .filter((widget) => widget.serialize !== false)
          .flatMap((widget, slot): [WidgetId, number][] =>
            owned.has(widget)
              ? [[widgetId(graph.id, node.id, widget.name), slot]]
              : []
          )
      })
    )
  )
}

function nodeKey(graphId: string, nodeId: unknown): string {
  return `${graphId}:${String(nodeId)}`
}

function serializedNodes(
  state: ComfyWorkflowJSON,
  rootGraphId: string
): Map<string, SerializedWidgetValues> {
  const subgraphs = collectSubgraphDefinitions(
    parseFlattenableSubgraphDefinitions(state.definitions?.subgraphs ?? [])
  )
  const graphs: [string, readonly SerializedWidgetValues[]][] = [
    [rootGraphId, state.nodes],
    ...subgraphs.map(
      (subgraph): [string, readonly SerializedWidgetValues[]] => [
        subgraph.id,
        subgraph.nodes
      ]
    )
  ]
  return new Map(
    graphs.flatMap(([graphId, nodes]) =>
      nodes.map((node): [string, SerializedWidgetValues] => [
        nodeKey(graphId, node.id),
        node
      ])
    )
  )
}

function namedValues(
  node: SerializedWidgetValues
): Record<string, unknown> | undefined {
  return isRecord(node.widgets_values_named)
    ? node.widgets_values_named
    : undefined
}

function serializedWidgetValue(
  nodes: Map<string, SerializedWidgetValues>,
  widget: WidgetId
): unknown {
  const { graphId, nodeId, name } = parseWidgetId(widget)
  const node = nodes.get(nodeKey(graphId, nodeId))
  return node && namedValues(node)?.[name]
}

function slotCount(node: SerializedWidgetValues): number | undefined {
  return Array.isArray(node.widgets_values)
    ? node.widgets_values.length
    : undefined
}

function writeWidgetValue(
  node: SerializedWidgetValues,
  {
    name,
    slot,
    liveSlotCount
  }: { name: string; slot: number; liveSlotCount?: number },
  value: unknown
): void {
  const named = namedValues(node)
  const positional = node.widgets_values
  if (!named || !(name in named) || !Array.isArray(positional)) return
  if (positional.length !== liveSlotCount) return
  named[name] = cloneDeep(value)
  positional[slot] = cloneDeep(value)
}

export function nodeHistoryValuesChanged(
  previous: ComfyWorkflowJSON,
  current: ComfyWorkflowJSON,
  widgets: ReadonlyMap<WidgetId, number>,
  rootGraphId: string
): boolean {
  const previousNodes = serializedNodes(previous, rootGraphId)
  const currentNodes = serializedNodes(current, rootGraphId)
  return [...widgets.keys()].some(
    (widget) =>
      !isEqual(
        serializedWidgetValue(previousNodes, widget),
        serializedWidgetValue(currentNodes, widget)
      )
  )
}

export function withNodeHistoryValuesFrom(
  target: ComfyWorkflowJSON,
  source: ComfyWorkflowJSON,
  widgets: ReadonlyMap<WidgetId, number>,
  rootGraphId: string
): ComfyWorkflowJSON {
  if (!widgets.size) return target
  const result = cloneDeep(target)
  const targetNodes = serializedNodes(result, rootGraphId)
  const sourceNodes = serializedNodes(source, rootGraphId)
  const ownedByNode = groupBy(
    [...widgets].map(([widget, slot]) => ({ ...parseWidgetId(widget), slot })),
    ({ graphId, nodeId }) => nodeKey(graphId, nodeId)
  )

  for (const [key, nodeWidgets] of Object.entries(ownedByNode)) {
    const targetNode = targetNodes.get(key)
    const sourceNode = sourceNodes.get(key)
    const sourceValues = sourceNode && namedValues(sourceNode)
    if (!targetNode || !sourceNode || !sourceValues) continue

    const owned = nodeWidgets.map(({ name }) => name)
    if (
      !isEqual(
        omit(namedValues(targetNode) ?? {}, owned),
        omit(sourceValues, owned)
      )
    ) {
      continue
    }
    const liveSlotCount = slotCount(sourceNode)
    for (const { name, slot } of nodeWidgets) {
      if (name in sourceValues)
        writeWidgetValue(
          targetNode,
          { name, slot, liveSlotCount },
          sourceValues[name]
        )
    }
  }
  return result
}
