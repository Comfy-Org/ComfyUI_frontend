import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { WidgetSlotMetadata } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { useApp } from '@/scripts/appInstance'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import { getControlWidget } from '@/core/graph/widgets/controlWidget'
import type { SafeControlWidget } from '@/core/graph/widgets/controlWidget'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'
import type { WidgetVisibilityComponent } from '@/types/widgetVisibility'
import { executionIdToNodeLocatorId } from '@/utils/graphTraversalUtil'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type {
  NodeExecutionId,
  NodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { IBaseWidget, IWidgetOptions } from '@comfyorg/graph-model/widgets'
import type { LinkedUpstreamInfo } from '@/composables/useUpstreamValue'
import type { InputSpec as InputSpecV2 } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'

export interface WidgetErrorTarget {
  executionId: NodeExecutionId
  widgetName: string
}

export interface WidgetViewSources {
  rootGraph: LGraph | null
  hostNode: LGraphNode | null
  hostSubgraphId: string | null
  liveWidget: IBaseWidget | undefined
  slotInfo: WidgetSlotMetadata | undefined
  nodeExecId: NodeExecutionId | null
}

export interface ResolvedWidgetView {
  widgetId: WidgetId
  name: string
  type: string
  value: WidgetValue
  label?: string
  options: IWidgetOptions
  advanced: boolean
  visibility: WidgetVisibilityComponent | undefined
  borderStyle?: string
  controlWidget?: SafeControlWidget
  linkedUpstream?: LinkedUpstreamInfo
  nodeLocatorId?: NodeLocatorId
  spec?: InputSpecV2
  live?: { node: LGraphNode; widget: IBaseWidget }
  errorTarget?: WidgetErrorTarget
  setValue: (value: WidgetValue) => void
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

function createWidgetUpdateHandler({
  id,
  live,
  errorTarget,
  nodeExecId,
  widgetName,
  widgetOptions
}: {
  id: WidgetId
  live?: { node: LGraphNode; widget: IBaseWidget }
  errorTarget?: WidgetErrorTarget
  nodeExecId: NodeExecutionId | null
  widgetName: string
  widgetOptions: IWidgetOptions
}): (newValue: WidgetValue) => void {
  return (newValue: WidgetValue) => {
    const executionErrorStore = useExecutionErrorStore()
    useWidgetValueStore().setValue(id, newValue)
    if (live) {
      const normalized = normalizeWidgetValue(newValue)
      live.widget.value = normalized
      live.widget.callback?.(normalized, useApp().canvas, live.node)
      live.node.widgets?.forEach((w) => w.triggerDraw?.())
    }

    const options = { min: widgetOptions.min, max: widgetOptions.max }
    if (errorTarget) {
      executionErrorStore.clearWidgetRelatedErrors(
        errorTarget.executionId,
        errorTarget.widgetName,
        errorTarget.widgetName,
        newValue,
        options
      )
    }
    if (nodeExecId) {
      executionErrorStore.clearWidgetRelatedErrors(
        nodeExecId,
        widgetName,
        widgetName,
        newValue,
        options
      )
    }
  }
}

function resolveLiveWidgetContext(
  rootGraph: LGraph | null,
  hostNode: LGraphNode | null,
  liveWidget: IBaseWidget | undefined
) {
  if (!hostNode || !liveWidget) return {}

  const promotedSource = resolvePromotedWidgetSource(
    rootGraph,
    hostNode,
    liveWidget
  )
  const errorTarget: WidgetErrorTarget | undefined =
    promotedSource?.sourceExecutionId
      ? {
          executionId: promotedSource.sourceExecutionId,
          widgetName: promotedSource.sourceWidgetName
        }
      : undefined
  const controlWidget =
    getControlWidget(liveWidget) ??
    (promotedSource?.sourceWidget
      ? getControlWidget(promotedSource.sourceWidget)
      : undefined)

  return {
    live: { node: hostNode, widget: liveWidget },
    errorTarget,
    controlWidget,
    sourceExecutionId: promotedSource?.sourceExecutionId
  }
}

function widgetNodeLocatorId(
  rootGraph: LGraph | null,
  hostSubgraphId: string | null,
  bareWidgetId: NodeId | null,
  sourceExecutionId: NodeExecutionId | undefined
): NodeLocatorId | undefined {
  if (sourceExecutionId && rootGraph) {
    const sourceLocator = executionIdToNodeLocatorId(
      rootGraph,
      sourceExecutionId
    )
    if (sourceLocator) return sourceLocator
  }
  if (!bareWidgetId || bareWidgetId.includes(':')) return undefined
  return createNodeLocatorId(hostSubgraphId, bareWidgetId)
}

export function resolveWidgetView(
  id: WidgetId,
  sources: WidgetViewSources
): ResolvedWidgetView | undefined {
  const widgetValueStore = useWidgetValueStore()
  const state = widgetValueStore.getWidget(id)
  if (!state) return undefined
  const type = sources.liveWidget?.type ?? state.type
  if (!type) return undefined

  const { live, errorTarget, controlWidget, sourceExecutionId } =
    resolveLiveWidgetContext(
      sources.rootGraph,
      sources.hostNode,
      sources.liveWidget
    )
  const visibility = widgetValueStore.getWidgetVisibility(id)
  const { linked, originNodeId, originOutputName } = sources.slotInfo ?? {}
  const baseOptions: IWidgetOptions = { ...state.options }
  const advanced = visibility
    ? visibility.surfaces.vueNode === 'advanced'
    : (baseOptions.advanced ?? false)
  const options =
    linked || state.disabled ? { ...baseOptions, disabled: true } : baseOptions

  return {
    widgetId: id,
    name: state.name,
    type,
    value: normalizeWidgetValue(state.value),
    label: state.label,
    options,
    advanced,
    visibility,
    controlWidget,
    linkedUpstream:
      linked && originNodeId
        ? { nodeId: originNodeId, outputName: originOutputName }
        : undefined,
    nodeLocatorId: widgetNodeLocatorId(
      sources.rootGraph,
      sources.hostSubgraphId,
      stripGraphPrefix(state.nodeId),
      sourceExecutionId
    ),
    spec:
      widgetValueStore.getWidgetRenderState(id)?.spec ??
      (live
        ? useNodeDefStore().getInputSpecForWidget(live.node, live.widget.name)
        : undefined),
    live,
    errorTarget,
    setValue: createWidgetUpdateHandler({
      id,
      live,
      errorTarget,
      nodeExecId: sources.nodeExecId,
      widgetName: state.name,
      widgetOptions: options
    })
  }
}
