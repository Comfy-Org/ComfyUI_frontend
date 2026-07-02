import type { TooltipOptions } from 'primevue'
import { computed } from 'vue'
import type { Component } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
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
import WidgetDOM from '@/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
  shouldRenderAsVue
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { app } from '@/scripts/app'
import { nodeTypeValidForApp } from '@/stores/appModeStore'
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
import { getControlWidget } from '@/types/simplifiedWidget'
import type {
  LinkedUpstreamInfo,
  SimplifiedWidget,
  WidgetValue
} from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'
import { parseWidgetId } from '@/types/widgetId'
import {
  getExecutionIdFromNodeData,
  getLocatorIdFromNodeData,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'
import { getWidgetIdForNode } from '@/utils/litegraphUtil'

const TOOLTIP_VALUE_TYPES = ['asset', 'combo', 'number', 'text'] as const
type TooltipValueType = (typeof TOOLTIP_VALUE_TYPES)[number]
function isTooltipValueType(val: unknown): val is TooltipValueType {
  return TOOLTIP_VALUE_TYPES.includes(val as TooltipValueType)
}

interface WidgetSlotMetadata {
  index: number
  linked: boolean
  originNodeId?: NodeId
  originOutputName?: string
  type: string
}

interface WidgetTooltipSource {
  name: string
  tooltip?: string
}

interface WidgetErrorTarget {
  executionId: NodeExecutionId
  widgetName: string
}

export interface ProcessedWidget {
  advanced: boolean
  handleContextMenu: (e: PointerEvent) => void
  hasLayoutSize: boolean
  hasError: boolean
  hidden: boolean
  id?: string
  widgetId?: WidgetId
  name: string
  renderKey: string
  simplified: SimplifiedWidget
  tooltipConfig: TooltipOptions
  type: string
  updateHandler: (value: WidgetValue) => void
  value: WidgetValue
  visible: boolean
  vueComponent: Component
  slotMetadata?: WidgetSlotMetadata
}

interface WidgetUiCallbacks {
  getTooltipConfig: (
    widget: WidgetTooltipSource,
    fullVal?: string
  ) => TooltipOptions
  handleNodeRightClick: (e: PointerEvent, nodeId: NodeId) => void
}

interface ComputeProcessedWidgetsOptions {
  nodeData: VueNodeData | undefined
  widgetIds?: readonly WidgetId[]
  graphId: string | undefined
  showAdvanced: boolean
  isGraphReady: boolean
  rootGraph: LGraph | null
  ui: WidgetUiCallbacks
}

function normalizeWidgetValue(value: unknown): WidgetValue {
  if (value === null || value === undefined || value === void 0) {
    return undefined
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'object') {
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item): item is File => item instanceof File)
    ) {
      return value
    }
    return value
  }
  console.warn(`Invalid widget value type: ${typeof value}`, value)
  return undefined
}

function buildSlotMetadata(
  inputs: INodeInputSlot[] | undefined,
  graphRef: LGraph | null | undefined
): Map<string, WidgetSlotMetadata> {
  const metadata = new Map<string, WidgetSlotMetadata>()
  inputs?.forEach((input, index) => {
    let originNodeId: NodeId | undefined
    let originOutputName: string | undefined

    let linked = input.link != null
    if (input.link != null && graphRef) {
      const link = graphRef.getLink(input.link)
      linked = Boolean(link)
      const originNode = link ? graphRef.getNodeById(link.origin_id) : null
      if (link && originNode) {
        originNodeId = link.origin_id
        originOutputName = originNode.outputs?.[link.origin_slot]?.name
      }
    }

    const slotInfo: WidgetSlotMetadata = {
      index,
      linked,
      originNodeId,
      originOutputName,
      type: String(input.type)
    }
    if (input.name) metadata.set(input.name, slotInfo)
    if (input.widget?.name) metadata.set(input.widget.name, slotInfo)
  })
  return metadata
}

