import { computed } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
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
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
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
import {
  executionIdToNodeLocatorId,
  getExecutionIdFromNodeData
} from '@/utils/graphTraversalUtil'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ProcessedWidget,
  WidgetUiCallbacks
} from '@/renderer/extensions/vueNodes/composables/processedWidgetRenderModel'
import { computeProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/processedWidgetRenderModel'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { nodeHasError } from '@/renderer/extensions/vueNodes/utils/nodeErrorState'
import { app } from '@/scripts/app'
import { nodeTypeValidForApp } from '@/stores/appModeStore'
import type { NodeState } from '@/types/nodeState'
import type { WidgetId } from '@/types/widgetId'
import {
  getNodeByLocatorId,
  locatorIdFromState
} from '@/utils/graphTraversalUtil'

export { computeProcessedWidgets }
export type { ProcessedWidget }

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
  forceDisabled?: boolean
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
  bareWidgetId: NodeId | null,
  sourceExecutionId: NodeExecutionId | undefined,
  rootGraph: LGraph | null
): NodeLocatorId | undefined {
  if (sourceExecutionId && rootGraph) {
    const sourceLocator = executionIdToNodeLocatorId(
      rootGraph,
      sourceExecutionId
    )
    if (sourceLocator) return sourceLocator
  }

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
  ui,
  forceDisabled = false
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

    const isDisabled =
      forceDisabled || slotMetadata?.linked || widgetState?.disabled
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

    const nodeLocatorId = getWidgetNodeLocatorId(
      nodeData,
      bareWidgetId,
      widget.sourceExecutionId,
      rootGraph
    )

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
  nodeDataGetter: () => NodeState | undefined,
  widgetIdsGetter: () => readonly WidgetId[] | undefined = () => undefined
) {
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  const { isSelectInputsMode } = useAppMode()
  const { handleNodeRightClick } = useNodeEventHandlers()
  const agentNodeSelectionStore = useAgentNodeSelectionStore()

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
    return (
      isSelectInputsMode.value &&
      nodeData.mode === LGraphEventMode.ALWAYS &&
      nodeTypeValidForApp(nodeData.type) &&
      !nodeHasError(nodeData, canvasStore.rootGraphId, getHostNode(nodeData))
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
      ui,
      forceDisabled: agentNodeSelectionStore.isActive
    })
  )

  return {
    canSelectInputs,
    nodeType,
    processedWidgets
  }
}
