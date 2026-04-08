import type { TooltipOptions } from 'primevue'
import { computed, toValue } from 'vue'
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
import type { WidgetState } from '@/stores/widgetValueStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import { usePromotionStore } from '@/stores/promotionStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import type {
  LinkedUpstreamInfo,
  SimplifiedWidget,
  WidgetValue
} from '@/types/simplifiedWidget'
import {
  getExecutionIdFromNodeData,
  getLocatorIdFromNodeData
} from '@/utils/graphTraversalUtil'
import { app } from '@/scripts/app'

export interface ProcessedWidget {
  advanced: boolean
  handleContextMenu: (e: PointerEvent) => void
  hasLayoutSize: boolean
  hasError: boolean
  hidden: boolean
  id: string
  name: string
  renderKey: string
  simplified: SimplifiedWidget
  tooltipConfig: TooltipOptions
  type: string
  updateHandler: (value: WidgetValue) => void
  value: WidgetValue
  vueComponent: Component
  slotMetadata?: WidgetSlotMetadata
}

function createWidgetUpdateHandler(
  widgetState: WidgetState | undefined,
  widget: SafeWidgetData,
  nodeExecId: string,
  widgetOptions: IWidgetOptions | Record<string, never>,
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>
): (newValue: WidgetValue) => void {
  return (newValue: WidgetValue) => {
    if (widgetState) widgetState.value = newValue
    widget.callback?.(newValue)
    const effectiveExecId = widget.sourceExecutionId ?? nodeExecId
    executionErrorStore.clearWidgetRelatedErrors(
      effectiveExecId,
      widget.slotName ?? widget.name,
      widget.name,
      newValue,
      { min: widgetOptions?.min, max: widgetOptions?.max }
    )
  }
}