function getProcessedNodeExecutionId(
  isGraphReady: boolean,
  rootGraph: LGraph | null,
  nodeData: VueNodeData
): NodeExecutionId | null {
  if (!isGraphReady || !rootGraph) return createNodeExecutionId([nodeData.id])

  return getExecutionIdFromNodeData(rootGraph, nodeData)
}

function getWidgetNodeLocatorId(
  nodeData: VueNodeData,
  bareWidgetId: NodeId | null
): NodeLocatorId | undefined {
  if (!bareWidgetId) return undefined

  return (
    createNodeLocatorId(nodeData.subgraphId ?? null, bareWidgetId) ?? undefined
  )
}

function getHostNode(
  rootGraph: LGraph | null,
  nodeData: VueNodeData
): LGraphNode | null {
  if (!rootGraph) return null
  const locatorId = getLocatorIdFromNodeData(nodeData)
  return locatorId ? getNodeByLocatorId(rootGraph, locatorId) : null
}

function getLiveWidget(
  rootGraph: LGraph | null,
  nodeData: VueNodeData,
  id: WidgetId
): { node: LGraphNode; widget: IBaseWidget } | undefined {
  if (!rootGraph) return undefined

  const { nodeId } = parseWidgetId(id)
  const locatorId = createNodeLocatorId(nodeData.subgraphId ?? null, nodeId)
  const node = locatorId ? getNodeByLocatorId(rootGraph, locatorId) : null
  if (!node) return undefined

  const duplicateIndexByKey = new Map<string, number>()
  for (const widget of node.widgets ?? []) {
    const duplicateKey = `${widget.name}:${widget.type}`
    const duplicateIndex = duplicateIndexByKey.get(duplicateKey) ?? 0
    duplicateIndexByKey.set(duplicateKey, duplicateIndex + 1)
    if (getWidgetIdForNode(node, widget, duplicateIndex) === id) {
      return { node, widget }
    }
  }
}

function getWidgetErrorTarget(
  rootGraph: LGraph | null,
  hostNode: LGraphNode | null,
  liveWidget: IBaseWidget | undefined
): WidgetErrorTarget | undefined {
  if (!hostNode || !liveWidget) return undefined
  const source = resolvePromotedWidgetSource(rootGraph, hostNode, liveWidget)
  if (!source?.sourceExecutionId) return undefined

  return {
    executionId: source.sourceExecutionId,
    widgetName: source.sourceWidgetName
  }
}

export function isWidgetVisible(
  options: IWidgetOptions,
  showAdvanced: boolean,
  linked = false
): boolean {
  const hidden = options.hidden ?? false
  const advanced = options.advanced ?? false
  return !hidden && (!advanced || showAdvanced || linked)
}

