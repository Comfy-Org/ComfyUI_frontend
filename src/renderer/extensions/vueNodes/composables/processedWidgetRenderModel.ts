import type { TooltipOptions } from 'primevue'

import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import type {
  WidgetGridItem,
  WidgetSlotMetadata
} from '@/renderer/extensions/vueNodes/types/widgetGrid'
import WidgetDOM from '@/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
  shouldRenderAsVue
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { app } from '@/scripts/app'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@/types/nodeIdentification'
import type { NodeExecutionId, NodeLocatorId } from '@/types/nodeIdentification'
import type { NodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { getControlWidget } from '@/types/simplifiedWidget'
import type {
  LinkedUpstreamInfo,
  SafeControlWidget,
  SimplifiedWidget,
  WidgetValue
} from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'
import {
  executionIdFromState,
  executionIdToNodeLocatorId,
  getNodeByLocatorId,
  locatorIdFromState,
  subgraphIdFromState
} from '@/utils/graphTraversalUtil'
import { mapLiveWidgetsById } from '@/utils/litegraphUtil'

type TooltipValueType = 'asset' | 'combo' | 'number' | 'text'
function isTooltipValueType(val: unknown): val is TooltipValueType {
  return (
    val === 'asset' || val === 'combo' || val === 'number' || val === 'text'
  )
}

interface WidgetTooltipSource {
  name: string
  tooltip?: string
}

interface WidgetErrorTarget {
  executionId: NodeExecutionId
  widgetName: string
}

export interface ProcessedWidget extends WidgetGridItem {
  handleContextMenu: (e: PointerEvent) => void
  hasLayoutSize: boolean
  hasError: boolean
  widgetId: WidgetId
  tooltipConfig: TooltipOptions
  updateHandler: (value: WidgetValue) => void
}

export interface WidgetUiCallbacks {
  getTooltipConfig: (
    widget: WidgetTooltipSource,
    fullVal?: string
  ) => TooltipOptions
  handleNodeRightClick: (e: PointerEvent, nodeId: NodeId) => void
}

export interface ComputeProcessedWidgetsOptions {
  nodeData: NodeState | undefined
  widgetIds?: readonly WidgetId[]
  graphId: string | undefined
  showAdvanced: boolean
  isGraphReady: boolean
  rootGraph: LGraph | null
  ui: WidgetUiCallbacks
}

function normalizeWidgetValue(value: unknown): WidgetValue {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'object') return value
  console.warn(`Invalid widget value type: ${typeof value}`, value)
  return undefined
}

function buildSlotMetadata(
  inputs: INodeInputSlot[] | undefined,
  graphRef: LGraph | null | undefined,
  nodeId: NodeId
): Map<string, WidgetSlotMetadata> {
  const linkStore = useLinkStore()
  const scope = graphRef ? graphScopeOf(graphRef) : undefined
  const metadata = new Map<string, WidgetSlotMetadata>()
  inputs?.forEach((input, index) => {
    const link = scope
      ? linkStore.getInputSlotLink(scope, nodeId, index)
      : undefined
    const linked = link !== undefined
    const originNode = link ? graphRef?.getNodeById(link.originNodeId) : null

    const slotInfo: WidgetSlotMetadata = {
      index,
      linked,
      originNodeId: link?.originNodeId,
      originOutputName: link
        ? originNode?.outputs?.[link.originSlot]?.name
        : undefined,
      promoted: input.widgetId !== undefined,
      type: String(input.type)
    }
    const widgetName = input.widget?.name
    if (widgetName) metadata.set(widgetName, slotInfo)
    else if ((input.widgetId !== undefined || linked) && input.name) {
      metadata.set(input.name, slotInfo)
    }
  })
  return metadata
}

function getHostNode(
  rootGraph: LGraph | null,
  nodeData: NodeState
): LGraphNode | null {
  if (!rootGraph) return null
  const locatorId = locatorIdFromState(nodeData, rootGraph.id)
  return locatorId ? getNodeByLocatorId(rootGraph, locatorId) : null
}

function isWidgetVisible(
  options: IWidgetOptions,
  showAdvanced: boolean,
  ignoreAdvanced = false
): boolean {
  const hidden = options.hidden ?? false
  const advanced = options.advanced ?? false
  return !hidden && (!advanced || showAdvanced || ignoreAdvanced)
}

function hasWidgetError(
  widget: { name: string; errorTarget?: WidgetErrorTarget },
  nodeExecId: NodeExecutionId,
  nodeErrors:
    | { errors: { extra_info?: { input_name?: string } }[] }
    | undefined,
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>,
  missingModelStore: ReturnType<typeof useMissingModelStore>,
  missingMediaStore: ReturnType<typeof useMissingMediaStore>
): boolean {
  const hasHostError =
    !!nodeErrors?.errors.some(
      (e) => e.extra_info?.input_name === widget.name
    ) ||
    missingModelStore.isWidgetMissingModel(nodeExecId, widget.name) ||
    missingMediaStore.isWidgetMissingMedia(nodeExecId, widget.name)
  const target = widget.errorTarget
  if (!target) return hasHostError

  const sourceErrors = executionErrorStore.lastNodeErrors?.[target.executionId]
  return (
    hasHostError ||
    !!sourceErrors?.errors.some(
      (e) => e.extra_info?.input_name === target.widgetName
    ) ||
    missingModelStore.isWidgetMissingModel(
      target.executionId,
      target.widgetName
    )
  )
}

