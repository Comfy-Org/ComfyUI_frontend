import { computed } from 'vue'

import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { autogrowInputRole } from '@/core/graph/widgets/dynamicWidgets'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import type {
  WidgetGridItem,
  WidgetSlotMetadata
} from '@/renderer/extensions/vueNodes/types/widgetGrid'
import WidgetDOM from '@/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import { getComponent } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import {
  buildSlotMetadata,
  createSlotMetadata
} from '@/renderer/extensions/vueNodes/widgets/widgetSlotMetadata'
import {
  setWidgetValue,
  widgetErrorTarget,
  widgetSpec
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import type { WidgetErrorTarget } from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import { withTextareaFloor } from '@/renderer/extensions/vueNodes/widgets/textareaFloor'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import type { WidgetRenderState } from '@/stores/widgetValueStore'
import { createNodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
import type { NodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { isWidgetVisibleOnSurface } from '@/types/widgetVisibility'
import type { WidgetVisibilityComponent } from '@/types/widgetVisibility'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import {
  executionIdFromState,
  getNodeByState
} from '@/utils/graphTraversalUtil'

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
  hasError: boolean
  tooltipText: string
  updateHandler: (value: WidgetValue) => void
  widgetId: WidgetId
}

export interface WidgetUiCallbacks {
  getTooltipText: (widget: WidgetTooltipSource, fullValue?: string) => string
  handleNodeRightClick?: (e: PointerEvent, nodeId: NodeId) => void
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

function getHostNode(
  rootGraph: LGraph | null,
  nodeData: NodeState
): LGraphNode | null {
  if (!rootGraph) return null
  return getNodeByState(rootGraph, nodeData)
}

function isWidgetVisible(
  visibility: WidgetVisibilityComponent | undefined,
  showAdvanced: boolean,
  ignoreAdvanced = false
): boolean {
  if (!visibility) return true
  return isWidgetVisibleOnSurface(visibility, 'vueNode', {
    showAdvanced: showAdvanced || ignoreAdvanced
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

interface WidgetProcessingContext {
  nodeData: NodeState
  showAdvanced: boolean
  slotMetadata: Map<string, WidgetSlotMetadata>
  nodeExecId: NodeExecutionId | null
  nodeErrors: Parameters<typeof hasWidgetError>[2]
  widgetValueStore: ReturnType<typeof useWidgetValueStore>
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>
  missingModelStore: ReturnType<typeof useMissingModelStore>
  missingMediaStore: ReturnType<typeof useMissingMediaStore>
  ui: WidgetUiCallbacks
}

function resolveWidgetComponent(
  type: string,
  renderState: WidgetRenderState
): ProcessedWidget['vueComponent'] {
  if (renderState.renderer === 'dom') return WidgetDOM
  if (renderState.renderer === 'legacy') return WidgetLegacy
  return (
    getComponent(type) || (renderState.isDOMWidget ? WidgetDOM : WidgetLegacy)
  )
}

function widgetTooltipFullValue(type: string, value: WidgetValue) {
  return isTooltipValueType(type) && String(value).length > 10
    ? String(value)
    : undefined
}

function widgetContextMenu(
  ctx: WidgetProcessingContext,
  widgetName: string
): ((e: PointerEvent) => void) | undefined {
  const { handleNodeRightClick } = ctx.ui
  if (!handleNodeRightClick) return undefined
  return (e) => {
    e.preventDefault()
    e.stopPropagation()
    handleNodeRightClick(e, ctx.nodeData.id)
    showNodeOptions(e, { nodeId: ctx.nodeData.id, widgetName })
  }
}

function processWidget(
  id: WidgetId,
  ctx: WidgetProcessingContext
): ProcessedWidget | null {
  const widgetState = ctx.widgetValueStore.getWidget(id)
  if (!widgetState?.type) return null
  const { name, type } = widgetState
  const slotInfo = ctx.slotMetadata.get(name)
  const renderState: WidgetRenderState =
    ctx.widgetValueStore.getWidgetRenderState(id) ?? {}
  const errorTarget = widgetErrorTarget(id, renderState)
  const visibility = ctx.widgetValueStore.getWidgetVisibility(id)

  const tooltipText = computed(() =>
    ctx.ui.getTooltipText(
      { name, tooltip: renderState.tooltip },
      widgetTooltipFullValue(type, widgetState.value)
    )
  )

  const error = computed(() =>
    hasWidgetError(
      { name, errorTarget },
      ctx.nodeExecId,
      ctx.nodeErrors,
      ctx.executionErrorStore,
      ctx.missingModelStore,
      ctx.missingMediaStore
    )
  )

  const vueComponent = resolveWidgetComponent(type, renderState)
  const rendersTextarea = vueComponent === getComponent('textarea')

  return {
    handleContextMenu: widgetContextMenu(ctx, name),
    get sizing() {
      return rendersTextarea
        ? withTextareaFloor(renderState.sizing)
        : renderState.sizing
    },
    get hasError() {
      return error.value
    },
    widgetId: id,
    renderKey: `${id}:${type}`,
    vueComponent,
    name,
    type,
    get value() {
      return widgetState.value
    },
    label: widgetState.label,
    disabled:
      widgetState.disabled || slotInfo?.linked
        ? true
        : widgetState.options.disabled,
    spec: widgetSpec(id, renderState, ctx.nodeData.type),
    visible: isWidgetVisible(
      visibility,
      ctx.showAdvanced,
      slotInfo?.linked || slotInfo?.promoted
    ),
    suppressedByConnection: visibility?.suppression.byConnection ?? false,
    updateHandler: (next) => setWidgetValue(id, next),
    get tooltipText() {
      return tooltipText.value
    },
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

  const nodeExecId =
    isGraphReady && rootGraph
      ? executionIdFromState(rootGraph, nodeData)
      : createNodeExecutionId([nodeData.id])

  const hostNode = getHostNode(rootGraph, nodeData)
  const ids = resolveWidgetIds(
    graphId,
    nodeData.id,
    widgetIds,
    widgetValueStore
  )
  const graphRef = hostNode?.graph ?? rootGraph
  const slotMetadata = buildSlotMetadata(
    hostNode?.inputs,
    graphRef,
    nodeData.id
  )
  const ctx: WidgetProcessingContext = {
    nodeData,
    showAdvanced,
    slotMetadata,
    nodeExecId,
    nodeErrors: nodeExecId
      ? executionErrorStore.lastNodeErrors?.[nodeExecId]
      : undefined,
    widgetValueStore,
    executionErrorStore,
    missingModelStore,
    missingMediaStore,
    ui
  }

  return Array.from(new Set(ids))
    .map((id) => processWidget(id, ctx))
    .filter((widget): widget is ProcessedWidget => widget !== null)
}

export function computeInputRows(
  nodeData: NodeState | undefined,
  rootGraph: LGraph | null
): WidgetGridItem[] {
  const hostNode = nodeData && getHostNode(rootGraph, nodeData)
  const graphRef = hostNode?.graph
  if (!nodeData || !hostNode || !graphRef) return []
  const linkStore = useLinkStore()
  const scope = graphScopeOf(graphRef)
  return nodeData.inputs.flatMap((input, index) => {
    const role = autogrowInputRole(hostNode, input)
    if (!role) return []
    const link = linkStore.getInputSlotLink(scope, nodeData.id, index)
    return [
      {
        inputRole: role === 'group' ? 'autogrowGroup' : 'socket',
        renderKey: `input:${input.name}`,
        name: input.name,
        label: input.label ?? input.localized_name,
        type: String(input.type),
        value: undefined,
        slotMetadata: createSlotMetadata(input, index, link, graphRef),
        visible: role === 'child'
      }
    ]
  })
}

export function withInputRows(
  widgets: WidgetGridItem[],
  inputRows: WidgetGridItem[]
): WidgetGridItem[] {
  const rows = [...widgets]
  for (const row of inputRows) {
    const index = row.slotMetadata?.index ?? -1
    const next = rows.findIndex((r) => (r.slotMetadata?.index ?? -1) > index)
    rows.splice(next === -1 ? rows.length : next, 0, row)
  }
  return rows
}
