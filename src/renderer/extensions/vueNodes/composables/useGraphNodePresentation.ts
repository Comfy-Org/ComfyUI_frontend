import { storeToRefs } from 'pinia'
import { computed, toValue } from 'vue'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { useAppMode } from '@/composables/useAppMode'
import { LGraphEventMode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'
import { usePartitionedBadges } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import { useNodeExecutionState } from '@/renderer/extensions/vueNodes/execution/useNodeExecutionState'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'
import { useNodePreviewState } from '@/renderer/extensions/vueNodes/preview/useNodePreviewState'
import { nonWidgetedInputs } from '@/renderer/extensions/vueNodes/utils/nodeDataUtils'
import { getNodeErrorSeverity } from '@/renderer/extensions/vueNodes/utils/nodeErrorState'
import { app } from '@/scripts/app'
import { isNodeEmphasized } from '@/systems/nodeEmphasisSystem'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import {
  getNodeByLocatorId,
  locatorIdFromState
} from '@/utils/graphTraversalUtil'
import { cn } from '@comfyorg/tailwind-utils'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'
import { IMAGE_PREVIEW_HEIGHT_RESERVE } from '@/renderer/extensions/vueNodes/components/imagePreviewLayout'
import type { MaybeRefOrGetter } from 'vue'
import { useGraphNodeActions } from './useGraphNodeActions'
import { useGraphNodeWidgets } from './useGraphNodeWidgets'
import { useNodeShape } from './useNodeShape'
import { RESIZE_HANDLES } from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'

export function useGraphNodePresentation(
  nodeSource: MaybeRefOrGetter<NodeState>
) {
  const nodeData = computed(() => toValue(nodeSource))

  const { isSelectMode, isSelectOutputsMode } = useAppMode()

  const settingStore = useSettingStore()

  const nodeId = computed(() => nodeData.value.id)

  useVueElementTracking(nodeId.value, 'node')

  const canvasStore = useCanvasStore()

  const { isGhostPlacing } = storeToRefs(useCanvasStore())

  const isEmphasized = computed(() => {
    const graph = canvasStore.currentGraph
    return isNodeEmphasized(
      graph ? graphScopeOf(graph) : undefined,
      nodeId.value
    )
  })

  const nodeLocatorId = computed(
    () =>
      locatorIdFromState(nodeData.value, canvasStore.rootGraphId) ?? undefined
  )

  const { executing, progress } = useNodeExecutionState(nodeLocatorId)

  const errorSeverity = computed(() =>
    getNodeErrorSeverity(
      nodeData.value,
      canvasStore.rootGraphId,
      lgraphNode.value
    )
  )

  const hasAnyError = computed(() => errorSeverity.value !== 'none')

  const showErrorsTabEnabled = computed(() =>
    settingStore.get('Comfy.RightSidePanel.ShowErrorsTab')
  )

  const isRerouteNode = computed(() => nodeData.value.type === 'Reroute')

  const isCollapsed = computed(() => nodeData.value.flags.collapsed ?? false)
  const bodyKind = computed(() =>
    isCollapsed.value ? 'hidden' : isRerouteNode.value ? 'reroute' : 'node'
  )

  const bypassed = computed(
    (): boolean => nodeData.value.mode === LGraphEventMode.BYPASS
  )

  const muted = computed(
    (): boolean => nodeData.value.mode === LGraphEventMode.NEVER
  )

  const nodeOpacity = computed(() => {
    const globalOpacity = settingStore.get('Comfy.Node.Opacity')

    if (nodeData.value.flags.ghost) return globalOpacity * 0.6
    if (bypassed.value || muted.value) {
      return globalOpacity * 0.5
    }

    return globalOpacity
  })

  const hasInputs = computed(
    () => nonWidgetedInputs(nodeData.value.inputs).length > 0
  )

  const { handleWheel, shouldHandleNodePointerEvents } = useCanvasInteractions()

  const { position, size, zIndex } = useNodeLayout(() => nodeData.value.id)

  const imagePreviewGrowth = computed(() =>
    nodeMedia.value?.type === 'image' && hasExpandingWidget.value
      ? IMAGE_PREVIEW_HEIGHT_RESERVE
      : 0
  )

  const nodeSizeStyle = computed(() =>
    isCollapsed.value
      ? {}
      : {
          '--node-width': `${size.value.width}px`,
          '--node-height': `${size.value.height + LiteGraph.NODE_TITLE_HEIGHT + imagePreviewGrowth.value}px`
        }
  )

  const { pointerHandlers } = useNodePointerInteractions(() => nodeData.value)

  const badges = usePartitionedBadges(nodeData.value)

  const progressClasses = 'h-2 bg-primary transition-all duration-300'

  const { latestPreviewUrl, shouldShowPreviewImg } = useNodePreviewState(
    () => nodeData.value.id,
    {
      isCollapsed
    }
  )

  const cursorClass = computed(() => {
    if (nodeData.value.flags.pinned) return 'cursor-default'
    return layoutStore.isDraggingVueNodes.value
      ? 'cursor-grabbing'
      : 'cursor-grab'
  })

  const {
    displayHeader,
    bodyRoundingClass,
    shapeClass,
    isTransparentHeaderless,
    selectionShapeClass,
    overlayClass
  } = useNodeShape(nodeData, hasAnyError)

  function resolveLGraphNode() {
    const locatorId = nodeLocatorId.value
    if (!locatorId) return null

    return getNodeByLocatorId(app.rootGraph, locatorId)
  }

  const lgraphNode = computed(resolveLGraphNode)

  const {
    promotedPreviews,
    hasRenderableWidgets,
    processedWidgetModel,
    hasExpandingWidget,
    showAdvancedInputsButton,
    nodeMedia
  } = useGraphNodeWidgets(nodeData, lgraphNode, nodeLocatorId)

  const actions = useGraphNodeActions(nodeData, {
    node: lgraphNode,
    collapsed: isCollapsed,
    imagePreviewGrowth,
    interactive: shouldHandleNodePointerEvents
  })
  const { isDraggingOver } = actions

  const badgesStyle = computed(() => ({
    marginBottom: `${4 + (hasAnyError.value || isDraggingOver.value ? 4 : 0) + (isEmphasized.value || executing.value ? 3 : 0)}px`
  }))

  const rootClass = computed(() =>
    cn(
      isRerouteNode.value
        ? 'h-(--node-height)'
        : 'min-h-(--node-height) min-w-(--min-node-width)',
      cursorClass.value,
      shouldHandleNodePointerEvents.value &&
        !nodeData.value.flags.ghost &&
        !isGhostPlacing.value
        ? 'pointer-events-auto'
        : 'pointer-events-none'
    )
  )

  const containerClass = computed(() =>
    cn(
      !isRerouteNode.value && 'min-w-(--min-node-width)',
      shapeClass.value,
      hasAnyError.value && 'ring-4',
      errorSeverity.value === 'missing' && 'ring-warning',
      errorSeverity.value === 'error' && 'ring-destructive',
      (bypassed.value || muted.value) && overlayClass.value,
      bypassed.value && 'before:bg-bypass/60',
      isDraggingOver.value && 'bg-primary/10 ring-4 ring-primary'
    )
  )

  const outlineClass = computed(() =>
    cn(
      'pointer-events-none absolute z-0 outline-offset-2 group-focus-visible/node:block group-focus-visible/node:[outline-style:auto]',
      selectionShapeClass.value,
      hasAnyError.value ? '-inset-1.75' : '-inset-0.75',
      isEmphasized.value || executing.value ? 'block border-3' : 'hidden',
      isEmphasized.value
        ? 'border-foreground'
        : executing.value && 'border-primary'
    )
  )

  const showAppOutput = computed(
    () =>
      lgraphNode.value?.constructor.nodeData?.output_node &&
      isSelectOutputsMode.value &&
      nodeData.value.mode === LGraphEventMode.ALWAYS &&
      !hasAnyError.value
  )

  const resizeHandles = computed(() =>
    !isCollapsed.value &&
    !isRerouteNode.value &&
    nodeData.value.resizable !== false &&
    !isSelectMode.value
      ? RESIZE_HANDLES
      : []
  )

  const nodeStyle = computed(() => ({
    ...nodeSizeStyle.value,
    '--min-node-width': `${MIN_NODE_WIDTH}px`,
    transform: `translate(${position.value.x}px, ${position.value.y - LiteGraph.NODE_TITLE_HEIGHT}px)`,
    zIndex: zIndex.value,
    opacity: nodeOpacity.value
  }))

  const previewUrl = computed(() =>
    shouldShowPreviewImg.value && !isSubgraph.value
      ? latestPreviewUrl.value
      : undefined
  )

  const isSubgraph = computed(() => !!lgraphNode.value?.isSubgraphNode())
  const subgraphAction = computed<'enter' | undefined>(() =>
    isSubgraph.value ? 'enter' : undefined
  )

  const visibleProgress = computed(() =>
    executing.value ? progress.value : undefined
  )

  const showBadges = computed(
    () => !isRerouteNode.value && !isTransparentHeaderless.value
  )

  const showMissingWarning = computed(
    () => errorSeverity.value === 'missing' && !showErrorsTabEnabled.value
  )

  const nodeAttributes = computed(() => ({
    'data-node-id': nodeData.value.id,
    'data-collapsed': isCollapsed.value || undefined,
    'data-emphasized': isEmphasized.value || undefined,
    'data-ghost': nodeData.value.flags.ghost || undefined
  }))

  const hasCustomContent = computed(
    () => promotedPreviews.value.length > 0 || !!nodeMedia.value?.urls.length
  )
  const mediaClass = computed(() =>
    cn(
      'flex min-h-0 flex-col',
      nodeMedia.value?.type === 'image' && hasExpandingWidget.value
        ? 'shrink-0'
        : 'flex-1'
    )
  )
  const bodyProgressClass = computed(() =>
    cn(
      'absolute inset-x-0 top-1/2 -translate-y-1/2',
      progress.value !== undefined && progress.value < 1 && 'rounded-r-full',
      progressClasses
    )
  )
  const progressStyle = computed(() => ({
    width: `${Math.min((progress.value ?? 0) * 100, 100)}%`
  }))
  return {
    handleWheel,
    nodeAttributes,
    pointerHandlers,
    rootClass,
    nodeStyle,
    isGhostPlacing,
    containerClass,
    showBadges,
    badges,
    badgesStyle,
    showAppOutput,
    nodeId,
    outlineClass,
    displayHeader,
    isCollapsed,
    hasInputs,
    showMissingWarning,
    visibleProgress,
    progressClasses,
    hasRenderableWidgets,
    processedWidgetModel,
    bodyRoundingClass,
    nodeMedia,
    promotedPreviews,
    mediaClass,
    bodyProgressClass,
    progressStyle,
    previewUrl,
    isRerouteNode,
    bodyKind,
    subgraphAction,
    errorSeverity,
    showErrorsTabEnabled,
    showAdvancedInputsButton,
    resizeHandles,
    hasCustomContent,
    ...actions
  }
}
