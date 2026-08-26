<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.render', 'Node Render Error') }}
  </div>
  <div
    v-else
    tabindex="0"
    :data-node-id="nodeData.id"
    :data-collapsed="isCollapsed || undefined"
    :data-ghost="nodeData.flags?.ghost || undefined"
    :class="
      cn(
        'group/node lg-node absolute isolate text-xs',
        'flex flex-col contain-layout contain-style',
        isLightTheme
          ? 'drop-shadow-md drop-shadow-black/15'
          : 'drop-shadow-xl drop-shadow-black/40',
        isRerouteNode
          ? 'h-(--node-height)'
          : 'min-h-(--node-height) min-w-(--min-node-width)',
        cursorClass,
        isSelected && 'outline-node-component-outline',
        executing && 'outline-node-stroke-executing',
        shouldHandleNodePointerEvents &&
          !nodeData.flags?.ghost &&
          !isGhostPlacing
          ? 'pointer-events-auto'
          : 'pointer-events-none'
      )
    "
    :style="{
      ...nodeSizeStyle,
      '--min-node-width': `${MIN_NODE_WIDTH}px`,
      transform: `translate(${position.x ?? 0}px, ${(position.y ?? 0) - LiteGraph.NODE_TITLE_HEIGHT}px)`,
      zIndex: zIndex,
      opacity: nodeOpacity
    }"
    :inert="isGhostPlacing"
    v-bind="remainingPointerHandlers"
    @pointerdown="nodeOnPointerdown"
    @wheel="handleWheel"
    @contextmenu="handleContextMenu"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <AppOutput
      v-if="
        lgraphNode?.constructor?.nodeData?.output_node &&
        isSelectOutputsMode &&
        nodeData.mode === LGraphEventMode.ALWAYS &&
        !hasAnyError
      "
      :id="nodeId"
    />
    <div
      v-if="isSelected || executing"
      data-testid="node-state-outline-overlay"
      :class="
        cn(
          'pointer-events-none absolute z-0 border-3 outline-none',
          selectionShapeClass,
          hasAnyError ? '-inset-1.75' : '-inset-0.75',
          isSelected
            ? 'border-node-component-outline'
            : 'border-node-stroke-executing'
        )
      "
    />
    <div
      data-testid="node-inner-wrapper"
      :class="
        cn(
          'flex flex-1 flex-col bg-node-component-header-surface',
          'w-(--node-width)',
          !isRerouteNode && 'min-w-(--min-node-width)',
          shapeClass,
          hasAnyError && 'ring-4 ring-destructive-background',
          bypassed && bypassOverlayClass,
          muted && mutedOverlayClass,
          isDraggingOver && 'bg-primary-500/10 ring-4 ring-primary-500'
        )
      "
      :style="{
        '--component-node-background': applyLightThemeColor(nodeData.bgcolor),
        backgroundColor: applyLightThemeColor(nodeData?.color)
      }"
    >
      <div
        v-if="displayHeader"
        class="relative flex flex-col items-center justify-center"
      >
        <template v-if="isCollapsed">
          <SlotConnectionDot
            v-if="hasInputs"
            multi
            class="absolute left-0 -translate-x-1/2"
          />
          <SlotConnectionDot
            v-if="nodeData.outputs.length"
            multi
            class="absolute right-0 translate-x-1/2"
          />
          <NodeSlots :node-data unified />
        </template>
        <NodeHeader
          :node-data
          :collapsed="isCollapsed"
          :price-badges="badges.pricing"
          @collapse="handleCollapse"
          @update:title="handleHeaderTitleUpdate"
        />
      </div>

      <div
        v-if="isCollapsed && executing && progress !== undefined"
        :class="
          cn(
            'absolute inset-x-4 -bottom-px translate-y-1/2 rounded-full',
            progressClasses
          )
        "
        :style="{ width: `${Math.min(progress * 100, 100)}%` }"
      />

      <template v-if="!isCollapsed && isRerouteNode">
        <NodeSlots :node-data />
      </template>

      <template v-else-if="!isCollapsed">
        <div class="relative">
          <div
            v-if="executing && progress !== undefined"
            :class="
              cn(
                'absolute inset-x-0 top-1/2 -translate-y-1/2',
                !!(progress < 1) && 'rounded-r-full',
                progressClasses
              )
            "
            :style="{ width: `${Math.min(progress * 100, 100)}%` }"
          />
        </div>

        <div
          :class="
            cn(
              'flex flex-1 flex-col gap-1 bg-component-node-background pt-1 pb-3',
              bodyRoundingClass
            )
          "
          :data-testid="`node-body-${nodeData.id}`"
        >
          <NodeSlots :node-data />

          <NodeWidgets
            v-if="hasRenderableWidgets"
            :node-data
            :widget-ids="renderedWidgetIds"
          />

          <div v-if="hasCustomContent" class="flex min-h-0 flex-1 flex-col">
            <NodeContent v-if="nodeMedia" :node-data :media="nodeMedia" />
            <NodeContent
              v-for="preview in promotedPreviews"
              :key="`${preview.sourceNodeId}-${preview.sourceWidgetName}`"
              :node-data
              :media="preview"
            />
          </div>
          <LivePreview
            v-if="shouldShowPreviewImg && !lgraphNode?.isSubgraphNode()"
            :image-url="latestPreviewUrl"
          />
          <NodeBadges
            v-if="!isTransparentHeaderless"
            v-bind="badges"
            :pricing="undefined"
            class="mt-auto"
          />
        </div>
      </template>
    </div>
    <NodeFooter
      v-if="!isRerouteNode"
      :is-subgraph="!!lgraphNode?.isSubgraphNode()"
      :has-any-error="hasAnyError"
      :show-errors-tab-enabled="showErrorsTabEnabled"
      :show-advanced-inputs-button="showAdvancedInputsButton"
      :show-advanced-state="!!nodeData.showAdvanced"
      :header-color="applyLightThemeColor(nodeData?.color)"
      :shape="nodeData.shape"
      @enter-subgraph="handleEnterSubgraph"
      @open-errors="handleOpenErrors"
      @toggle-advanced="handleToggleAdvanced"
    />
    <template
      v-if="
        !isCollapsed &&
        !isRerouteNode &&
        nodeData.resizable !== false &&
        !isSelectMode
      "
    >
      <div
        v-for="handle in RESIZE_HANDLES"
        :key="handle.corner"
        role="button"
        :data-corner="handle.corner"
        :aria-label="t(handle.i18nKey)"
        :class="
          cn(
            baseResizeHandleClasses,
            handle.positionClasses,
            handle.cursorClass,
            'group-hover/node:opacity-100'
          )
        "
        @pointerdown.stop="handleResizePointerDown($event, handle.corner)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 12 12"
          :class="cn('absolute size-2/5', handle.svgPositionClasses)"
          :style="
            handle.svgTransform ? { transform: handle.svgTransform } : undefined
          "
        >
          <path
            d="M11 1L1 11M11 6L6 11"
            stroke="var(--color-muted-foreground)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onErrorCaptured, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { NodeState } from '@/types/nodeState'