function createWidgetUpdateHandler({
  id,
  live,
  errorTarget,
  nodeExecId,
  widgetName,
  widgetOptions,
  executionErrorStore,
  widgetValueStore
}: {
  id: WidgetId
  live?: { node: LGraphNode; widget: IBaseWidget }
  errorTarget?: WidgetErrorTarget
  nodeExecId: NodeExecutionId
  widgetName: string
  widgetOptions: IWidgetOptions
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>
  widgetValueStore: ReturnType<typeof useWidgetValueStore>
}): (newValue: WidgetValue) => void {
  return (newValue: WidgetValue) => {
    widgetValueStore.setValue(id, newValue)
    if (live) {
      const normalized = normalizeWidgetValue(newValue)
      live.widget.value = normalized
      live.widget.callback?.(normalized, app.canvas, live.node)
      live.node.widgets?.forEach((w) => w.triggerDraw?.())
    }

    const options = { min: widgetOptions?.min, max: widgetOptions?.max }
    if (errorTarget) {
      executionErrorStore.clearWidgetRelatedErrors(
        errorTarget.executionId,
        errorTarget.widgetName,
        errorTarget.widgetName,
        newValue,
        options
      )
    }
    executionErrorStore.clearWidgetRelatedErrors(
      nodeExecId,
      widgetName,
      widgetName,
      newValue,
      options
    )
  }
}

function resolveWidgetIds(
  graphId: string | undefined,
  nodeId: NodeId,
  explicitWidgetIds: readonly WidgetId[] | undefined,
  widgetValueStore: ReturnType<typeof useWidgetValueStore>
): readonly WidgetId[] {
  if (explicitWidgetIds) return explicitWidgetIds
  const bareNodeId = stripGraphPrefix(nodeId)
  return graphId && bareNodeId
    ? widgetValueStore.getNodeWidgetIds(graphId, bareNodeId)
    : []
}

interface LiveWidgetContext {
  live?: { node: LGraphNode; widget: IBaseWidget }
  errorTarget?: WidgetErrorTarget
  controlWidget?: SafeControlWidget
  sourceExecutionId?: NodeExecutionId
}

/**
 * Resolves the live litegraph widget (and, for promoted subgraph inputs, its
 * interior source) into the control widget and error target the render path
 * needs. Empty when the widget has no live counterpart (e.g. static previews).
 */
