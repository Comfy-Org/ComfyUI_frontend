import type { TooltipOptions } from 'primevue'
import { computed } from 'vue'
import type { Component } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useAppMode } from '@/composables/useAppMode'
import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
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
  shouldExpand,
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
import type { WidgetRenderState } from '@/stores/widgetValueStore'
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
import { widgetId } from '@/types/widgetId'
import type { WidgetState } from '@/types/widgetState'
import { getExecutionIdFromNodeData } from '@/utils/graphTraversalUtil'
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

interface RenderWidgetSource extends WidgetTooltipSource {
  callback: (value: WidgetValue) => void
  controlWidget: SimplifiedWidget['controlWidget']
  hasLayoutSize: boolean
  isDOMWidget: boolean
  name: string
  options: IWidgetOptions
  renderState?: WidgetRenderState
  slotMetadata?: WidgetSlotMetadata
  sourceExecutionId?: NodeExecutionId
  sourceWidgetName?: string
  type: string
  widget: IBaseWidget
  widgetId?: WidgetId
}

interface ProcessedWidget {
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
  node: LGraphNode | null | undefined
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

function isDOMBackedWidget(widget: IBaseWidget): boolean {
  return (
    ('element' in widget && !!widget.element) ||
    ('component' in widget && !!widget.component)
  )
}

function buildSlotMetadata(
  inputs: INodeInputSlot[] | undefined,
  graphRef: LGraph | null | undefined
): Map<string, WidgetSlotMetadata> {
  const metadata = new Map<string, WidgetSlotMetadata>()
  inputs?.forEach((input, index) => {
    let originNodeId: NodeId | undefined
    let originOutputName: string | undefined

    if (input.link != null && graphRef) {
      const link = graphRef.getLink(input.link)
      const originNode = link ? graphRef.getNodeById(link.origin_id) : null
      if (link && originNode) {
        originNodeId = link.origin_id
        originOutputName = originNode.outputs?.[link.origin_slot]?.name
      }
    }

    const slotInfo: WidgetSlotMetadata = {
      index,
      linked: input.link != null,
      originNodeId,
      originOutputName,
      type: String(input.type)
    }
    if (input.name) metadata.set(input.name, slotInfo)
    if (input.widget?.name) metadata.set(input.widget.name, slotInfo)
  })
  return metadata
}

function createWidgetCallback(
  node: LGraphNode,
  widget: IBaseWidget
): (value: WidgetValue) => void {
  return (value: WidgetValue) => {
    const normalized = normalizeWidgetValue(value)
    widget.value = normalized ?? undefined
    widget.callback?.(normalized, app.canvas, node)
    node.widgets?.forEach((w) => w.triggerDraw?.())
  }
}

function createWidgetUpdateHandler(
  widgetState: WidgetState | undefined,
  widget: RenderWidgetSource,
  nodeExecId: NodeExecutionId,
  widgetOptions: IWidgetOptions,
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>
): (newValue: WidgetValue) => void {
  return (newValue: WidgetValue) => {
    if (widgetState) widgetState.value = newValue
    widget.callback(newValue)
    const options = { min: widgetOptions?.min, max: widgetOptions?.max }
    if (widget.sourceExecutionId) {
      const sourceWidgetName = widget.sourceWidgetName ?? widget.name
      executionErrorStore.clearWidgetRelatedErrors(
        widget.sourceExecutionId,
        sourceWidgetName,
        sourceWidgetName,
        newValue,
        options
      )
    }
    executionErrorStore.clearWidgetRelatedErrors(
      nodeExecId,
      widget.name,
      widget.name,
      newValue,
      options
    )
  }
}

export function hasWidgetError(
  widget: {
    name: string
    sourceExecutionId?: NodeExecutionId
    sourceWidgetName?: string
  },
  nodeExecId: NodeExecutionId,
  nodeErrors:
    | { errors: { extra_info?: { input_name?: string } }[] }
    | undefined,
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>,
  missingModelStore: ReturnType<typeof useMissingModelStore>
): boolean {
  const errors = widget.sourceExecutionId
    ? executionErrorStore.lastNodeErrors?.[widget.sourceExecutionId]?.errors
    : nodeErrors?.errors
  const errorInputName = widget.sourceExecutionId
    ? (widget.sourceWidgetName ?? widget.name)
    : widget.name
  return (
    !!errors?.some((e) => e.extra_info?.input_name === errorInputName) ||
    missingModelStore.isWidgetMissingModel(nodeExecId, widget.name)
  )
}

export function getWidgetIdentity(
  widget: {
    widgetId?: WidgetId
    name: string
    type: string
    sourceExecutionId?: NodeExecutionId
  },
  nodeId: NodeId | undefined,
  index: number
): {
  dedupeIdentity?: string
  renderKey: string
} {
  if (widget.widgetId) {
    const dedupeIdentity = `${widget.widgetId}:${widget.type}`
    return { dedupeIdentity, renderKey: dedupeIdentity }
  }
  const hostNodeIdRoot = nodeId ? stripGraphPrefix(nodeId) : null
  const stableIdentityRoot = widget.sourceExecutionId
    ? `exec:${widget.sourceExecutionId}`
    : hostNodeIdRoot
      ? `node:${hostNodeIdRoot}`
      : undefined

  const dedupeIdentity = stableIdentityRoot
    ? `${stableIdentityRoot}:${widget.name}:${widget.type}`
    : undefined
  const renderKey =
    dedupeIdentity ??
    `transient:${String(nodeId ?? '')}:${widget.name}:${widget.type}:${index}`
  return { dedupeIdentity, renderKey }
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

export function isWidgetVisible(
  options: IWidgetOptions,
  showAdvanced: boolean,
  linked = false
): boolean {
  const hidden = options.hidden ?? false
  const advanced = options.advanced ?? false
  return !hidden && (!advanced || showAdvanced || linked)
}

export function getNodeRenderableWidgets(
  node: LGraphNode | null | undefined
): IBaseWidget[] {
  return node?.widgets ?? []
}

function getFallbackWidgetId(
  graphId: string | undefined,
  nodeId: NodeId,
  widget: IBaseWidget
): WidgetId | undefined {
  const bareNodeId = stripGraphPrefix(nodeId)
  return graphId && bareNodeId
    ? widgetId(graphId, bareNodeId, widget.name)
    : undefined
}

function getMergedOptions(
  widget: IBaseWidget,
  widgetState: WidgetState | undefined,
  renderState: WidgetRenderState | undefined
): IWidgetOptions {
  const mergedOptions: IWidgetOptions = {
    ...(widget.options ?? {}),
    ...(widgetState?.options ?? {})
  }
  if (mergedOptions.advanced === undefined) {
    mergedOptions.advanced = renderState?.advanced ?? widget.advanced
  }
  return mergedOptions
}

function toRenderWidgetSource({
  graphId,
  index,
  node,
  slotMetadata,
  widget,
  widgetValueStore
}: {
  graphId: string | undefined
  index: number
  node: LGraphNode
  slotMetadata: Map<string, WidgetSlotMetadata>
  widget: IBaseWidget
  widgetValueStore: ReturnType<typeof useWidgetValueStore>
}): RenderWidgetSource | undefined {
  const widgetId =
    getWidgetIdForNode(node, widget, index) ??
    getFallbackWidgetId(graphId, node.id, widget)
  const widgetState = widgetId
    ? widgetValueStore.getWidget(widgetId)
    : undefined
  const renderState = widgetId
    ? widgetValueStore.getWidgetRenderState(widgetId)
    : undefined
  const options = getMergedOptions(widget, widgetState, renderState)

  if (!shouldRenderAsVue({ type: widget.type, options })) return undefined

  return {
    callback: createWidgetCallback(node, widget),
    controlWidget: renderState?.controlWidget ?? getControlWidget(widget),
    hasLayoutSize:
      renderState?.hasLayoutSize ??
      typeof widget.computeLayoutSize === 'function',
    isDOMWidget: renderState?.isDOMWidget ?? isDOMBackedWidget(widget),
    name: widgetState?.name ?? widget.name,
    options,
    renderState,
    slotMetadata: slotMetadata.get(widget.name),
    sourceExecutionId: renderState?.sourceExecutionId,
    sourceWidgetName: renderState?.sourceWidgetName,
    tooltip: renderState?.tooltip ?? widget.tooltip,
    type: widgetState?.type ?? widget.type,
    widget,
    widgetId
  }
}

export function computeProcessedWidgets({
  nodeData,
  node,
  graphId,
  showAdvanced,
  isGraphReady,
  rootGraph,
  ui
}: ComputeProcessedWidgetsOptions): ProcessedWidget[] {
  if (!nodeData || !node) return []

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

  const nodeErrors = executionErrorStore.lastNodeErrors?.[nodeExecId]
  const nodeId = nodeData.id
  const slotMetadata = buildSlotMetadata(node.inputs, node.graph)
  const result: ProcessedWidget[] = []
  const uniqueWidgets: Array<{
    widget: RenderWidgetSource
    identity: ReturnType<typeof getWidgetIdentity>
    widgetState: WidgetState | undefined
    isVisible: boolean
  }> = []
  const dedupeIndexByIdentity = new Map<string, number>()
  const duplicateIndexByKey = new Map<string, number>()

  for (const widget of getNodeRenderableWidgets(node)) {
    const duplicateKey = `${widget.name}:${widget.type}`
    const duplicateIndex = duplicateIndexByKey.get(duplicateKey) ?? 0
    duplicateIndexByKey.set(duplicateKey, duplicateIndex + 1)

    const renderWidget = toRenderWidgetSource({
      graphId,
      index: duplicateIndex,
      node,
      slotMetadata,
      widget,
      widgetValueStore
    })
    if (!renderWidget) continue

    const identity = getWidgetIdentity(renderWidget, nodeId, duplicateIndex)
    const widgetState = renderWidget.widgetId
      ? widgetValueStore.getWidget(renderWidget.widgetId)
      : undefined
    const visible = isWidgetVisible(
      renderWidget.options,
      showAdvanced,
      renderWidget.slotMetadata?.linked
    )
    if (!identity.dedupeIdentity) {
      uniqueWidgets.push({
        widget: renderWidget,
        identity,
        widgetState,
        isVisible: visible
      })
      continue
    }

    const existingIndex = dedupeIndexByIdentity.get(identity.dedupeIdentity)
    if (existingIndex === undefined) {
      dedupeIndexByIdentity.set(identity.dedupeIdentity, uniqueWidgets.length)
      uniqueWidgets.push({
        widget: renderWidget,
        identity,
        widgetState,
        isVisible: visible
      })
      continue
    }

    const existingWidget = uniqueWidgets[existingIndex]
    if (existingWidget && !existingWidget.isVisible && visible) {
      uniqueWidgets[existingIndex] = {
        widget: renderWidget,
        identity,
        widgetState,
        isVisible: true
      }
    }
  }

  for (const {
    widget,
    widgetState,
    isVisible: visible,
    identity: { renderKey }
  } of uniqueWidgets) {
    const bareWidgetId = stripGraphPrefix(widgetState?.nodeId ?? nodeId)
    const vueComponent =
      getComponent(widget.type) ||
      (widget.isDOMWidget ? WidgetDOM : WidgetLegacy)

    const { slotMetadata } = widget
    const value = (
      widgetState ? widgetState.value : widget.widget.value
    ) as WidgetValue
    const isDisabled = slotMetadata?.linked || widgetState?.disabled
    const widgetOptions = isDisabled
      ? { ...widget.options, disabled: true }
      : widget.options

    const borderStyle = widget.options.advanced
      ? 'ring ring-component-node-widget-advanced'
      : undefined

    const linkedUpstream: LinkedUpstreamInfo | undefined =
      slotMetadata?.linked && slotMetadata.originNodeId
        ? {
            nodeId: slotMetadata.originNodeId,
            outputName: slotMetadata.originOutputName
          }
        : undefined

    const nodeLocatorId = getWidgetNodeLocatorId(nodeData, bareWidgetId)

    const simplified: SimplifiedWidget = {
      name: widget.name,
      type: widget.type,
      value,
      borderStyle,
      callback: widget.callback,
      controlWidget: widget.controlWidget,
      label: widgetState?.label,
      linkedUpstream,
      nodeLocatorId,
      options: widgetOptions,
      spec: nodeDefStore.getInputSpecForWidget(node, widget.name)
    }

    const updateHandler = createWidgetUpdateHandler(
      widgetState,
      widget,
      nodeExecId,
      widgetOptions,
      executionErrorStore
    )

    const valueTooltip =
      isTooltipValueType(widget.type) && String(value).length > 10
        ? String(value)
        : undefined
    const tooltipConfig = ui.getTooltipConfig(widget, valueTooltip)
    const handleContextMenu = (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (nodeId !== undefined) ui.handleNodeRightClick(e, nodeId)
      showNodeOptions(e, widget.name)
    }

    result.push({
      advanced: widget.options.advanced ?? false,
      handleContextMenu,
      hasLayoutSize: widget.hasLayoutSize,
      hasError: hasWidgetError(
        widget,
        nodeExecId,
        nodeErrors,
        executionErrorStore,
        missingModelStore
      ),
      hidden: widget.options.hidden ?? false,
      widgetId: widget.widgetId,
      name: widget.name,
      renderKey,
      type: widget.type,
      vueComponent,
      simplified,
      value,
      visible,
      updateHandler,
      tooltipConfig,
      slotMetadata,
      ...(bareWidgetId === null ? {} : { id: bareWidgetId })
    })
  }

  return result
}

export function useProcessedWidgets(
  nodeDataGetter: () => VueNodeData | undefined,
  nodeGetter: () => LGraphNode | null | undefined
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
      node: nodeGetter(),
      graphId: canvasStore.canvas?.graph?.rootGraph.id,
      showAdvanced: showAdvanced.value,
      isGraphReady: app.isGraphReady,
      rootGraph: app.isGraphReady ? app.rootGraph : null,
      ui
    })
  )

  const visibleWidgets = computed(() =>
    processedWidgets.value.filter((w) => w.visible)
  )

  const gridTemplateRows = computed((): string =>
    visibleWidgets.value
      .map((w) =>
        shouldExpand(w.type) || w.hasLayoutSize ? 'auto' : 'min-content'
      )
      .join(' ')
  )

  return {
    canSelectInputs,
    gridTemplateRows,
    nodeType,
    processedWidgets,
    visibleWidgets
  }
}