import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { hasUnpromotedWidgets } from '@/core/graph/subgraph/promotionUtils'
import { st } from '@/i18n'
import type { CompassCorners } from '@/lib/litegraph/src/interfaces'
import {
  LGraphCanvas,
  LGraphEventMode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { TitleMode } from '@/lib/litegraph/src/types/globalEnums'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useGLSLPreview } from '@/renderer/glsl/useGLSLPreview'
import { usePromotedPreviews } from '@/composables/node/usePromotedPreviews'
import NodeBadges from '@/renderer/extensions/vueNodes/components/NodeBadges.vue'
import { LayoutSource } from '@/renderer/core/layout/types'
import { removeNodeTitleHeight } from '@/renderer/core/layout/utils/nodeSizeUtil'
import AppOutput from '@/renderer/extensions/linearMode/AppOutput.vue'
import SlotConnectionDot from '@/renderer/extensions/vueNodes/components/SlotConnectionDot.vue'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { usePartitionedBadges } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import { useNodeExecutionState } from '@/renderer/extensions/vueNodes/execution/useNodeExecutionState'
import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'
import { useNodePreviewState } from '@/renderer/extensions/vueNodes/preview/useNodePreviewState'
import {
  shouldHideLinkedCoreLoadAudioPlayer,
  shouldHideLinkedCoreMediaInputPreview
} from '@/renderer/extensions/vueNodes/utils/linkedCoreMediaUtils'
import { nonWidgetedInputs } from '@/renderer/extensions/vueNodes/utils/nodeDataUtils'
import { nodeHasError } from '@/renderer/extensions/vueNodes/utils/nodeErrorState'
import {
  applyLightThemeColor,
  shapeVariantClass
} from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { isVideoOutput } from '@/utils/litegraphUtil'
import {
  getNodeByLocatorId,
  locatorIdFromState,
  subgraphIdFromState
} from '@/utils/graphTraversalUtil'
import { cn } from '@comfyorg/tailwind-utils'
import { toNodeId } from '@/types/nodeId'
import { isTransparent } from '@/utils/colorUtil'