export function hasWidgetError(
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

export function getWidgetIdentity(
  widget: { widgetId: WidgetId; type: string },
  _nodeId: NodeId | undefined,
  _index: number
): {
  dedupeIdentity: string
  renderKey: string
} {
  const dedupeIdentity = `${widget.widgetId}:${widget.type}`
  return { dedupeIdentity, renderKey: dedupeIdentity }
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
      live.widget.value = normalized ?? undefined
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

function getWidgetIds(
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

  const ids = getWidgetIds(graphId, nodeData.id, widgetIds, widgetValueStore)
  const hostNode = getHostNode(rootGraph, nodeData)
  const slotMetadata = buildSlotMetadata(
    nodeData.inputs ?? hostNode?.inputs,
    hostNode?.graph ?? rootGraph
  )
  const nodeErrors = executionErrorStore.lastNodeErrors?.[nodeExecId]
  const result: ProcessedWidget[] = []
  const seenIdentities = new Set<string>()

  ids.forEach((id, index) => {
    const widgetState = widgetValueStore.getWidget(id)
    if (!widgetState) return

    const renderState = widgetValueStore.getWidgetRenderState(id)
    const live = getLiveWidget(rootGraph, nodeData, id)
    const liveWidget = live?.widget
    const sourceWidget =
      hostNode && liveWidget
        ? resolvePromotedWidgetSource(rootGraph, hostNode, liveWidget)
            ?.sourceWidget
        : undefined
    const options: IWidgetOptions = { ...(widgetState.options ?? {}) }
    if (options.advanced === undefined) {
      options.advanced = renderState?.advanced
    }
    if (!shouldRenderAsVue({ type: widgetState.type, options })) return

    const slotInfo = slotMetadata.get(widgetState.name)
    const visible = isWidgetVisible(options, showAdvanced, slotInfo?.linked)
    const isDisabled = slotInfo?.linked || widgetState.disabled
    const widgetOptions = isDisabled ? { ...options, disabled: true } : options
    const value = widgetState.value as WidgetValue
    const errorTarget = getWidgetErrorTarget(rootGraph, hostNode, liveWidget)
    const tooltip = renderState?.tooltip
    const hasLayoutSize = renderState?.hasLayoutSize ?? false
    const isDOMWidget = renderState?.isDOMWidget ?? false
    const vueComponent =
      getComponent(widgetState.type) || (isDOMWidget ? WidgetDOM : WidgetLegacy)
    const bareWidgetId = stripGraphPrefix(widgetState.nodeId)
    const linkedUpstream: LinkedUpstreamInfo | undefined =
      slotInfo?.linked && slotInfo.originNodeId
        ? {
            nodeId: slotInfo.originNodeId,
            outputName: slotInfo.originOutputName
          }
        : undefined
    const controlWidget =
      (liveWidget ? getControlWidget(liveWidget) : undefined) ??
      (sourceWidget ? getControlWidget(sourceWidget) : undefined)
    const updateHandler = createWidgetUpdateHandler({
      id,
      live,
      errorTarget,
      nodeExecId,
      widgetName: widgetState.name,
      widgetOptions,
      executionErrorStore,
      widgetValueStore
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
      nodeLocatorId: getWidgetNodeLocatorId(nodeData, bareWidgetId),
      options: widgetOptions,
      spec:
        widgetValueStore.getWidgetSpec(id)?.spec ??
        (live
          ? nodeDefStore.getInputSpecForWidget(live.node, live.widget.name)
          : undefined)
    }
    const valueTooltip =
      isTooltipValueType(widgetState.type) && String(value).length > 10
        ? String(value)
        : undefined
    const tooltipConfig = ui.getTooltipConfig(
      { name: widgetState.name, tooltip },
      valueTooltip
    )
    const handleContextMenu = (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      ui.handleNodeRightClick(e, nodeData.id)
      showNodeOptions(e, widgetState.name)
    }
    const identity = getWidgetIdentity(
      { widgetId: id, type: widgetState.type },
      nodeData.id,
      index
    )
    if (seenIdentities.has(identity.dedupeIdentity)) return
    seenIdentities.add(identity.dedupeIdentity)

    result.push({
      advanced: widgetOptions.advanced ?? false,
      handleContextMenu,
      hasLayoutSize,
      hasError: hasWidgetError(
        { name: widgetState.name, errorTarget },
        nodeExecId,
        nodeErrors,
        executionErrorStore,
        missingModelStore
      ),
      hidden: widgetOptions.hidden ?? false,
      widgetId: id,
      name: widgetState.name,
      renderKey: identity.renderKey,
      type: widgetState.type,
      vueComponent,
      simplified,
      value,
      visible,
      updateHandler,
      tooltipConfig,
      slotMetadata: slotInfo,
      ...(bareWidgetId === null ? {} : { id: bareWidgetId })
    })
  })

  return result
}

export function useProcessedWidgets(
  nodeDataGetter: () => VueNodeData | undefined,
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
    return (
      isSelectInputsMode.value &&
      nodeData?.mode === LGraphEventMode.ALWAYS &&
      nodeTypeValidForApp(nodeData.type) &&
      !nodeData.hasErrors
    )
  })

  const processedWidgets = computed((): ProcessedWidget[] =>
    computeProcessedWidgets({
      nodeData: nodeDataGetter(),
      widgetIds: widgetIdsGetter(),
      graphId: canvasStore.canvas?.graph?.rootGraph.id,
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