function resolveLiveWidgetContext(
  rootGraph: LGraph | null,
  hostNode: LGraphNode | null,
  liveWidget: IBaseWidget | undefined
): LiveWidgetContext {
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

/**
 * A promoted widget renders the interior source node's identity, so consumers
 * that resolve a node from the locator reach the source rather than the host.
 */
function widgetNodeLocatorId(
  ctx: WidgetProcessingContext,
  bareWidgetId: NodeId | null,
  sourceExecutionId: NodeExecutionId | undefined
): NodeLocatorId | undefined {
  if (sourceExecutionId && ctx.rootGraph) {
    const sourceLocator = executionIdToNodeLocatorId(
      ctx.rootGraph,
      sourceExecutionId
    )
    if (sourceLocator) return sourceLocator
  }
  if (!bareWidgetId) return undefined
  return (
    createNodeLocatorId(
      subgraphIdFromState(ctx.nodeData, ctx.rootGraphId),
      bareWidgetId
    ) ?? undefined
  )
}

interface WidgetProcessingContext {
  nodeData: NodeState
  showAdvanced: boolean
  rootGraph: LGraph | null
  /** Root graph id, known even before `app.isGraphReady`. */
  rootGraphId: string | undefined
  hostNode: LGraphNode | null
  liveWidgets: Map<WidgetId, IBaseWidget>
  slotMetadata: Map<string, WidgetSlotMetadata>
  nodeExecId: NodeExecutionId
  nodeErrors: Parameters<typeof hasWidgetError>[2]
  widgetValueStore: ReturnType<typeof useWidgetValueStore>
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>
  missingModelStore: ReturnType<typeof useMissingModelStore>
  missingMediaStore: ReturnType<typeof useMissingMediaStore>
  nodeDefStore: ReturnType<typeof useNodeDefStore>
  ui: WidgetUiCallbacks
}

function processWidget(
  id: WidgetId,
  ctx: WidgetProcessingContext
): ProcessedWidget | null {
  const widgetState = ctx.widgetValueStore.getWidget(id)
  if (!widgetState) return null

  const liveWidget = ctx.liveWidgets.get(id)
  const type = liveWidget?.type ?? widgetState.type
  const renderState = ctx.widgetValueStore.getWidgetRenderState(id)
  const options: IWidgetOptions = { ...(widgetState.options ?? {}) }
  if (options.advanced === undefined) options.advanced = renderState?.advanced
  if (!shouldRenderAsVue({ type, options })) return null

  const { live, errorTarget, controlWidget, sourceExecutionId } =
    resolveLiveWidgetContext(ctx.rootGraph, ctx.hostNode, liveWidget)

  const slotInfo = ctx.slotMetadata.get(widgetState.name)
  const visible = isWidgetVisible(
    options,
    ctx.showAdvanced,
    slotInfo?.linked || slotInfo?.promoted
  )
  const isDisabled = slotInfo?.linked || widgetState.disabled
  const widgetOptions = isDisabled ? { ...options, disabled: true } : options
  const value = normalizeWidgetValue(widgetState.value)
  const bareWidgetId = stripGraphPrefix(widgetState.nodeId)
  const linkedUpstream: LinkedUpstreamInfo | undefined =
    slotInfo?.linked && slotInfo.originNodeId
      ? { nodeId: slotInfo.originNodeId, outputName: slotInfo.originOutputName }
      : undefined

  const updateHandler = createWidgetUpdateHandler({
    id,
    live,
    errorTarget,
    nodeExecId: ctx.nodeExecId,
    widgetName: widgetState.name,
    widgetOptions,
    executionErrorStore: ctx.executionErrorStore,
    widgetValueStore: ctx.widgetValueStore
  })

  const simplified: SimplifiedWidget = {
    name: widgetState.name,
    type,
    value,
    borderStyle: widgetOptions.advanced
      ? 'ring ring-component-node-widget-advanced'
      : undefined,
    callback: updateHandler,
    controlWidget,
    label: widgetState.label,
    linkedUpstream,
    nodeLocatorId: widgetNodeLocatorId(ctx, bareWidgetId, sourceExecutionId),
    options: widgetOptions,
    spec: live
      ? ctx.nodeDefStore.getInputSpecForWidget(live.node, live.widget.name)
      : undefined
  }

  const valueTooltip =
    isTooltipValueType(type) && String(value).length > 10
      ? String(value)
      : undefined
  const tooltipConfig = ctx.ui.getTooltipConfig(
    { name: widgetState.name, tooltip: renderState?.tooltip },
    valueTooltip
  )
  const handleContextMenu = (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ctx.ui.handleNodeRightClick(e, ctx.nodeData.id)
    showNodeOptions(e, widgetState.name)
  }

  return {
    handleContextMenu,
    hasLayoutSize: renderState?.hasLayoutSize ?? false,
    hasError: hasWidgetError(
      { name: widgetState.name, errorTarget },
      ctx.nodeExecId,
      ctx.nodeErrors,
      ctx.executionErrorStore,
      ctx.missingModelStore,
      ctx.missingMediaStore
    ),
    widgetId: id,
    renderKey: `${id}:${type}`,
    vueComponent:
      getComponent(type) ||
      (renderState?.isDOMWidget ? WidgetDOM : WidgetLegacy),
    simplified,
    visible,
    updateHandler,
    tooltipConfig,
    slotMetadata: slotInfo
  }
}

export function computeProcessedWidgets({
  nodeData,
  widgetIds,
  graphId,
  showAdvanced,
  isGraphReady,
  rootGraph,
  ui
}: ComputeProcessedWidgetsOptions): ProcessedWidget[] {
  if (!nodeData) return []

  const executionErrorStore = useExecutionErrorStore()
  const missingModelStore = useMissingModelStore()
  const missingMediaStore = useMissingMediaStore()
  const widgetValueStore = useWidgetValueStore()
  const nodeDefStore = useNodeDefStore()

  const nodeExecId =
    isGraphReady && rootGraph
      ? executionIdFromState(rootGraph, nodeData)
      : createNodeExecutionId([nodeData.id])
  if (!nodeExecId) return []

  const hostNode = getHostNode(rootGraph, nodeData)
  const liveWidgets = hostNode
    ? mapLiveWidgetsById(hostNode)
    : new Map<WidgetId, IBaseWidget>()
  const orderedIds = resolveWidgetIds(
    graphId,
    nodeData.id,
    widgetIds,
    widgetValueStore
  )
  // Drop ids whose live widget is gone (e.g. removed directly on node.widgets);
  // when the host node isn't resolvable yet, fall back to the stored order.
  const ids = hostNode
    ? orderedIds.filter((id) => liveWidgets.has(id))
    : orderedIds
  const graphRef = hostNode?.graph ?? rootGraph
  const slotMetadata = buildSlotMetadata(
    hostNode?.inputs,
    graphRef,
    nodeData.id
  )
  const ctx: WidgetProcessingContext = {
    nodeData,
    showAdvanced,
    rootGraph,
    rootGraphId: graphId,
    hostNode,
    liveWidgets,
    slotMetadata,
    nodeExecId,
    nodeErrors: executionErrorStore.lastNodeErrors?.[nodeExecId],
    widgetValueStore,
    executionErrorStore,
    missingModelStore,
    missingMediaStore,
    nodeDefStore,
    ui
  }

  return Array.from(new Set(ids))
    .map((id) => processWidget(id, ctx))
    .filter((widget): widget is ProcessedWidget => widget !== null)
}
