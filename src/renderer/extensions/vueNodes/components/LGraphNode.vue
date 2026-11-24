<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-destructive">
    {{ st('nodeErrors.render', 'Node Render Error') }}
  </div>
  <div
    v-else
    ref="nodeRef"
    tabindex="0"
    :data-node-id="nodeData.id"
    :data-collapsed="isCollapsed || undefined"
    :data-emphasized="isEmphasized || undefined"
    :data-ghost="nodeData.flags?.ghost || undefined"
    :data-node-type="nodeData.type"
    :data-mode="stateAttributes.mode"
    :data-executing="stateAttributes.executing"
    :data-error="stateAttributes.error"
    :class="
      cn(
        'group/node lg-node absolute isolate touch-none text-xs text-node-foreground',
        'flex flex-col contain-layout contain-style',
        'drop-shadow-lg outline-none',
        isRerouteNode
          ? 'h-(--node-height)'
          : compactHeader
            ? 'w-max max-w-(--collapsed-node-max-width)'
            : 'min-h-(--node-height) min-w-(--min-node-width)',
        cursorClass,
        shouldHandleNodePointerEvents &&
          !nodeData.flags?.ghost &&
          !isGhostPlacing
          ? 'pointer-events-auto'
          : 'pointer-events-none'
      )
    "
    :style="{
      ...nodeSizeStyle,
      '--min-node-width': `${minNodeWidth}px`,
      '--collapsed-node-max-width': `${MIN_NODE_WIDTH}px`,
      '--node-header-height': `${VUE_NODE_BODY.headerHeight}px`,
      transform: nodeTransform,
      zIndex: zIndex,
      opacity: nodeOpacity
    }"
    :inert="isGhostPlacing"
    v-bind="pointerHandlers"
    @wheel="handleWheel"
    @contextmenu="handleContextMenu"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <NodeBadges
      v-if="!isRerouteNode && !isTransparentHeaderless"
      v-bind="badges"
      class="absolute right-0 bottom-full"
      :style="badgesStyle"
    />
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
      data-testid="node-state-outline-overlay"
      :class="
        cn(
          'pointer-events-none absolute z-0 outline-offset-2 group-focus-visible/node:block group-focus-visible/node:[outline-style:auto]',
          selectionShapeClass,
          hasAnyError ? '-inset-1.75' : '-inset-0.75',
          isEmphasized || executing ? 'block border-3' : 'hidden',
          isEmphasized ? 'border-foreground' : executing && 'border-primary'
        )
      "
    />
    <div
      :class="
        cn(
          'relative flex flex-1 flex-col',
          !isCollapsed && 'transform-[translate(0)] [clip-path:inset(-16px)]'
        )
      "
    >
      <div
        data-testid="node-inner-wrapper"
        data-part="node-frame"
        :class="
          cn(
            'flex flex-1 flex-col bg-node-header',
            'w-(--node-width)',
            !isRerouteNode && !compactHeader && 'min-w-(--min-node-width)',
            shapeClass,
            hasAnyError && 'ring-4',
            errorSeverity === 'missing' && 'ring-warning',
            errorSeverity === 'error' && 'ring-destructive',
            bypassed && bypassOverlayClass,
            muted && mutedOverlayClass,
            isDraggingOver && 'bg-primary/10 ring-4 ring-primary'
          )
        "
        :style="{
          '--node': themeStore.toNodeColor(nodeData.bgcolor),
          '--component-node-background': 'var(--node)',
          backgroundColor: themeStore.toNodeColor(nodeData?.color)
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
            :show-missing-warning="
              errorSeverity === 'missing' && !showErrorsTabEnabled
            "
            @collapse="handleCollapse"
            @update:title="handleHeaderTitleUpdate"
          />
        </div>

        <NodeProgressBar
          v-if="isCollapsed && executing && progress !== undefined"
          :progress
          collapsed
        />

        <template v-if="!isCollapsed && isRerouteNode">
          <NodeSlots :node-data />
        </template>

        <template v-else-if="!isCollapsed">
          <div class="relative">
            <NodeProgressBar
              v-if="executing && progress !== undefined"
              :progress
            />
          </div>

          <div
            :class="cn('flex flex-1 flex-col bg-node', bodyRoundingClass)"
            :style="{
              rowGap: `${VUE_NODE_BODY.gap}px`,
              paddingTop: `${VUE_NODE_BODY.paddingTop}px`,
              paddingBottom: `${VUE_NODE_BODY.paddingBottom}px`
            }"
            :data-testid="`node-body-${nodeData.id}`"
            data-part="node-body"
          >
            <NodeSlots :node-data />

            <NodeWidgets
              v-if="hasRenderableWidgets"
              :node-data
              :processed-widget-model
            />

            <div
              v-for="(region, index) in mediaRegions"
              :key="region.name"
              :data-media-region="region.name"
              :data-media-fills-node="
                mediaRegions.length === 1 && region.fills && !hasExpandingWidget
                  ? ''
                  : undefined
              "
              :class="
                cn(
                  'relative flex min-h-0 flex-col',
                  region.height !== undefined
                    ? 'grid shrink-0'
                    : region.fills
                      ? 'flex-1'
                      : 'shrink-0',
                  region.height === undefined &&
                    region.growsIntoLeftover &&
                    'grow'
                )
              "
              :style="
                region.height === undefined
                  ? undefined
                  : { gridTemplateRows: userHeightTrack(region.height) }
              "
            >
              <div class="flex min-h-0 flex-1 flex-col">
                <LivePreview
                  v-if="region.media.type === 'preview'"
                  :image-url="region.media.url"
                />
                <NodeContent v-else :node-data :media="region.media" />
              </div>
              <GrowableRegionHandle
                :name="region.name"
                :label="
                  mediaRegions.length > 1
                    ? t('g.resizeNumberedPreviewHeight', { index: index + 1 })
                    : t('g.resizePreviewHeight')
                "
              />
            </div>
            <LivePreview
              v-if="shouldShowPreviewImg && !lgraphNode?.isSubgraphNode()"
              :image-url="latestPreviewUrl"
            />
          </div>
        </template>
      </div>
      <NodeFooter
        v-if="!isRerouteNode"
        :is-subgraph="!!lgraphNode?.isSubgraphNode()"
        :error-severity="errorSeverity"
        :show-errors-tab-enabled="showErrorsTabEnabled"
        :show-advanced-inputs-button="showAdvancedInputsButton"
        :show-advanced-state="!!nodeData.showAdvanced"
        :header-color="themeStore.toNodeColor(nodeData?.color)"
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
        <NodeResizeHandle
          v-for="handle in RESIZE_HANDLES"
          :key="handle.corner"
          :handle
          @resize="handleResizePointerDown"
          @fit="handleResizeDoubleClick"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isEqual } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import {
  computed,
  onErrorCaptured,
  provide,
  ref,
  shallowReactive,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { hasUnpromotedWidgets } from '@/core/graph/subgraph/promotionUtils'
import { st } from '@/i18n'
import type { CompassCorners } from '@comfyorg/shared-frontend-utils/geometry'
import { LGraphEventMode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { TitleMode } from '@comfyorg/graph-model/globalEnums'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useThemeStore } from '@/platform/theme/themeStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useTelemetry } from '@comfyorg/telemetry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useCompositedTransform } from '@/renderer/core/layout/transform/useCompositedTransform'
import { useGLSLPreview } from '@/renderer/glsl/useGLSLPreview'
import { usePromotedPreviews } from '@/composables/node/usePromotedPreviews'
import NodeBadges from '@/renderer/extensions/vueNodes/components/NodeBadges.vue'
import { LayoutSource } from '@/renderer/core/layout/types'
import { removeNodeTitleHeight } from '@/renderer/core/layout/utils/nodeSizeUtil'
import AppOutput from '@/renderer/extensions/linearMode/AppOutput.vue'
import SlotConnectionDot from '@/renderer/extensions/vueNodes/components/SlotConnectionDot.vue'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useNodeMouseCallbacks } from '@/renderer/extensions/vueNodes/composables/useNodeMouseCallbacks'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'
import { usePartitionedBadges } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import { useProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { useMountedNodeSize } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import { useNodeExecutionState } from '@/renderer/extensions/vueNodes/execution/useNodeExecutionState'
import {
  growableRegionsKey,
  useGrowableRegions,
  userHeightTrack
} from '@/renderer/extensions/vueNodes/layout/useGrowableRegions'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'
import type {
  BodyItem,
  VueNodeBodyLayout
} from '@/renderer/extensions/vueNodes/layout/vueNodeBodyLayout'
import {
  layoutVueNodeBody,
  VUE_NODE_BODY
} from '@/renderer/extensions/vueNodes/layout/vueNodeBodyLayout'
import { vueNodeBodyKey } from '@/renderer/extensions/vueNodes/layout/vueNodeBodyLayoutRegistry'
import { setDerivedSlotAnchors } from '@/renderer/core/layout/slots/derivedSlotAnchors'
import { useNodePreviewState } from '@/renderer/extensions/vueNodes/preview/useNodePreviewState'
import {
  shouldHideLinkedCoreLoadAudioPlayer,
  shouldHideLinkedCoreMediaInputPreview
} from '@/renderer/extensions/vueNodes/utils/linkedCoreMediaUtils'
import {
  isAdvancedSocketInput,
  nonWidgetedInputs
} from '@/renderer/extensions/vueNodes/utils/nodeDataUtils'
import { getNodeErrorSeverity } from '@/renderer/extensions/vueNodes/utils/nodeErrorState'
import { shouldExpand } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { shapeVariantClass } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import { useApp } from '@/scripts/appInstance'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { isVideoResult } from '@/utils/resultItem'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import { usePropertiesPanelStore } from '@/renderer/extensions/propertiesPanel/propertiesPanelStore'
import { isNodeEmphasized } from '@/systems/nodeEmphasisSystem'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { isWidgetId, widgetId } from '@comfyorg/graph-model/widgetId'
import { CANVAS_IMAGE_PREVIEW_WIDGET } from '@/core/graph/subgraph/preview/mediaPreviewName'
import { isVideoOutput } from '@/utils/litegraphUtil'
import {
  getNodeByLocatorId,
  locatorIdFromState
} from '@/utils/graphTraversalUtil'
import { cn } from '@comfyorg/tailwind-utils'
import { isTransparent } from '@comfyorg/shared-frontend-utils/colorUtil'

import { minRowHeight } from '@/lib/litegraph/src/utils/widgetLayout'
import { resizeNodeLayout } from '@/renderer/core/layout/operations/graphLayoutAttachment'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'

import { RESIZE_HANDLES } from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'
import { useNodeResize } from '@/renderer/extensions/vueNodes/interactions/resize/useNodeResize'
import LivePreview from './LivePreview.vue'
import GrowableRegionHandle from './GrowableRegionHandle.vue'
import NodeContent from './NodeContent.vue'
import NodeHeader from './NodeHeader.vue'
import NodeFooter from './NodeFooter.vue'
import NodeResizeHandle from './NodeResizeHandle.vue'
import NodeProgressBar from './NodeProgressBar.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'
import {
  IMAGE_PREVIEW_HEIGHT_RESERVE,
  NODE_CONTENT_GAP
} from './imagePreviewLayout'

const { nodeData } = defineProps<{
  nodeData: NodeState
}>()

const { t } = useI18n()

const { isSelectMode, isSelectOutputsMode } = useAppMode()
const settingStore = useSettingStore()
const themeStore = useThemeStore()

const { handleNodeCollapse, handleNodeTitleUpdate, handleNodeRightClick } =
  useNodeEventHandlers()

const nodeId = computed(() => nodeData.id)

const canvasStore = useCanvasStore()

const { isGhostPlacing } = storeToRefs(useCanvasStore())
const isEmphasized = computed(() => {
  const graph = canvasStore.currentGraph
  return isNodeEmphasized(graph ? graphScopeOf(graph) : undefined, nodeId.value)
})

const nodeLocatorId = computed(
  () => locatorIdFromState(nodeData, canvasStore.rootGraphId) ?? undefined
)
const { executing, progress } = useNodeExecutionState(nodeLocatorId)
const errorSeverity = computed(() =>
  getNodeErrorSeverity(nodeData, canvasStore.rootGraphId, lgraphNode.value)
)

const hasAnyError = computed(() => errorSeverity.value !== 'none')

const showErrorsTabEnabled = computed(() =>
  settingStore.get('Comfy.RightSidePanel.ShowErrorsTab')
)

const displayHeader = computed(() => nodeData.titleMode !== TitleMode.NO_TITLE)

const isRerouteNode = computed(() => nodeData.type === 'Reroute')

const isCollapsed = computed(() => nodeData.flags?.collapsed ?? false)
const compactHeader = computed(
  () =>
    isCollapsed.value &&
    displayHeader.value &&
    !isRerouteNode.value &&
    !nodeData.showAdvanced &&
    !(hasAnyError.value && showErrorsTabEnabled.value)
)
const bypassed = computed(
  (): boolean => nodeData.mode === LGraphEventMode.BYPASS
)
const muted = computed((): boolean => nodeData.mode === LGraphEventMode.NEVER)

const stateAttributes = computed(() => ({
  mode: bypassed.value ? 'bypass' : muted.value ? 'muted' : undefined,
  executing: executing.value ? '' : undefined,
  error: hasAnyError.value ? errorSeverity.value : undefined
}))

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

const nodeRef = useTemplateRef<HTMLElement>('nodeRef')
useMountedNodeSize(
  nodeRef,
  () => nodeId.value,
  () => nodeData.type
)
const nodeTransform = computed(
  () =>
    `translate(${position.value.x ?? 0}px, ${(position.value.y ?? 0) - LiteGraph.NODE_TITLE_HEIGHT}px)`
)
const { setTransform: setDraggedTransform, releaseTransform } =
  useCompositedTransform(nodeRef)

watch(nodeTransform, (transform) => {
  if (layoutStore.isDraggingVueNodes.value) setDraggedTransform(transform)
})
watch(layoutStore.isDraggingVueNodes, (isDragging) => {
  if (!isDragging) releaseTransform()
})

const growable = useGrowableRegions({
  regionId: (name) => {
    const graphId = canvasStore.rootGraphId
    const bareNodeId = stripGraphPrefix(nodeData.id)
    if (!graphId || !bareNodeId || name === soleGrowableWidget.value) return
    const id = widgetId(graphId, bareNodeId, name)
    return isWidgetId(id) ? id : undefined
  },
  resizeNode: resizeNodeTo,
  onCommit: () =>
    useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
})
const mediaUserHeight = computed(() =>
  growable.heightOf(CANVAS_IMAGE_PREVIEW_WIDGET)
)

const imageSharesNodeWithWidgets = computed(
  () => nodeMedia.value?.type === 'image' && hasExpandingWidget.value
)

const imagePreviewGrowth = computed(() => {
  if (!imageSharesNodeWithWidgets.value) return 0
  return mediaUserHeight.value === undefined
    ? IMAGE_PREVIEW_HEIGHT_RESERVE
    : mediaUserHeight.value + NODE_CONTENT_GAP
})

const nodeSizeStyle = computed(() =>
  isCollapsed.value
    ? {}
    : {
        '--node-width': `${size.value.width}px`,
        '--node-height': `${size.value.height + LiteGraph.NODE_TITLE_HEIGHT + imagePreviewGrowth.value}px`
      }
)

const { pointerHandlers, isDragging } = useNodePointerInteractions(
  () => nodeData
)
useNodeMouseCallbacks(() => nodeData.id, nodeRef)
const badges = usePartitionedBadges(nodeData)

// Handle right-click context menu
const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()

  // First handle the standard right-click behavior (selection)
  handleNodeRightClick(event, nodeData.id)

  // Show the node options menu at the cursor position
  showNodeOptions(event, { nodeId: nodeData.id })
}

