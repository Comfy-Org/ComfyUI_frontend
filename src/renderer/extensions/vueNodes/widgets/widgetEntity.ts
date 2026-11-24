import { computed, hasInjectionContext, inject, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import { getControlWidget } from '@/core/graph/widgets/controlWidget'
import type { SafeControlWidget } from '@/core/graph/widgets/controlWidget'
import type { LinkedUpstreamInfo } from '@/composables/useUpstreamValue'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useApp } from '@/scripts/appInstance'
import { AdvancedWidgetRingKey } from '@/types/widgetTypes'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import {
  executionIdFromState,
  executionIdToNodeLocatorId
} from '@/utils/graphTraversalUtil'
import { mapLiveWidgetsById, resolveNode } from '@/utils/litegraphUtil'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import type {
  NodeExecutionId,
  NodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import { parseWidgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'
import type { IBaseWidget, IWidgetOptions } from '@comfyorg/graph-model/widgets'
import type { InputSpec as InputSpecV2 } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'

export interface WidgetErrorTarget {
  executionId: NodeExecutionId
  widgetName: string
}

interface WidgetHost {
  rootGraph: LGraph
  node: LGraphNode
  subgraphId: string | null
}

const NO_OPTIONS: IWidgetOptions = Object.freeze({})

function widgetHost(id: WidgetId): WidgetHost | undefined {
  const app = useApp()
  if (!app.isGraphReady) return undefined
  const rootGraph = app.rootGraph
  const { graphId, nodeId } = parseWidgetId(id)
  if (graphId !== rootGraph.id) return undefined
  const node = resolveNode(nodeId, rootGraph)
  if (!node) return undefined
  const graph = node.graph
  return {
    rootGraph,
    node,
    subgraphId: graph && graph !== rootGraph ? graph.id : null
  }
}

function findLiveWidget(node: LGraphNode, id: WidgetId) {
  const { name } = parseWidgetId(id)
  return node.widgets?.find(
    (candidate) => candidate.name === name && candidate.widgetId === id
  )
}

/** The live litegraph node and widget behind a widget id, when loaded. */
export function widgetLive(
  id: WidgetId
): { node: LGraphNode; widget: IBaseWidget } | undefined {
  const host = widgetHost(id)
  if (!host) return undefined
  const widget =
    findLiveWidget(host.node, id) ?? mapLiveWidgetsById(host.node).get(id)
  return widget ? { node: host.node, widget } : undefined
}

/** The widget's display name, falling back to the name in its id. */
export function widgetName(id: WidgetId): string {
  return useWidgetValueStore().getWidget(id)?.name ?? parseWidgetId(id).name
}

/** The widget's label, if one was set. */
export function widgetLabel(id: WidgetId): string | undefined {
  return useWidgetValueStore().getWidget(id)?.label
}

/** The widget's type, preferring the live widget's when they differ. */
export function widgetType(id: WidgetId): string | undefined {
  return (
    widgetLive(id)?.widget.type ?? useWidgetValueStore().getWidget(id)?.type
  )
}

/** The ring class for an advanced widget in a grid that rings them. */
export function useWidgetBorderStyle(
  id: MaybeRefOrGetter<WidgetId>
): ComputedRef<string | undefined> {
  const ringsAdvanced =
    hasInjectionContext() && inject(AdvancedWidgetRingKey, false)
  return computed(() =>
    ringsAdvanced && widgetIsAdvanced(toValue(id))
      ? 'ring ring-primary'
      : undefined
  )
}

/** The widget's value. */
export function widgetValue(id: WidgetId): WidgetValue {
  return useWidgetValueStore().getWidget(id)?.value
}

function widgetInputLink(id: WidgetId) {
  const host = widgetHost(id)
  const graph = host?.node.graph
  if (!host || !graph) return undefined
  const name = widgetName(id)
  const index = host.node.inputs.findIndex(
    (input) =>
      (input.widget?.name ||
        (input.widgetId !== undefined ? input.name : undefined)) === name
  )
  if (index < 0) return undefined
  const link = useLinkStore().getInputSlotLink(
    graphScopeOf(graph),
    host.node.id,
    index
  )
  return link && { link, graph }
}

/** The upstream node and output feeding the widget's input, if linked. */
export function widgetLinkedUpstream(
  id: WidgetId
): LinkedUpstreamInfo | undefined {
  const linked = widgetInputLink(id)
  if (!linked) return undefined
  const { link, graph } = linked
  return {
    nodeId: link.originNodeId,
    outputName: graph.getNodeById(link.originNodeId)?.outputs[link.originSlot]
      ?.name
  }
}

function readSiblingWidgetValuesForUnreactiveOptionWrites(id: WidgetId) {
  const { graphId, nodeId } = parseWidgetId(id)
  useWidgetValueStore()
    .getNodeWidgets(graphId, nodeId)
    .forEach((sibling) => sibling.value)
}

/** The widget's options, disabled while its input is linked. */
export function widgetOptions(id: WidgetId): IWidgetOptions {
  const state = useWidgetValueStore().getWidget(id)
  if (!state) return NO_OPTIONS
  readSiblingWidgetValuesForUnreactiveOptionWrites(id)
  const options = { ...state.options }
  if (state.disabled || widgetInputLink(id)) options.disabled = true
  return options
}

function widgetIsAdvanced(id: WidgetId): boolean {
  const store = useWidgetValueStore()
  const visibility = store.getWidgetVisibility(id)
  return visibility
    ? visibility.surfaces.vueNode === 'advanced'
    : (store.getWidget(id)?.options.advanced ?? false)
}

function promotedSource(id: WidgetId) {
  const host = widgetHost(id)
  const live = widgetLive(id)
  return host && live
    ? resolvePromotedWidgetSource(host.rootGraph, live.node, live.widget)
    : undefined
}

/** The interior widget a promoted widget's errors are reported against. */
export function widgetErrorTarget(id: WidgetId): WidgetErrorTarget | undefined {
  const source = promotedSource(id)
  return source?.sourceExecutionId
    ? {
        executionId: source.sourceExecutionId,
        widgetName: source.sourceWidgetName
      }
    : undefined
}

/** The control-after-generate widget attached to the widget, if any. */
export function widgetControl(id: WidgetId): SafeControlWidget | undefined {
  const live = widgetLive(id)
  if (!live) return undefined
  const sourceWidget = promotedSource(id)?.sourceWidget
  return (
    getControlWidget(live.widget) ??
    (sourceWidget ? getControlWidget(sourceWidget) : undefined)
  )
}

/** The node the widget edits, through any subgraph promotion. */
export function widgetNodeLocatorId(id: WidgetId): NodeLocatorId | undefined {
  const host = widgetHost(id)
  const sourceExecutionId = promotedSource(id)?.sourceExecutionId
  if (host && sourceExecutionId) {
    const sourceLocator = executionIdToNodeLocatorId(
      host.rootGraph,
      sourceExecutionId
    )
    if (sourceLocator) return sourceLocator
  }
  const { nodeId } = parseWidgetId(id)
  if (String(nodeId).includes(':')) return undefined
  return createNodeLocatorId(host?.subgraphId ?? null, nodeId)
}

/** The input spec the widget was created from. */
export function widgetSpec(id: WidgetId): InputSpecV2 | undefined {
  const spec = useWidgetValueStore().getWidgetRenderState(id)?.spec
  if (spec) return spec
  const live = widgetLive(id)
  return live
    ? useNodeDefStore().getInputSpecForWidget(live.node, live.widget.name)
    : undefined
}

function widgetNodeExecutionId(id: WidgetId): NodeExecutionId | null {
  const host = widgetHost(id)
  if (!host) return createNodeExecutionId([parseWidgetId(id).nodeId])
  return executionIdFromState(host.rootGraph, {
    id: host.node.id,
    graphId: host.subgraphId ?? host.rootGraph.id
  })
}

function normalizeWidgetValue(value: unknown): WidgetValue {
  if (value === undefined || value === null) return value
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'object'
  )
    return value
  console.warn(`Invalid widget value type: ${typeof value}`, value)
  return undefined
}

/** Writes a value from the UI: store, live widget callback, and stale errors. */
export function setWidgetValue(id: WidgetId, value: WidgetValue): void {
  const store = useWidgetValueStore()
  if (!store.getWidget(id)) return
  store.setValue(id, value)
  const live = widgetLive(id)
  if (live) {
    const normalized = normalizeWidgetValue(value)
    live.widget.value = normalized
    live.widget.callback?.(normalized, useApp().canvas, live.node)
    live.node.widgets?.forEach((w) => w.triggerDraw?.())
  }

  const { min, max } = widgetOptions(id)
  const executionErrorStore = useExecutionErrorStore()
  const errorTarget = widgetErrorTarget(id)
  if (errorTarget)
    executionErrorStore.clearWidgetRelatedErrors(
      errorTarget.executionId,
      errorTarget.widgetName,
      errorTarget.widgetName,
      value,
      { min, max }
    )
  const nodeExecId = widgetNodeExecutionId(id)
  const name = widgetName(id)
  if (nodeExecId)
    executionErrorStore.clearWidgetRelatedErrors(
      nodeExecId,
      name,
      name,
      value,
      {
        min,
        max
      }
    )
}