export function hasWidgetError(
  widget: SafeWidgetData,
  nodeExecId: string,
  nodeErrors:
    | { errors: { extra_info?: { input_name?: string } }[] }
    | undefined,
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>,
  missingModelStore: ReturnType<typeof useMissingModelStore>
): boolean {
  const errors = widget.sourceExecutionId
    ? executionErrorStore.lastNodeErrors?.[widget.sourceExecutionId]?.errors
    : nodeErrors?.errors
  const inputName = widget.slotName ?? widget.name
  return (
    !!errors?.some((e) => e.extra_info?.input_name === inputName) ||
    missingModelStore.isWidgetMissingModel(
      widget.sourceExecutionId ?? nodeExecId,
      widget.name
    )
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
  const rawWidgetId = widget.storeNodeId ?? widget.nodeId
  const storeWidgetName = widget.storeName ?? widget.name
  const slotNameForIdentity = widget.slotName ?? widget.name
  const stableIdentityRoot = rawWidgetId
    ? `node:${String(stripGraphPrefix(rawWidgetId))}`
    : widget.sourceExecutionId
      ? `exec:${widget.sourceExecutionId}`
      : undefined

  const dedupeIdentity = stableIdentityRoot
    ? `${stableIdentityRoot}:${storeWidgetName}:${slotNameForIdentity}:${widget.type}`
    : undefined
  const renderKey =
    dedupeIdentity ??
    `transient:${String(nodeId ?? '')}:${storeWidgetName}:${slotNameForIdentity}:${widget.type}:${index}`

  return {
    dedupeIdentity,
    renderKey
  }
}

export function isWidgetVisible(
  options: IWidgetOptions,
  showAdvanced: boolean
): boolean {
  const hidden = options.hidden ?? false
  const advanced = options.advanced ?? false
  return !hidden && (!advanced || showAdvanced)
}

export function computeProcessedWidgets(
  nodeData: VueNodeData | undefined,
  graphId: string | undefined,
  showAdvanced: boolean,
  promotionStore: ReturnType<typeof usePromotionStore>,
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>,
  missingModelStore: ReturnType<typeof useMissingModelStore>,
  widgetValueStore: ReturnType<typeof useWidgetValueStore>,
  getWidgetTooltip: (widget: SafeWidgetData) => string,
  createTooltipConfig: (text: string) => TooltipOptions,
  handleNodeRightClick: (e: PointerEvent, nodeId: string) => void
): ProcessedWidget[] {
  if (!nodeData?.widgets) return []

  const nodeExecId = app.isGraphReady
    ? getExecutionIdFromNodeData(app.rootGraph, nodeData)
    : String(nodeData.id ?? '')

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
    const storeWidgetName = widget.storeName ?? widget.name
    const bareWidgetId = String(
      stripGraphPrefix(widget.storeNodeId ?? widget.nodeId ?? nodeId ?? '')
    )
    const widgetState = graphId
      ? widgetValueStore.getWidget(graphId, bareWidgetId, storeWidgetName)
      : undefined
    const mergedOptions: IWidgetOptions = {
      ...(widget.options ?? {}),
      ...(widgetState?.options ?? {})
    }
    const visible = isWidgetVisible(mergedOptions, showAdvanced)
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
    identity: { renderKey }
  } of uniqueWidgets) {
    const hostNodeId = String(nodeId ?? '')
    const bareWidgetId = String(
      stripGraphPrefix(widget.storeNodeId ?? widget.nodeId ?? nodeId ?? '')
    )
    const promotionSourceNodeId = widget.storeName
      ? String(bareWidgetId)
      : undefined

    const vueComponent =
      getComponent(widget.type) ||
      (widget.isDOMWidget ? WidgetDOM : WidgetLegacy)

    const { slotMetadata } = widget

    const value = widgetState?.value as WidgetValue

    const isDisabled = slotMetadata?.linked || widgetState?.disabled
    const widgetOptions = isDisabled
      ? { ...mergedOptions, disabled: true }
      : mergedOptions

    const borderStyle =
      graphId &&
      promotionStore.isPromotedByAny(graphId, {
        sourceNodeId: hostNodeId,
        sourceWidgetName: widget.storeName ?? widget.name,
        disambiguatingSourceNodeId: promotionSourceNodeId
      })
        ? 'ring ring-component-node-widget-promoted'
        : mergedOptions.advanced
          ? 'ring ring-component-node-widget-advanced'
          : undefined

    const linkedUpstream: LinkedUpstreamInfo | undefined =
      slotMetadata?.linked && slotMetadata.originNodeId
        ? {
            nodeId: slotMetadata.originNodeId,
            outputName: slotMetadata.originOutputName
          }
        : undefined

    const nodeLocatorId = widget.nodeId
      ? widget.nodeId
      : nodeData
        ? getLocatorIdFromNodeData(nodeData)
        : undefined

    const simplified: SimplifiedWidget = {
      name: widget.name,
      type: widget.type,
      value,
      borderStyle,
      callback: widget.callback,
      controlWidget: widget.controlWidget,
      label: widget.promotedLabel ?? widgetState?.label,
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

    const tooltipText = getWidgetTooltip(widget)
    const tooltipConfig = createTooltipConfig(tooltipText)
    const handleContextMenu = (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      handleNodeRightClick(e, nodeId)
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
      name: widget.name,
      renderKey,
      type: widget.type,
      vueComponent,
      simplified,
      value,
      updateHandler,
      tooltipConfig,
      slotMetadata
    })
  }

  return result
}

export function useProcessedWidgets(nodeData: VueNodeData | undefined) {
  const canvasStore = useCanvasStore()
  const promotionStore = usePromotionStore()
  const executionErrorStore = useExecutionErrorStore()
  const missingModelStore = useMissingModelStore()
  const widgetValueStore = useWidgetValueStore()
  const settingStore = useSettingStore()
  const { isSelectInputsMode } = useAppMode()
  const { handleNodeRightClick } = useNodeEventHandlers()

  const nodeType = computed(() => nodeData?.type || '')
  const { getWidgetTooltip, createTooltipConfig } = useNodeTooltips(
    nodeType.value
  )

  const showAdvanced = computed(
    () =>
      nodeData?.showAdvanced ||
      settingStore.get('Comfy.Node.AlwaysShowAdvancedWidgets')
  )

  const canSelectInputs = computed(
    () =>
      isSelectInputsMode.value &&
      nodeData?.mode === LGraphEventMode.ALWAYS &&
      nodeTypeValidForApp(nodeData.type) &&
      !nodeData.hasErrors
  )

  const processedWidgets = computed((): ProcessedWidget[] => {
    const graphId = canvasStore.canvas?.graph?.rootGraph.id
    return computeProcessedWidgets(
      nodeData,
      graphId,
      showAdvanced.value,
      promotionStore,
      executionErrorStore,
      missingModelStore,
      widgetValueStore,
      getWidgetTooltip,
      createTooltipConfig,
      handleNodeRightClick
    )
  })

  const gridTemplateRows = computed((): string =>
    toValue(processedWidgets)
      .filter((w) => !w.hidden && (!w.advanced || showAdvanced.value))
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
    showAdvanced
  }
}
