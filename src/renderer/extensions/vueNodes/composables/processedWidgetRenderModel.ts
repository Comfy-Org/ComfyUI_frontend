import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import type {
  WidgetGridItem,
  WidgetSlotMetadata
} from '@/renderer/extensions/vueNodes/types/widgetGrid'
import WidgetDOM from '@/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import { getComponent } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import type {
  NodeExecutionId,
  NodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import type { LinkTopology } from '@comfyorg/graph-model/linkTopology'
import { getControlWidget } from '@/types/simplifiedWidget'
import { isWidgetVisibleOnSurface } from '@/types/widgetVisibility'
import type { WidgetVisibilityComponent } from '@/types/widgetVisibility'
import type {
  SafeControlWidget,
  SimplifiedWidget,
  WidgetValue
} from '@/types/simplifiedWidget'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetState } from '@comfyorg/graph-model/widgetState'
import {
  executionIdFromState,
  executionIdToNodeLocatorId,
  getNodeByState,
  locatorIdFromState,
  subgraphIdFromState
} from '@/utils/graphTraversalUtil'
import { mapLiveWidgetsById } from '@/utils/litegraphUtil'
import { createWidgetValueBinding } from './widgetValueBinding'
import type { WidgetErrorTarget } from './widgetValueBinding'

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

export interface ProcessedWidget extends WidgetGridItem {
  handleContextMenu: (e: PointerEvent) => void
  hasError: boolean
  hasLayoutSize: boolean
  tooltipText: string
  updateHandler: (value: WidgetValue) => void
  widgetId: WidgetId
}

export interface WidgetUiCallbacks {
  getTooltipText: (widget: WidgetTooltipSource, fullValue?: string) => string
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
  canUpdate?: (id: WidgetId) => boolean
}

function createSlotMetadata(
  input: INodeInputSlot,
  index: number,
  link: LinkTopology | undefined,
  graphRef: LGraph | null | undefined
): WidgetSlotMetadata {
  const originNode = link ? graphRef?.getNodeById(link.originNodeId) : null
  return {
    index,
    linked: link !== undefined,
    linkedUpstream: link
      ? {
          nodeId: link.originNodeId,
          outputName: originNode?.outputs[link.originSlot]?.name
        }
      : undefined,
    promoted: input.widgetId !== undefined,
    type: String(input.type)
  }
}

function getSlotWidgetName(input: INodeInputSlot): string | undefined {
  return (
    input.widget?.name ||
    (input.widgetId !== undefined && input.name ? input.name : undefined)
  )
}

function buildSlotMetadata(
  inputs: INodeInputSlot[] | undefined,
  graphRef: LGraph | null | undefined,
  nodeId: NodeId
): Map<string, WidgetSlotMetadata> {
  const linkStore = useLinkStore()
  const scope = graphRef ? graphScopeOf(graphRef) : undefined
  const metadata = new Map<string, WidgetSlotMetadata>()
  for (const [index, input] of inputs?.entries() ?? []) {
    const link = scope
      ? linkStore.getInputSlotLink(scope, nodeId, index)
      : undefined
    const widgetName = getSlotWidgetName(input)
    if (!widgetName || metadata.has(widgetName)) continue
    metadata.set(widgetName, createSlotMetadata(input, index, link, graphRef))
  }
  return metadata
}

function getHostNode(
  rootGraph: LGraph | null,
  nodeData: NodeState
): LGraphNode | null {
  if (!rootGraph) return null
  return getNodeByState(rootGraph, nodeData)
}

function isWidgetVisible(
  visibility: WidgetVisibilityComponent,
  showAdvanced: boolean,
  slotInfo: WidgetSlotMetadata | undefined
): boolean {
  return isWidgetVisibleOnSurface(visibility, 'vueNode', {
    showAdvanced:
      showAdvanced || slotInfo?.linked || slotInfo?.promoted || false
  })
}