import { resizeNodeLayout } from '@/renderer/core/layout/operations/graphLayoutAttachment'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'

import { RESIZE_HANDLES } from '../interactions/resize/resizeHandleConfig'
import { useNodeResize } from '../interactions/resize/useNodeResize'
import LivePreview from './LivePreview.vue'
import NodeContent from './NodeContent.vue'
import NodeHeader from './NodeHeader.vue'
import NodeFooter from './NodeFooter.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'

const { nodeData } = defineProps<{
  nodeData: NodeState
}>()

const { t } = useI18n()

const { isSelectMode, isSelectOutputsMode } = useAppMode()
const settingStore = useSettingStore()
const colorPaletteStore = useColorPaletteStore()
const isLightTheme = computed(
  () => !!colorPaletteStore.completedActivePalette.light_theme
)

const { handleNodeCollapse, handleNodeTitleUpdate, handleNodeRightClick } =
  useNodeEventHandlers()
const { bringNodeToFront } = useNodeZIndex()

const nodeId = computed(() => nodeData.id)

useVueElementTracking(nodeId.value, 'node')

const canvasStore = useCanvasStore()

const { selectedNodeIds, isGhostPlacing } = storeToRefs(useCanvasStore())
const isSelected = computed(() => {
  return selectedNodeIds.value.has(nodeId.value)
})

const nodeLocatorId = computed(
  () => locatorIdFromState(nodeData, canvasStore.rootGraphId) ?? undefined
)
const { executing, progress } = useNodeExecutionState(nodeLocatorId)
const hasAnyError = computed(() =>
  nodeHasError(nodeData, canvasStore.rootGraphId, lgraphNode.value)
)

const showErrorsTabEnabled = computed(() =>
  settingStore.get('Comfy.RightSidePanel.ShowErrorsTab')
)

const displayHeader = computed(() => nodeData.titleMode !== TitleMode.NO_TITLE)

const isRerouteNode = computed(() => nodeData.type === 'Reroute')

const isCollapsed = computed(() => nodeData.flags?.collapsed ?? false)
const bypassed = computed(
  (): boolean => nodeData.mode === LGraphEventMode.BYPASS
)
const muted = computed((): boolean => nodeData.mode === LGraphEventMode.NEVER)

const nodeOpacity = computed(() => {
  const globalOpacity = settingStore.get('Comfy.Node.Opacity') ?? 1

  if (nodeData.flags?.ghost) return globalOpacity * 0.6

  // For muted/bypassed nodes, apply the 0.5 multiplier on top of global opacity
  if (bypassed.value || muted.value) {
    return globalOpacity * 0.5
  }

  return globalOpacity
})

const hasInputs = computed(() => nonWidgetedInputs(nodeData.inputs).length > 0)

// Use canvas interactions for proper wheel event handling and pointer event capture control
const { handleWheel, shouldHandleNodePointerEvents } = useCanvasInteractions()

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false // Prevent error propagation
})

const { position, size, zIndex } = useNodeLayout(() => nodeData.id)

const nodeSizeStyle = computed(() =>
  isCollapsed.value
    ? {}
    : {
        '--node-width': `${size.value.width}px`,
        '--node-height': `${size.value.height + LiteGraph.NODE_TITLE_HEIGHT}px`
      }
)

const { pointerHandlers } = useNodePointerInteractions(() => nodeData)
const { onPointerdown, ...remainingPointerHandlers } = pointerHandlers
const { startDrag } = useNodeDrag()
const badges = usePartitionedBadges(nodeData)

async function nodeOnPointerdown(event: PointerEvent) {
  const node = resolveLGraphNode()
  if (event.altKey && node) {
    const result = LGraphCanvas.cloneNodes([node])
    if (result?.created?.length) {
      const [newNode] = result.created
      const newNodeId =
        typeof newNode.id === 'number' ? toNodeId(newNode.id) : newNode.id
      startDrag(event, newNodeId)
      layoutStore.isDraggingVueNodes.value = true
      await nextTick()
      bringNodeToFront(newNodeId)
      return
    }
  }
  onPointerdown(event)
}

// Handle right-click context menu
const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()

  // First handle the standard right-click behavior (selection)
  handleNodeRightClick(event as PointerEvent, nodeData.id)

  // Show the node options menu at the cursor position
  showNodeOptions(event)
}

const baseResizeHandleClasses =
  'absolute h-5 w-5 opacity-0 pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40 touch-none'