function resizeNodeTo(
  height: number,
  width = size.value.width,
  position?: { x: number; y: number }
) {
  const node = resolveLGraphNode()
  if (!node) return
  resizeNodeLayout(
    node,
    {
      width,
      height: removeNodeTitleHeight(height) - imagePreviewGrowth.value
    },
    { position, source: LayoutSource.Vue }
  )
}

const canResizeNode = computed(
  () =>
    !isCollapsed.value &&
    !isRerouteNode.value &&
    nodeData.resizable !== false &&
    !nodeData.flags?.pinned &&
    !isSelectMode.value &&
    shouldHandleNodePointerEvents.value
)

provide(growableRegionsKey, {
  heightOf: growable.heightOf,
  handle: computed(() => (canResizeNode.value ? growable.handle : undefined))
})

function handleResizeDoubleClick(event: MouseEvent) {
  if (!canResizeNode.value) return
  const widget = soleGrowableWidget.value
  const layout = bodyLayout.value
  if (widget) growable.resetWidget(event, widget, soleGrowableMinHeight(widget))
  else if (layout && !mediaRegions.value.length) {
    resizeNodeTo(
      layout.minBodyHeight +
        BODY_TOP +
        footerOverhang.value +
        LiteGraph.NODE_TITLE_HEIGHT
    )
    useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
  } else growable.fitNode(event)
}

