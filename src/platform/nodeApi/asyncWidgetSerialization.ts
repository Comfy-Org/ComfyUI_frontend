import { cloneDeep, isEqual } from 'es-toolkit'
import { toRaw } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { whileEmbeddingWorkflow } from './serializeContext'
import { ComfyApiError } from './errors'
import type { WidgetSerializeEvent, WidgetValue } from './widgetHandle'

export type WidgetSerializationProjection =
  | { changed: false }
  | { changed: true; value: WidgetValue }

export type AsyncWidgetSerializer = (
  event: Pick<WidgetSerializeEvent, 'context' | 'value'>
) => Promise<WidgetSerializationProjection>

type Subscription = { project: AsyncWidgetSerializer; alive: () => boolean }
type Snapshot = { value: WidgetValue; subscriptions: Subscription[] }
const subscriptions = new WeakMap<IBaseWidget, Set<Subscription>>()
let preparedValues: ReadonlyMap<IBaseWidget, WidgetValue> | undefined

export function registerAsyncWidgetSerializer(
  widget: IBaseWidget,
  project: AsyncWidgetSerializer,
  alive: () => boolean
): () => void {
  let entries = subscriptions.get(widget)
  if (!entries) {
    entries = new Set()
    subscriptions.set(widget, entries)
  }
  const subscription = { project, alive }
  entries.add(subscription)
  return () => {
    entries.delete(subscription)
  }
}

function snapshot(widget: IBaseWidget): Snapshot {
  return {
    value: cloneDeep(toRaw(widget.value)),
    subscriptions: [...(subscriptions.get(widget) ?? [])]
  }
}

function assertCurrent(widget: IBaseWidget, captured: Snapshot): void {
  const current = [...(subscriptions.get(widget) ?? [])]
  if (
    !isEqual(captured.value, toRaw(widget.value)) ||
    current.length !== captured.subscriptions.length ||
    current.some((entry, index) => entry !== captured.subscriptions[index]) ||
    current.some((entry) => !entry.alive())
  ) {
    throw new ComfyApiError(
      `Widget '${widget.name}' changed during serialization`
    )
  }
}

async function project(
  widget: IBaseWidget,
  context: WidgetSerializeEvent['context'],
  value: WidgetValue,
  captured: Snapshot
): Promise<WidgetValue> {
  let result = value
  for (const subscription of captured.subscriptions) {
    assertCurrent(widget, captured)
    const response = await subscription.project({
      context,
      value: structuredClone(toRaw(value))
    })
    assertCurrent(widget, captured)
    if (response.changed) result = response.value
  }
  return result
}

export async function serializeWidgetAsync(
  widget: IBaseWidget,
  context: WidgetSerializeEvent['context'],
  value: WidgetValue | Promise<WidgetValue>
): Promise<WidgetValue> {
  if (!subscriptions.get(widget)?.size) return value
  const captured = snapshot(widget)
  const resolved = await value
  assertCurrent(widget, captured)
  return project(widget, context, resolved, captured)
}

export function preparedWidgetValue(
  widget: IBaseWidget,
  fallback: () => WidgetValue
): WidgetValue {
  return preparedValues?.has(widget) ? preparedValues.get(widget) : fallback()
}

function graphNodes(graph: LGraph, scopes = new Set<LGraph>()) {
  const nodes = new Set<LGraph['nodes'][number]>()
  function visit(scope: LGraph) {
    if (scopes.has(scope)) return
    scopes.add(scope)
    for (const node of scope.nodes) {
      nodes.add(node)
      if (node.isSubgraphNode()) visit(node.subgraph)
    }
  }
  visit(graph)
  return [...nodes]
}

export function hasAsyncWidgetSerializers(graph: LGraph): boolean {
  return graphNodes(graph).some((node) =>
    node.widgets?.some((widget) => subscriptions.get(widget)?.size)
  )
}