const { startResize } = useNodeResize((result) => {
  if (isCollapsed.value) return
  const node = resolveLGraphNode()
  if (!node) return

  resizeNodeLayout(
    node,
    {
      width: Math.max(result.size.width, MIN_NODE_WIDTH),
      height: removeNodeTitleHeight(result.size.height)
    },
    {
      position: result.position,
      source: LayoutSource.Vue
    }
  )
})

const handleResizePointerDown = (
  event: PointerEvent,
  corner: CompassCorners
) => {
  if (event.button !== 0) return
  if (!shouldHandleNodePointerEvents.value) return
  if (nodeData.flags?.pinned) return
  if (nodeData.resizable === false) return
  startResize(event, corner)
}

// Check if node has custom content (like image/video outputs)
const hasCustomContent = computed(() => {
  if (promotedPreviews.value.length > 0) return true
  return !!nodeMedia.value && nodeMedia.value.urls.length > 0
})

// Computed classes and conditions for better reusability
const progressClasses = 'h-2 bg-primary-500 transition-all duration-300'

const { latestPreviewUrl, shouldShowPreviewImg } = useNodePreviewState(
  () => nodeData.id,
  {
    isCollapsed
  }
)

const cursorClass = computed(() => {
  if (nodeData.flags?.pinned) return 'cursor-default'
  return layoutStore.isDraggingVueNodes.value
    ? 'cursor-grabbing'
    : 'cursor-grab'
})

const bodyRoundingClass = computed(() =>
  shapeVariantClass(nodeData.shape, {
    box: '',
    card: 'rounded-br-xl',
    default: 'rounded-b-xl'
  })
)

const shapeClass = computed(() =>
  shapeVariantClass(nodeData.shape, {
    box: '',
    card: 'rounded-tl-xl rounded-br-xl',
    default: 'rounded-xl'
  })
)

const isTransparentHeaderless = computed(
  () =>
    !displayHeader.value &&
    !!nodeData.bgcolor &&
    isTransparent(nodeData.bgcolor)
)

const selectionShapeClass = computed(() => {
  if (isTransparentHeaderless.value) return 'border-0'

  const isExpanded = hasAnyError.value
  return shapeVariantClass(nodeData.shape, {
    box: '',
    card: isExpanded
      ? 'rounded-tl-[23px] rounded-br-[23px]'
      : 'rounded-tl-[19px] rounded-br-[19px]',
    default: isExpanded ? 'rounded-[19px]' : 'rounded-[15px]'
  })
})

const BEFORE_OVERLAY_BASE =
  'before:pointer-events-none before:absolute before:inset-0'

const bypassOverlayClass = computed(() =>
  shapeVariantClass(nodeData.shape, {
    box: `${BEFORE_OVERLAY_BASE} before:bg-bypass/60`,
    card: `before:rounded-tl-xl before:rounded-br-xl ${BEFORE_OVERLAY_BASE} before:bg-bypass/60`,
    default: `before:rounded-xl ${BEFORE_OVERLAY_BASE} before:bg-bypass/60`
  })
)

const mutedOverlayClass = computed(() =>
  shapeVariantClass(nodeData.shape, {
    box: BEFORE_OVERLAY_BASE,
    card: `before:rounded-tl-xl before:rounded-br-xl ${BEFORE_OVERLAY_BASE}`,
    default: `before:rounded-xl ${BEFORE_OVERLAY_BASE}`
  })
)

// Event handlers
const handleCollapse = () => {
  handleNodeCollapse(nodeData.id, !isCollapsed.value)
}

const handleHeaderTitleUpdate = (newTitle: string) => {
  handleNodeTitleUpdate(nodeData.id, newTitle)
}

const rightSidePanelStore = useRightSidePanelStore()

const handleOpenErrors = () => {
  rightSidePanelStore.openPanel('errors')
}

const handleToggleAdvanced = () => {
  const node = resolveLGraphNode()
  if (!node) return

  // A subgraph node has no advanced section of its own; the side panel hosts it.
  if (node instanceof SubgraphNode) {
    if (rightSidePanelStore.isOpen) rightSidePanelStore.closePanel()
    else rightSidePanelStore.focusSection('advanced-inputs')
    return
  }
  node.showAdvanced = !node.showAdvanced
}

