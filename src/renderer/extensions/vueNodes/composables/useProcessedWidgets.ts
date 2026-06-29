import type { TooltipOptions } from 'primevue'
import { computed } from 'vue'
import type { Component } from 'vue'

import type {
  SafeWidgetData,
  VueNodeData,
  WidgetSlotMetadata
} from '@/composables/graph/useGraphNodeManager'
import { nodeHasLoadVideoPreview } from '@/composables/video/useLoadVideoPreview'
import { useAppMode } from '@/composables/useAppMode'
import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import WidgetDOM from '@/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
  shouldExpand,
  shouldRenderAsVue
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { nodeTypeValidForApp } from '@/stores/appModeStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'
import type { WidgetState } from '@/types/widgetState'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type {
  LinkedUpstreamInfo,
  SimplifiedWidget,
  WidgetValue
} from '@/types/simplifiedWidget'
import {
  getExecutionIdFromNodeData,
  getLocatorIdFromNodeData
} from '@/utils/graphTraversalUtil'

const TOOLTIP_VALUE_TYPES = ['asset', 'combo', 'number', 'text'] as const
type TooltipValueType = (typeof TOOLTIP_VALUE_TYPES)[number]
function isTooltipValueType(val: unknown): val is TooltipValueType {
  return TOOLTIP_VALUE_TYPES.includes(val as TooltipValueType)
}

interface ProcessedWidget {
  advanced: boolean
  handleContextMenu: (e: PointerEvent) => void
  hasLayoutSize: boolean
  hasError: boolean
  hidden: boolean
  id: string
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
  getTooltipConfig: (widget: SafeWidgetData, fullVal?: string) => TooltipOptions
  handleNodeRightClick: (e: PointerEvent, nodeId: string) => void
}

interface ComputeProcessedWidgetsOptions {
  nodeData: VueNodeData | undefined
  graphId: string | undefined
  showAdvanced: boolean
  isGraphReady: boolean
  rootGraph: LGraph | null
  ui: WidgetUiCallbacks
}