function hasWidgetError(
  widget: { name: string; errorTarget?: WidgetErrorTarget },
  nodeExecId: NodeExecutionId | null,
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
    (nodeExecId !== null &&
      (missingModelStore.isWidgetMissingModel(nodeExecId, widget.name) ||
        missingMediaStore.isWidgetMissingMedia(nodeExecId, widget.name)))
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
  if (!bareWidgetId || bareWidgetId.includes(':')) return undefined
  return createNodeLocatorId(
    subgraphIdFromState(ctx.nodeData, ctx.rootGraphId),
    bareWidgetId
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
  nodeExecId: NodeExecutionId | null
  nodeErrors: Parameters<typeof hasWidgetError>[2]
  widgetValueStore: ReturnType<typeof useWidgetValueStore>
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>
  missingModelStore: ReturnType<typeof useMissingModelStore>
  missingMediaStore: ReturnType<typeof useMissingMediaStore>
  nodeDefStore: ReturnType<typeof useNodeDefStore>
  ui: WidgetUiCallbacks
  canUpdate?: (id: WidgetId) => boolean
}

function widgetRenderer(
  state: WidgetState,
  liveWidget: IBaseWidget | undefined,
  isDOMWidget: boolean | undefined
) {
  const type = liveWidget?.type ?? state.type
  if (!type) return
  const component =
    !isDOMWidget && typeof liveWidget?.draw === 'function'
      ? WidgetLegacy
      : getComponent(type) || (isDOMWidget ? WidgetDOM : WidgetLegacy)
  return { type, component }
}

function widgetTooltip(
  ui: WidgetUiCallbacks,
  widget: SimplifiedWidget,
  tooltip: string | undefined
): string {
  const fullValue =
    isTooltipValueType(widget.type) && String(widget.value).length > 10
      ? String(widget.value)
      : undefined
  return ui.getTooltipText({ name: widget.name, tooltip }, fullValue)
}

function processWidget(
  id: WidgetId,
  ctx: WidgetProcessingContext
): ProcessedWidget | null {
  const entity = ctx.widgetValueStore.getWidgetEntity(id)
  if (!entity) return null
  const { state: widgetState, render: renderState, visibility } = entity

  const liveWidget = ctx.liveWidgets.get(id)
  const renderer = widgetRenderer(
    widgetState,
    liveWidget,
    renderState.isDOMWidget
  )
  if (!renderer) return null
  const { type, component } = renderer

  const { live, errorTarget, controlWidget, sourceExecutionId } =
    resolveLiveWidgetContext(ctx.rootGraph, ctx.hostNode, liveWidget)

  const slotInfo = ctx.slotMetadata.get(widgetState.name)
  const visible = isWidgetVisible(visibility, ctx.showAdvanced, slotInfo)
  const advanced = visibility.surfaces.vueNode === 'advanced'
  const bareWidgetId = stripGraphPrefix(widgetState.nodeId)

  const {
    value,
    options,
    updateHandler,
    controlWidget: guardedControlWidget
  } = createWidgetValueBinding({
    id,
    state: widgetState,
    live,
    errorTarget,
    nodeExecId: ctx.nodeExecId,
    controlWidget,
    linked: () =>
      buildSlotMetadata(
        ctx.nodeData.inputs,
        ctx.hostNode?.graph,
        ctx.nodeData.id
      ).get(widgetState.name)?.linked === true,
    canUpdate: ctx.canUpdate
  })

  const simplified: SimplifiedWidget = {
    name: widgetState.name,
    type,
    value,
    borderStyle: advanced ? 'ring ring-primary' : undefined,
    callback: updateHandler,
    controlWidget: guardedControlWidget,
    label: widgetState.label,
    linkedUpstream: slotInfo?.linkedUpstream,
    nodeLocatorId: widgetNodeLocatorId(ctx, bareWidgetId, sourceExecutionId),
    hostNodeLocatorId:
      locatorIdFromState(ctx.nodeData, ctx.rootGraphId) ?? undefined,
    options,
    spec: live
      ? ctx.nodeDefStore.getInputSpecForWidget(live.node, live.widget.name)
      : undefined
  }

  const handleContextMenu = (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ctx.ui.handleNodeRightClick(e, ctx.nodeData.id)
    showNodeOptions(e, {
      nodeId: ctx.nodeData.id,
      widgetName: widgetState.name
    })
  }

  return {
    handleContextMenu,
    hasLayoutSize: renderState.hasLayoutSize ?? false,
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
    vueComponent: component,
    simplified,
    visible,
    suppressedByConnection: visibility.suppression.byConnection,
    updateHandler,
    tooltipText: widgetTooltip(ctx.ui, simplified, renderState.tooltip),
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
  ui,
  canUpdate
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
    nodeErrors: nodeExecId
      ? executionErrorStore.lastNodeErrors?.[nodeExecId]
      : undefined,
    widgetValueStore,
    executionErrorStore,
    missingModelStore,
    missingMediaStore,
    nodeDefStore,
    ui,
    canUpdate
  }

  return Array.from(new Set(ids))
    .map((id) => processWidget(id, ctx))
    .filter((widget): widget is ProcessedWidget => widget !== null)
}