const { startResize } = useNodeResize((result) => {
  if (isCollapsed.value) return
  resizeNodeTo(
    result.size.height,
    Math.max(result.size.width, minNodeWidth.value),
    result.position
  )
})

const handleResizePointerDown = (
  event: PointerEvent,
  corner: CompassCorners
) => {
  if (event.button !== 0 || !canResizeNode.value) return
  const element = nodeRef.value
  if (element)
    startResize(event, corner, {
      element,
      position: position.value,
      rowSlack: () => bodyLayout.value?.slack ?? 0
    })
}

const mediaRegions = computed(() => [
  ...(nodeMedia.value?.items.length
    ? [
        {
          name: CANVAS_IMAGE_PREVIEW_WIDGET,
          media: nodeMedia.value,
          height: mediaUserHeight.value,
          fills: !imageSharesNodeWithWidgets.value,
          growsIntoLeftover: !widgetTakesSpareHeight.value
        }
      ]
    : []),
  ...promotedPreviews.value.map((media) => ({
    name: media.name,
    media,
    height: growable.heightOf(media.name),
    fills: true,
    growsIntoLeftover: false
  }))
])

const { latestPreviewUrl, shouldShowPreviewImg } = useNodePreviewState(
  () => nodeData.id,
  {
    isCollapsed
  }
)