const handleEnterSubgraph = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'graph_node_open_subgraph_clicked',
    element_group: 'graph_node'
  })
  const graph = app.rootGraph
  if (!graph) {
    console.warn('LGraphNode: No graph available for subgraph navigation')
    return
  }

  const locatorId = nodeLocatorId.value
  if (!locatorId) return

  const litegraphNode = getNodeByLocatorId(graph, locatorId)

  if (!litegraphNode?.isSubgraphNode() || !('subgraph' in litegraphNode)) {
    console.warn('LGraphNode: Node is not a valid subgraph node', litegraphNode)
    return
  }

  const canvas = app.canvas
  if (!canvas || typeof canvas.openSubgraph !== 'function') {
    console.warn('LGraphNode: Canvas or openSubgraph method not available')
    return
  }

  canvas.openSubgraph(litegraphNode.subgraph, litegraphNode)
}

const nodeOutputs = useNodeOutputStore()

const nodeOutputLocatorId = computed(() => {
  const subgraphId = subgraphIdFromState(nodeData, canvasStore.rootGraphId)
  return subgraphId ? `${subgraphId}:${nodeData.id}` : nodeData.id
})

function resolveLGraphNode() {
  const locatorId = nodeLocatorId.value
  if (!locatorId) return null

  return getNodeByLocatorId(app.rootGraph, locatorId)
}

const lgraphNode = computed(resolveLGraphNode)

// TODO: Surface subgraph info more cleanly in NodeState instead of
// reaching through lgraphNode for promoted preview resolution.
const { promotedPreviews } = usePromotedPreviews(lgraphNode)

const { hideExecutedOutput } = useGLSLPreview(lgraphNode)

const widgetValueStore = useWidgetValueStore()
const widgetIds = computed(() => {
  const graphId = canvasStore.rootGraphId
  const bareNodeId = stripGraphPrefix(nodeData.id)
  if (!graphId || !bareNodeId) return []

  return widgetValueStore.getNodeWidgetIds(graphId, bareNodeId) ?? []
})

const renderedWidgetIds = computed(() => {
  const node = lgraphNode.value
  if (!node || !shouldHideLinkedCoreLoadAudioPlayer(node))
    return widgetIds.value

  return widgetIds.value.filter((id) => {
    const widget = widgetValueStore.getWidget(id)
    return widget?.name !== 'audioUI' || widget.type !== 'audioUI'
  })
})

const hasRenderableWidgets = computed(() => renderedWidgetIds.value.length > 0)

const showAdvancedInputsButton = computed(() => {
  const node = lgraphNode.value
  if (!node) return false
  if (isCollapsed.value) return false
  if (node instanceof SubgraphNode) {
    return hasUnpromotedWidgets(node)
  }

  const hasAdvancedWidgets = widgetIds.value.some((id) => {
    const renderState = widgetValueStore.getWidgetRenderState(id)
    const widgetState = widgetValueStore.getWidget(id)
    return renderState?.advanced ?? widgetState?.options?.advanced
  })
  const alwaysShowAdvanced = settingStore.get(
    'Comfy.Node.AlwaysShowAdvancedWidgets'
  )
  return hasAdvancedWidgets && !alwaysShowAdvanced
})

const hasVideoInput = computed(() =>
  nodeData.inputs.some((input) => input.type === 'VIDEO')
)

const hasVideoEditWidget = computed(() =>
  widgetIds.value.some(
    (id) => widgetValueStore.getWidget(id)?.type === 'videoedit'
  )
)

const nodeMedia = computed(() => {
  const newOutputs = nodeOutputs.nodeOutputs[nodeOutputLocatorId.value]
  const node = lgraphNode.value

  if (
    !node ||
    !newOutputs?.images?.length ||
    node.hideOutputImages ||
    hideExecutedOutput.value
  )
    return undefined

  if (node instanceof SubgraphNode) return undefined
  if (shouldHideLinkedCoreMediaInputPreview(node, newOutputs)) return undefined

  const urls = nodeOutputs.getNodeImageUrls(node)
  if (!urls?.length) return undefined

  const type =
    isVideoOutput(newOutputs) ||
    node.previewMediaType === 'video' ||
    (!node.previewMediaType && hasVideoInput.value)
      ? 'video'
      : 'image'

  if (type === 'video' && hasVideoEditWidget.value) return undefined

  return { type, urls } as const
})

// Drag and drop support
const isDraggingOver = ref(false)

function handleDragOver(event: DragEvent) {
  const node = resolveLGraphNode()
  if (!node || !node.onDragOver) {
    isDraggingOver.value = false
    return
  }

  // Call the litegraph node's onDragOver callback to check if files are valid
  const canDrop = node.onDragOver(event)
  isDraggingOver.value = canDrop
}

function handleDragLeave() {
  isDraggingOver.value = false
}

function handleDrop() {
  isDraggingOver.value = false
  app.dragOverNode = resolveLGraphNode()
}
</script>