export function captureWidgetSerializationEpoch(graph: LGraph) {
  const scopes = new Set<LGraph>()
  const nodes = graphNodes(graph, scopes)
  const versions = new Map([...scopes].map((scope) => [scope, scope._version]))
  const hasCapturedSerializers = () =>
    nodes.some((node) =>
      node.widgets?.some((widget) => subscriptions.get(widget)?.size)
    )
  if (!hasCapturedSerializers()) {
    return () => {
      if (hasCapturedSerializers() || hasAsyncWidgetSerializers(graph)) {
        throw new ComfyApiError(
          'Widget serializers changed during serialization'
        )
      }
    }
  }
  const captures = nodes.map((node) => {
    if (node.graph) versions.set(node.graph, node.graph._version)
    return {
      node,
      graph: node.graph,
      mode: node.mode,
      serializeWidgets: node.serialize_widgets,
      widgets: (node.widgets ?? []).map((widget) => ({
        widget,
        captured: snapshot(widget),
        name: widget.name,
        serialize: widget.serialize,
        serializePrompt: widget.options.serialize,
        promptSerializer: widget.serializeValue,
        workflowSerializer: widget.serializeWorkflowValue
      }))
    }
  })
  return () => {
    const currentNodes = graphNodes(graph)
    if (
      nodes.length !== currentNodes.length ||
      nodes.some((node, index) => node !== currentNodes[index]) ||
      [...versions].some(([scope, version]) => scope._version !== version)
    ) {
      throw new ComfyApiError('Graph changed during widget serialization')
    }
    for (const captured of captures) {
      const { node } = captured
      const widgets = node.widgets ?? []
      if (
        node.graph !== captured.graph ||
        node.mode !== captured.mode ||
        node.serialize_widgets !== captured.serializeWidgets ||
        widgets.length !== captured.widgets.length
      ) {
        throw new ComfyApiError('Graph changed during widget serialization')
      }
      for (const [index, entry] of captured.widgets.entries()) {
        const { widget } = entry
        if (
          widgets[index] !== widget ||
          widget.name !== entry.name ||
          widget.serialize !== entry.serialize ||
          widget.options.serialize !== entry.serializePrompt ||
          widget.serializeValue !== entry.promptSerializer ||
          widget.serializeWorkflowValue !== entry.workflowSerializer
        ) {
          throw new ComfyApiError('Widget changed during serialization')
        }
        assertCurrent(widget, entry.captured)
      }
    }
  }
}

export async function serializeWorkflow(
  graph: LGraph,
  options: { sortNodes?: boolean; context?: 'workflow' | 'embedded' } = {}
) {
  const { context = 'workflow', sortNodes = false } = options
  const assertEpoch = captureWidgetSerializationEpoch(graph)
  const nodes = graphNodes(graph)
  const captures = new Map<IBaseWidget, Snapshot>()
  const values = new Map<IBaseWidget, WidgetValue>()
  const inContext = <T>(read: () => T) =>
    context === 'embedded' ? whileEmbeddingWorkflow(read) : read()
  for (const node of nodes) {
    if (!node.serialize_widgets) continue
    for (const widget of node.widgets ?? []) {
      if (widget.serialize === false || !subscriptions.get(widget)?.size)
        continue
      assertEpoch()
      const base = inContext(() =>
        widget.serializeWorkflowValue
          ? widget.serializeWorkflowValue()
          : widget.value
      )
      const captured = snapshot(widget)
      captures.set(widget, captured)
      values.set(widget, await project(widget, context, base, captured))
      assertEpoch()
    }
  }
  const currentNodes = graphNodes(graph)
  if (
    nodes.length !== currentNodes.length ||
    nodes.some((node, index) => node !== currentNodes[index])
  ) {
    throw new ComfyApiError('Graph changed during widget serialization')
  }
  for (const [widget, captured] of captures) assertCurrent(widget, captured)
  assertEpoch()
  const previous = preparedValues
  preparedValues = values
  try {
    const result = inContext(() => graph.serialize({ sortNodes }))
    assertEpoch()
    return result
  } finally {
    preparedValues = previous
  }
}
