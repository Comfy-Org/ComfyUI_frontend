import type { TooltipOptions } from 'primevue'
import { computed } from 'vue'
import type { Component } from 'vue'

import type {
  SafeWidgetData,
  VueNodeData,
  WidgetSlotMetadata
} from '@/composables/graph/useGraphNodeManager'
import { useAppMode } from '@/composables/useAppMode'
import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { NodeError } from '@/schemas/apiSchema'
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
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@/types/nodeIdentification'
import type { NodeExecutionId, NodeLocatorId } from '@/types/nodeIdentification'
import type { NodeId } from '@/types/nodeId'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'
import type { WidgetState } from '@/types/widgetState'
import { hasErrorForSlot } from '@/utils/executionErrorUtil'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type {
  LinkedUpstreamInfo,
  SimplifiedWidget,
  WidgetValue
} from '@/types/simplifiedWidget'
import { getExecutionIdFromNodeData } from '@/utils/graphTraversalUtil'

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
  getTooltipConfig: (widget: SafeWidgetData, fullVal?: string) => TooltipOptions
  handleNodeRightClick: (e: PointerEvent, nodeId: NodeId) => void
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
  nodeErrors: Pick<NodeError, 'errors'> | undefined,
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>,
  missingModelStore: ReturnType<typeof useMissingModelStore>
): boolean {
  const errors = widget.sourceExecutionId
    ? executionErrorStore.lastNodeErrors?.[widget.sourceExecutionId]?.errors
    : nodeErrors?.errors
  // Raw interior errors name the source widget, not the boundary name
  const errorInputName = widget.sourceExecutionId
    ? (widget.sourceWidgetName ?? widget.name)
    : widget.name
  return (
    (!!errors && hasErrorForSlot(errors, errorInputName)) ||
    missingModelStore.isWidgetMissingModel(nodeExecId, widget.name)
  )
}

export function getWidgetIdentity(
  widget: SafeWidgetData,
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
  const widgetNodeIdRoot = widget.nodeId
    ? stripGraphPrefix(widget.nodeId)
    : null
  const stableIdentityRoot = widgetNodeIdRoot
    ? `node:${widgetNodeIdRoot}`
    : widget.sourceExecutionId
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

  const nodeExecId = getProcessedNodeExecutionId(
    isGraphReady,
    rootGraph,
    nodeData
  )
  if (!nodeExecId) return []

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
    const widgetNodeId = stripGraphPrefix(widget.nodeId ?? nodeId)
    const widgetState = widget.widgetId
      ? widgetValueStore.getWidget(widget.widgetId)
      : graphId && widgetNodeId
        ? widgetValueStore.getWidget(
            widgetId(graphId, widgetNodeId, widget.name)
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
    const bareWidgetId = stripGraphPrefix(widget.nodeId ?? nodeId)

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

    const nodeLocatorId = getWidgetNodeLocatorId(nodeData, bareWidgetId)

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
      if (nodeId !== undefined) ui.handleNodeRightClick(e, nodeId)
      showNodeOptions(
        e,
        widget.name,
        widget.nodeId !== undefined
          ? (stripGraphPrefix(widget.nodeId) ?? undefined)
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
  nodeDataGetter: () => VueNodeData | undefined
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
