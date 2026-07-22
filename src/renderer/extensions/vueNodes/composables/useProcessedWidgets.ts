import type { TooltipOptions } from 'primevue'
import { computed } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
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
import { nodeTypeValidForApp } from '@/stores/appModeStore'
import { useLinkStore } from '@/stores/linkStore'
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
  getExecutionIdFromNodeData,
  getLocatorIdFromNodeData,
  getNodeByLocatorId,
  subgraphIdFromGraphId
} from '@/utils/graphTraversalUtil'
import { mapLiveWidgetsById } from '@/utils/litegraphUtil'

const TOOLTIP_VALUE_TYPES = ['asset', 'combo', 'number', 'text'] as const
type TooltipValueType = (typeof TOOLTIP_VALUE_TYPES)[number]
function isTooltipValueType(val: unknown): val is TooltipValueType {
  return TOOLTIP_VALUE_TYPES.includes(val as TooltipValueType)
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

interface WidgetUiCallbacks {
  getTooltipConfig: (
    widget: WidgetTooltipSource,
    fullVal?: string
  ) => TooltipOptions
  handleNodeRightClick: (e: PointerEvent, nodeId: NodeId) => void
}

interface ComputeProcessedWidgetsOptions {
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
  graphId: string | undefined,
  nodeId: NodeId
): Map<string, WidgetSlotMetadata> {
  const linkStore = useLinkStore()
  const metadata = new Map<string, WidgetSlotMetadata>()
  inputs?.forEach((input, index) => {
    const link = graphId
      ? linkStore.getInputSlotLink(graphId, nodeId, index)
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
      type: String(input.type)
    }
    if (input.name) metadata.set(input.name, slotInfo)
    if (input.widget?.name) metadata.set(input.widget.name, slotInfo)
  })
  return metadata
}

/** The `{ id, subgraphId }` shape the graph-traversal locator helpers expect. */
function nodeLocatorData(
  nodeData: NodeState,
  rootGraph: LGraph | null
): { id: NodeId; subgraphId: string | null } {
  return {
    id: nodeData.id,
    subgraphId: subgraphIdFromGraphId(nodeData.graphId, rootGraph?.id)
  }
}

function getProcessedNodeExecutionId(
  isGraphReady: boolean,
  rootGraph: LGraph | null,
  nodeData: NodeState
): NodeExecutionId | null {
  if (!isGraphReady || !rootGraph) return createNodeExecutionId([nodeData.id])

  return getExecutionIdFromNodeData(
    rootGraph,
    nodeLocatorData(nodeData, rootGraph)
  )
}

function getWidgetNodeLocatorId(
  nodeData: NodeState,
  bareWidgetId: NodeId | null,
  rootGraph: LGraph | null
): NodeLocatorId | undefined {
  if (!bareWidgetId) return undefined

  return (
    createNodeLocatorId(
      subgraphIdFromGraphId(nodeData.graphId, rootGraph?.id),
      bareWidgetId
    ) ?? undefined
  )
}

function getHostNode(
  rootGraph: LGraph | null,
  nodeData: NodeState
): LGraphNode | null {
  if (!rootGraph) return null
  const locatorId = getLocatorIdFromNodeData(
    nodeLocatorData(nodeData, rootGraph)
  )
  return locatorId ? getNodeByLocatorId(rootGraph, locatorId) : null
}

function isWidgetVisible(
  options: IWidgetOptions,
  showAdvanced: boolean,
  linked = false
): boolean {
  const hidden = options.hidden ?? false
  const advanced = options.advanced ?? false
  return !hidden && (!advanced || showAdvanced || linked)
}

function hasWidgetError(
  widget: { name: string; errorTarget?: WidgetErrorTarget },
  nodeExecId: NodeExecutionId,
  nodeErrors:
    | { errors: { extra_info?: { input_name?: string } }[] }
    | undefined,
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>,
  missingModelStore: ReturnType<typeof useMissingModelStore>
): boolean {
  const hasHostError =
    !!nodeErrors?.errors.some(
      (e) => e.extra_info?.input_name === widget.name
    ) || missingModelStore.isWidgetMissingModel(nodeExecId, widget.name)
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
    controlWidget
  }
}

interface WidgetProcessingContext {
  nodeData: NodeState
  showAdvanced: boolean
  rootGraph: LGraph | null
  hostNode: LGraphNode | null
  liveWidgets: Map<WidgetId, IBaseWidget>
  slotMetadata: Map<string, WidgetSlotMetadata>
  nodeExecId: NodeExecutionId
  nodeErrors: Parameters<typeof hasWidgetError>[2]
  widgetValueStore: ReturnType<typeof useWidgetValueStore>
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>
  missingModelStore: ReturnType<typeof useMissingModelStore>
  nodeDefStore: ReturnType<typeof useNodeDefStore>
  ui: WidgetUiCallbacks
}