const cursorClass = computed(() => {
  if (nodeData.flags?.pinned) return 'cursor-default'
  return isDragging.value ? 'cursor-grabbing' : 'cursor-grab'
})

const bodyRoundingClass = computed(() =>
  shapeVariantClass(nodeData.shape, {
    box: '',
    card: 'rounded-br-(--node-radius)',
    default: 'rounded-b-(--node-radius)'
  })
)

const shapeClass = computed(() =>
  shapeVariantClass(nodeData.shape, {
    box: '',
    card: 'rounded-tl-(--node-radius) rounded-br-(--node-radius)',
    default: 'rounded-(--node-radius)'
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

  return shapeVariantClass(nodeData.shape, {
    box: '',
    card: hasAnyError.value
      ? 'rounded-tl-[calc(var(--node-radius)+11px)] rounded-br-[calc(var(--node-radius)+11px)]'
      : 'rounded-tl-[calc(var(--node-radius)+7px)] rounded-br-[calc(var(--node-radius)+7px)]',
    default: hasAnyError.value
      ? 'rounded-[calc(var(--node-radius)+7px)]'
      : 'rounded-[calc(var(--node-radius)+3px)]'
  })
})

const BEFORE_OVERLAY_BASE =
  'before:pointer-events-none before:absolute before:inset-0'

const bypassOverlayClass = computed(() =>
  shapeVariantClass(nodeData.shape, {
    box: `${BEFORE_OVERLAY_BASE} before:bg-bypass/60`,
    card: `before:rounded-tl-(--node-radius) before:rounded-br-(--node-radius) ${BEFORE_OVERLAY_BASE} before:bg-bypass/60`,
    default: `before:rounded-(--node-radius) ${BEFORE_OVERLAY_BASE} before:bg-bypass/60`
  })
)

const mutedOverlayClass = computed(() =>
  shapeVariantClass(nodeData.shape, {
    box: BEFORE_OVERLAY_BASE,
    card: `before:rounded-tl-(--node-radius) before:rounded-br-(--node-radius) ${BEFORE_OVERLAY_BASE}`,
    default: `before:rounded-(--node-radius) ${BEFORE_OVERLAY_BASE}`
  })
)

// Event handlers
const handleCollapse = () => {
  handleNodeCollapse(nodeData.id, !isCollapsed.value)
}

const handleHeaderTitleUpdate = (newTitle: string) => {
  handleNodeTitleUpdate(nodeData.id, newTitle)
}

const propertiesPanelStore = usePropertiesPanelStore()

const handleOpenErrors = () => {
  propertiesPanelStore.openPanel('errors')
}

const handleToggleAdvanced = () => {
  const node = resolveLGraphNode()
  if (!node) return

  // A subgraph node has no advanced section of its own; the side panel hosts it.
  if (node instanceof SubgraphNode) {
    if (propertiesPanelStore.isOpen) propertiesPanelStore.closePanel()
    else propertiesPanelStore.focusSection('advanced-inputs')
    return
  }
  node.showAdvanced = !node.showAdvanced
}

const handleEnterSubgraph = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'graph_node_open_subgraph_clicked',
    element_group: 'graph_node'
  })
  const graph = useApp().rootGraph
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

  const canvas = useApp().canvas
  if (!canvas || typeof canvas.openSubgraph !== 'function') {
    console.warn('LGraphNode: Canvas or openSubgraph method not available')
    return
  }

  canvas.openSubgraph(litegraphNode.subgraph, litegraphNode)
}