function createWidgetUpdateHandler(
  widgetState: WidgetState | undefined,
  widget: SafeWidgetData,
  nodeExecId: NodeExecutionId,
  widgetOptions: IWidgetOptions | Record<string, never>,
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>
): (newValue: WidgetValue) => void {
  return (newValue: WidgetValue) => {
    if (widgetState) widgetState.value = newValue
    widget.callback?.(newValue)
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
  widget: SafeWidgetData,
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
  return (
    !!errors?.some((e) => e.extra_info?.input_name === widget.name) ||
    missingModelStore.isWidgetMissingModel(nodeExecId, widget.name)
  )
}

export function getWidgetIdentity(
  widget: SafeWidgetData,
  nodeId: string | number | undefined,
  index: number
): {
  dedupeIdentity?: string
  renderKey: string
} {
  if (widget.widgetId) {
    const dedupeIdentity = `${widget.widgetId}:${widget.type}`
    return { dedupeIdentity, renderKey: dedupeIdentity }
  }
  const hostNodeIdRoot =
    nodeId !== undefined && nodeId !== ''
      ? `node:${String(stripGraphPrefix(nodeId))}`
      : undefined
  const stableIdentityRoot = widget.nodeId
    ? `node:${String(stripGraphPrefix(widget.nodeId))}`
    : widget.sourceExecutionId
      ? `exec:${widget.sourceExecutionId}`
      : hostNodeIdRoot

  const dedupeIdentity = stableIdentityRoot
    ? `${stableIdentityRoot}:${widget.name}:${widget.type}`
    : undefined
  const renderKey =
    dedupeIdentity ??
    `transient:${String(nodeId ?? '')}:${widget.name}:${widget.type}:${index}`
  return { dedupeIdentity, renderKey }
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

export function computeProcessedWidgets({
  nodeData,
  graphId,
  showAdvanced,
  isGraphReady,
  rootGraph,
  ui
}: ComputeProcessedWidgetsOptions): ProcessedWidget[] {
  if (!nodeData?.widgets) return []

  const executionErrorStore = useExecutionErrorStore()
  const missingModelStore = useMissingModelStore()
  const widgetValueStore = useWidgetValueStore()

  const nodeExecId =
    isGraphReady && rootGraph
      ? getExecutionIdFromNodeData(rootGraph, nodeData)
      : createNodeExecutionId([nodeData.id])

  const nodeErrors = executionErrorStore.lastNodeErrors?.[nodeExecId]

  const nodeId = nodeData.id
  const { widgets } = nodeData
  const result: ProcessedWidget[] = []
  const uniqueWidgets: Array<{
    widget: SafeWidgetData
    identity: ReturnType<typeof getWidgetIdentity>
    mergedOptions: IWidgetOptions
    widgetState: WidgetState | undefined
    isVisible: boolean
  }> = []
  const dedupeIndexByIdentity = new Map<string, number>()

  for (const [index, widget] of widgets.entries()) {
    if (!shouldRenderAsVue(widget)) continue

    const identity = getWidgetIdentity(widget, nodeId, index)
    const widgetState = widget.widgetId
      ? widgetValueStore.getWidget(widget.widgetId)
      : graphId
        ? widgetValueStore.getWidget(
            widgetId(
              graphId,
              String(stripGraphPrefix(widget.nodeId ?? nodeId ?? '')),
              widget.name
            )
          )
        : undefined
    const mergedOptions: IWidgetOptions = {
      ...(widget.options ?? {}),
      ...(widgetState?.options ?? {})
    }
    const visible = isWidgetVisible(
      mergedOptions,
      showAdvanced,
      widget.slotMetadata?.linked
    )
    if (!identity.dedupeIdentity) {
      uniqueWidgets.push({
        widget,
        identity,
        mergedOptions,
        widgetState,
        isVisible: visible
      })
      continue
    }

    const existingIndex = dedupeIndexByIdentity.get(identity.dedupeIdentity)
    if (existingIndex === undefined) {
      dedupeIndexByIdentity.set(identity.dedupeIdentity, uniqueWidgets.length)
      uniqueWidgets.push({
        widget,
        identity,
        mergedOptions,
        widgetState,
        isVisible: visible
      })
      continue
    }

    const existingWidget = uniqueWidgets[existingIndex]
    if (existingWidget && !existingWidget.isVisible && visible) {
      uniqueWidgets[existingIndex] = {
        widget,
        identity,
        mergedOptions,
        widgetState,
        isVisible: true
      }
    }
  }

  for (const {
    widget,
    mergedOptions,
    widgetState,
    isVisible: visible,
    identity: { renderKey }
  } of uniqueWidgets) {
    const bareWidgetId = String(stripGraphPrefix(widget.nodeId ?? nodeId ?? ''))

    const vueComponent =
      getComponent(widget.type) ||
      (widget.isDOMWidget ? WidgetDOM : WidgetLegacy)

    const { slotMetadata } = widget

    const value = widgetState?.value as WidgetValue

    const isDisabled = slotMetadata?.linked || widgetState?.disabled
    const widgetOptions = isDisabled
      ? { ...mergedOptions, disabled: true }
      : mergedOptions

    const borderStyle = mergedOptions.advanced
      ? 'ring ring-component-node-widget-advanced'
      : undefined

    const linkedUpstream: LinkedUpstreamInfo | undefined =
      slotMetadata?.linked && slotMetadata.originNodeId
        ? {
            nodeId: slotMetadata.originNodeId,
            outputName: slotMetadata.originOutputName
          }
        : undefined

    const nodeLocatorId = nodeData
      ? getLocatorIdFromNodeData({
          ...nodeData,
          id: widget.nodeId ?? nodeData.id
        })
      : undefined

    const simplified: SimplifiedWidget = {
      name: widgetState?.name ?? widget.name,
      type: widget.type,
      value,
      borderStyle,
      callback: widget.callback,
      controlWidget: widget.controlWidget,
      label: widgetState?.label,
      linkedUpstream,
      nodeLocatorId,
      options: widgetOptions,
      spec: widget.spec
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
      if (nodeId !== undefined) ui.handleNodeRightClick(e, String(nodeId))
      showNodeOptions(
        e,
        widget.name,
        widget.nodeId !== undefined
          ? String(stripGraphPrefix(widget.nodeId))
          : undefined
      )
    }

    result.push({
      advanced: mergedOptions.advanced ?? false,
      handleContextMenu,
      hasLayoutSize: widget.hasLayoutSize ?? false,
      hasError: hasWidgetError(
        widget,
        nodeExecId,
        nodeErrors,
        executionErrorStore,
        missingModelStore
      ),
      hidden: mergedOptions.hidden ?? false,
      id: String(bareWidgetId),
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
      slotMetadata
    })
  }

  return result
}

export function useProcessedWidgets(
  nodeDataGetter: () => VueNodeData | undefined
) {
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  const nodeOutputStore = useNodeOutputStore()
  const widgetValueStore = useWidgetValueStore()
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

  const loadVideoHasPreview = computed(() => {
    const nodeData = nodeDataGetter()
    if (nodeData?.type !== 'LoadVideo') return false
    const node = app.canvas.graph?.getNodeById(nodeData.id)
    if (!node) return false

    void nodeOutputStore.nodeOutputs
    void nodeOutputStore.nodePreviewImages
    const graphId = canvasStore.canvas?.graph?.rootGraph.id
    if (graphId) {
      void widgetValueStore.getWidget(widgetId(graphId, nodeData.id, 'file'))
        ?.value
    }

    return nodeHasLoadVideoPreview(node)
  })

  const loadVideoTrimFillsSpace = computed(
    () => nodeType.value === 'LoadVideo' && !loadVideoHasPreview.value
  )

  function widgetGridRow(widget: ProcessedWidget) {
    if (
      widget.type === 'videotrim' &&
      nodeType.value === 'LoadVideo' &&
      !loadVideoHasPreview.value
    ) {
      return 'minmax(0, 1fr)'
    }
    if (shouldExpand(widget.type) || widget.hasLayoutSize) return 'auto'
    return 'min-content'
  }

  const gridTemplateRows = computed((): string =>
    visibleWidgets.value.map(widgetGridRow).join(' ')
  )

  const hasExpandingRows = computed(() =>
    visibleWidgets.value.some(
      (widget) => widgetGridRow(widget) !== 'min-content'
    )
  )

  return {
    canSelectInputs,
    gridTemplateRows,
    hasExpandingRows,
    loadVideoTrimFillsSpace,
    nodeType,
    processedWidgets,
    visibleWidgets
  }
}