function processWidget(
  id: WidgetId,
  ctx: WidgetProcessingContext
): ProcessedWidget | null {
  const widgetState = ctx.widgetValueStore.getWidget(id)
  if (!widgetState) return null

  const renderState = ctx.widgetValueStore.getWidgetRenderState(id)
  const options: IWidgetOptions = { ...(widgetState.options ?? {}) }
  if (options.advanced === undefined) options.advanced = renderState?.advanced
  if (!shouldRenderAsVue({ type: widgetState.type, options })) return null

  const { live, errorTarget, controlWidget } = resolveLiveWidgetContext(
    ctx.rootGraph,
    ctx.hostNode,
    ctx.liveWidgets.get(id)
  )

  const slotInfo = ctx.slotMetadata.get(widgetState.name)
  const visible = isWidgetVisible(options, ctx.showAdvanced, slotInfo?.linked)
  const isDisabled = slotInfo?.linked || widgetState.disabled
  const widgetOptions = isDisabled ? { ...options, disabled: true } : options
  const value = widgetState.value as WidgetValue
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
    type: widgetState.type,
    value,
    borderStyle: widgetOptions.advanced
      ? 'ring ring-component-node-widget-advanced'
      : undefined,
    callback: updateHandler,
    controlWidget,
    label: widgetState.label,
    linkedUpstream,
    nodeLocatorId: getWidgetNodeLocatorId(
      ctx.nodeData,
      bareWidgetId,
      ctx.rootGraph
    ),
    options: widgetOptions,
    spec: live
      ? ctx.nodeDefStore.getInputSpecForWidget(live.node, live.widget.name)
      : undefined
  }

  const valueTooltip =
    isTooltipValueType(widgetState.type) && String(value).length > 10
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
      ctx.missingModelStore
    ),
    widgetId: id,
    renderKey: `${id}:${widgetState.type}`,
    vueComponent:
      getComponent(widgetState.type) ||
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
  const widgetValueStore = useWidgetValueStore()
  const nodeDefStore = useNodeDefStore()

  const nodeExecId = getProcessedNodeExecutionId(
    isGraphReady,
    rootGraph,
    nodeData
  )
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
  const slotMetadata = buildSlotMetadata(
    hostNode?.inputs,
    hostNode?.graph ?? rootGraph,
    graphId,
    nodeData.id
  )
  const ctx: WidgetProcessingContext = {
    nodeData,
    showAdvanced,
    rootGraph,
    hostNode,
    liveWidgets,
    slotMetadata,
    nodeExecId,
    nodeErrors: executionErrorStore.lastNodeErrors?.[nodeExecId],
    widgetValueStore,
    executionErrorStore,
    missingModelStore,
    nodeDefStore,
    ui
  }

  return Array.from(new Set(ids))
    .map((id) => processWidget(id, ctx))
    .filter((widget): widget is ProcessedWidget => widget !== null)
}

export function useProcessedWidgets(
  nodeDataGetter: () => NodeState | undefined,
  widgetIdsGetter: () => readonly WidgetId[] | undefined = () => undefined
) {
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  const { isSelectInputsMode } = useAppMode()
  const { handleNodeRightClick } = useNodeEventHandlers()

  const nodeType = computed(() => nodeDataGetter()?.type || '')
  const { getWidgetTooltip, createTooltipConfig } = useNodeTooltips(nodeType)

  const ui: WidgetUiCallbacks = {
    getTooltipConfig: (widget, fullValue = '') =>
      createTooltipConfig(
        [getWidgetTooltip(widget), fullValue].join('\n\n').trim()
      ),
    handleNodeRightClick
  }

  const showAdvanced = computed(
    () =>
      nodeDataGetter()?.showAdvanced ||
      settingStore.get('Comfy.Node.AlwaysShowAdvancedWidgets')
  )

  const canSelectInputs = computed(() => {
    const nodeData = nodeDataGetter()
    if (!nodeData) return false
    const rootGraph = app.isGraphReady ? app.rootGraph : null
    const hostNode = getHostNode(rootGraph, nodeData)
    return (
      isSelectInputsMode.value &&
      nodeData.mode === LGraphEventMode.ALWAYS &&
      nodeTypeValidForApp(nodeData.type) &&
      !hostNode?.has_errors
    )
  })

  const processedWidgets = computed((): ProcessedWidget[] =>
    computeProcessedWidgets({
      nodeData: nodeDataGetter(),
      widgetIds: widgetIdsGetter(),
      graphId: canvasStore.rootGraphId,
      showAdvanced: showAdvanced.value,
      isGraphReady: app.isGraphReady,
      rootGraph: app.isGraphReady ? app.rootGraph : null,
      ui
    })
  )

  return {
    canSelectInputs,
    nodeType,
    processedWidgets
  }
}