const nodeOutputs = useNodeOutputStore()

function resolveLGraphNode() {
  const locatorId = nodeLocatorId.value
  if (!locatorId) return null

  return getNodeByLocatorId(useApp().rootGraph, locatorId)
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

const { canSelectInputs, gridRows, nodeType, processedWidgets } =
  useProcessedWidgets(
    () => nodeData,
    () => renderedWidgetIds.value
  )
const measuredLabelsKey = computed(() =>
  [
    nodeData.title,
    ...nodeData.inputs.map(
      (slot) => slot.label || slot.localized_name || slot.name
    ),
    ...nodeData.outputs.map(
      (slot) => slot.label || slot.localized_name || slot.name
    ),
    ...processedWidgets.value
      .filter(({ visible }) => visible)
      .map(
        ({ widgetId, simplified }) =>
          `${widgetId}:${simplified.displayLabel ?? simplified.name}`
      )
  ].join('\n')
)

const minNodeWidth = ref(LiteGraph.NODE_WIDTH)
watch(
  [lgraphNode, measuredLabelsKey, isCollapsed],
  ([node, , collapsed]) => {
    if (node && !collapsed)
      minNodeWidth.value = Math.ceil(node.computeSize()[0])
  },
  { immediate: true }
)

const hasRenderableWidgets = computed(() => gridRows.value.length > 0)
const processedWidgetModel = computed(() => ({
  processedWidgets: gridRows.value,
  nodeType: nodeType.value,
  canSelectInputs: canSelectInputs.value
}))
const hasExpandingWidget = computed(() =>
  processedWidgets.value.some(
    (widget) =>
      widget.visible && shouldExpand(widget.simplified.type, widget.sizing)
  )
)

const soleGrowableWidget = computed(() => {
  if (nodeMedia.value?.items.length || promotedPreviews.value.length) return
  const visible = processedWidgets.value.filter(({ visible }) => visible)
  const [widget] = visible
  return visible.length === 1 &&
    shouldExpand(widget.simplified.type, widget.sizing)
    ? widget.simplified.name
    : undefined
})

function soleGrowableMinHeight(name: string) {
  const sizing = processedWidgets.value.find(
    ({ simplified }) => simplified.name === name
  )?.sizing
  return sizing && minRowHeight(sizing)
}

const widgetTakesSpareHeight = computed(() =>
  processedWidgets.value.some(
    ({ visible, simplified, sizing }) =>
      visible &&
      shouldExpand(simplified.type, sizing) &&
      (sizing?.kind !== 'growable' || sizing.maxHeight === undefined) &&
      growable.heightOf(simplified.name) === undefined
  )
)

const showAdvancedInputsButton = computed(() => {
  const node = lgraphNode.value
  if (!node) return false
  if (isCollapsed.value) return false
  if (node instanceof SubgraphNode) {
    return hasUnpromotedWidgets(node)
  }

  const hasAdvancedWidgets =
    widgetIds.value.some((id) => {
      const visibility = widgetValueStore.getWidgetVisibility(id)
      if (visibility) return visibility.surfaces.vueNode === 'advanced'
      return widgetValueStore.getWidget(id)?.options?.advanced
    }) || nodeData.inputs.some((input) => isAdvancedSocketInput(node, input))
  const alwaysShowAdvanced = settingStore.get(
    'Comfy.Node.AlwaysShowAdvancedWidgets'
  )
  return hasAdvancedWidgets && !alwaysShowAdvanced
})

const hasVideoInput = computed(() =>
  nodeData.inputs.some((input) => input.type === 'VIDEO')
)

const VIDEO_PREVIEW_WIDGET_TYPES = new Set(['videoedit', 'videoconcat'])

const hasVideoPreviewWidget = computed(() =>
  widgetIds.value.some((id) =>
    VIDEO_PREVIEW_WIDGET_TYPES.has(widgetValueStore.getWidget(id)?.type ?? '')
  )
)

const nodeMedia = computed(() => {
  const node = lgraphNode.value
  if (!node || node.hideOutputImages !== false || hideExecutedOutput.value)
    return undefined
  if (node instanceof SubgraphNode) return undefined

  const outputs = nodeOutputs.getNodeOutputs(node)
  if (!outputs?.images?.length) return undefined

  if (shouldHideLinkedCoreMediaInputPreview(node, outputs)) return undefined

  const type =
    isVideoOutput(outputs) ||
    node.previewMediaType === 'video' ||
    (!node.previewMediaType && hasVideoInput.value)
      ? 'video'
      : 'image'

  if (type === 'video' && hasVideoPreviewWidget.value) return undefined

  const items = nodeOutputs
    .getNodeOutputItems(node, outputs)
    .filter((item) =>
      type === 'video' ? isVideoResult(item) : item.mediaType === 'images'
    )
  if (!items.length) return undefined

  return { type, items } as const
})

// Drag and drop support
const isDraggingOver = ref(false)

const badgesStyle = computed(() => ({
  marginBottom: `${4 + (hasAnyError.value || isDraggingOver.value ? 4 : 0) + (isEmphasized.value || executing.value ? 3 : 0)}px`
}))

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

function handleDrop(event: DragEvent) {
  isDraggingOver.value = false
  useApp().dragOverNode = event.defaultPrevented ? null : resolveLGraphNode()
}

const FOOTER_TAB_OVERHANG = 24
const ERROR_FOOTER_OVERHANG = 20

const footerOverhang = computed(() => {
  if (isRerouteNode.value) return 0
  if (hasAnyError.value && showErrorsTabEnabled.value)
    return ERROR_FOOTER_OVERHANG
  const hasTab =
    !!lgraphNode.value?.isSubgraphNode() ||
    showAdvancedInputsButton.value ||
    !!nodeData.showAdvanced
  if (!hasTab) return 0
  return hasAnyError.value ? ERROR_FOOTER_OVERHANG : FOOTER_TAB_OVERHANG
})

const slotItems = shallowRef<(() => BodyItem[]) | undefined>()
const widgetItems = shallowRef<(() => BodyItem[]) | undefined>()
const contentHeights = shallowReactive(new Map<string, number>())

const bodyWidth = computed(() => Math.max(size.value.width, minNodeWidth.value))
const bodyHeight = computed(
  () => size.value.height - BODY_TOP - footerOverhang.value
)

const bodyLayout = computed<VueNodeBodyLayout | undefined>((previous) => {
  if (isCollapsed.value || isRerouteNode.value) return undefined
  const items = [
    ...(slotItems.value?.() ?? []),
    ...(widgetItems.value?.() ?? [])
  ].map((item) =>
    item.kind === 'control'
      ? { ...item, contentHeight: contentHeights.get(item.key) }
      : item
  )
  const next = layoutVueNodeBody(bodyWidth.value, bodyHeight.value, items)
  return previous && isEqual(previous, next) ? previous : next
})

const BODY_TOP = VUE_NODE_BODY.headerHeight - LiteGraph.NODE_TITLE_HEIGHT

function offsetFromBody(points: ReadonlyMap<number, { x: number; y: number }>) {
  return new Map(
    [...points].map(([index, { x, y }]) => [index, { x, y: y + BODY_TOP }])
  )
}

const slotAnchors = computed(() => {
  const layout = bodyLayout.value
  return (
    layout && {
      input: offsetFromBody(layout.inputs),
      output: offsetFromBody(layout.outputs)
    }
  )
})

provide(vueNodeBodyKey, {
  slotItems,
  widgetItems,
  rowOf: (key) => bodyLayout.value?.rows.get(key),
  reportContentHeight: (key, height) => {
    if (Math.abs((contentHeights.get(key) ?? 0) - height) > 0.5)
      contentHeights.set(key, height)
  }
})

watch(
  [() => canvasStore.rootGraphId, () => nodeData.id, slotAnchors],
  ([rootGraphId, id, anchors], _, onCleanup) => {
    if (!rootGraphId) return
    setDerivedSlotAnchors(rootGraphId, id, anchors)
    onCleanup(() => setDerivedSlotAnchors(rootGraphId, id, undefined))
  },
  { immediate: true }
)
watch(bodyLayout, () => canvasStore.canvas?.setDirty(true, true))
</script>
