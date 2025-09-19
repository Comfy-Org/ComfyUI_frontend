<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    {{ $t('Node Render Error') }}
  </div>
  <div
    v-else
    ref="nodeContainerRef"
    :data-node-id="nodeData.id"
    :class="
      cn(
        'bg-white dark-theme:bg-charcoal-800',
        'lg-node absolute rounded-2xl',
        'border border-solid border-sand-100 dark-theme:border-charcoal-600',
        // hover (only when node should handle events)
        shouldHandleNodePointerEvents &&
          'hover:ring-7 ring-gray-500/50 dark-theme:ring-gray-500/20',
        'outline-transparent -outline-offset-2 outline-2',
        borderClass,
        outlineClass,
        {
          'animate-pulse': executing,
          'opacity-50 before:rounded-2xl before:pointer-events-none before:absolute before:bg-bypass/60 before:inset-0':
            bypassed,
          'will-change-transform': isDragging
        },
        lodCssClass,
        shouldHandleNodePointerEvents
          ? 'pointer-events-auto'
          : 'pointer-events-none'
      )
    "
    :style="[
      {
        transform: `translate(${layoutPosition.x ?? position?.x ?? 0}px, ${(layoutPosition.y ?? position?.y ?? 0) - LiteGraph.NODE_TITLE_HEIGHT}px)`,
        zIndex: zIndex
      },
      dragStyle
    ]"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @wheel="handleWheel"
  >
    <div class="flex items-center">
      <template v-if="isCollapsed">
        <SlotConnectionDot multi class="absolute left-0 -translate-x-1/2" />
        <SlotConnectionDot multi class="absolute right-0 translate-x-1/2" />
      </template>
      <!-- Header only updates on title/color changes -->
      <NodeHeader
        v-memo="[nodeData.title, lodLevel, isCollapsed]"
        :node-data="nodeData"
        :readonly="readonly"
        :lod-level="lodLevel"
        :collapsed="isCollapsed"
        @collapse="handleCollapse"
        @update:title="handleTitleUpdate"
        @enter-subgraph="handleEnterSubgraph"
      />
    </div>

    <div
      v-if="
        (isMinimalLOD || isCollapsed) && executing && progress !== undefined
      "
      :class="
        cn(
          'absolute inset-x-4 -bottom-[1px] translate-y-1/2 rounded-full',
          progressClasses
        )
      "
      :style="{ width: `${Math.min(progress * 100, 100)}%` }"
    />

    <template v-if="!isMinimalLOD && !isCollapsed">
      <div class="mb-4 relative">
        <div :class="separatorClasses" />
        <!-- Progress bar for executing state -->
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

      <!-- Node Body - rendered based on LOD level and collapsed state -->
      <div
        class="flex flex-col gap-4 pb-4"
        :data-testid="`node-body-${nodeData.id}`"
      >
        <!-- Slots only rendered at full detail -->
        <NodeSlots
          v-if="shouldRenderSlots"
          v-memo="[nodeData.inputs?.length, nodeData.outputs?.length, lodLevel]"
          :node-data="nodeData"
          :readonly="readonly"
          :lod-level="lodLevel"
          @slot-click="handleSlotClick"
        />

        <!-- Widgets rendered at reduced+ detail -->
        <NodeWidgets
          v-if="shouldShowWidgets"
          v-memo="[nodeData.widgets?.length, lodLevel]"
          :node-data="nodeData"
          :readonly="readonly"
          :lod-level="lodLevel"
        />

        <!-- Custom content at reduced+ detail -->
        <NodeContent
          v-if="shouldShowContent"
          :node-data="nodeData"
          :readonly="readonly"
          :lod-level="lodLevel"
          :image-urls="nodeImageUrls"
        />
        <!-- Live preview image -->
        <div
          v-if="shouldShowPreviewImg"
          v-memo="[latestPreviewUrl]"
          class="px-4"
        >
          <img
            :src="latestPreviewUrl"
            alt="preview"
            class="w-full max-h-64 object-contain"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  onErrorCaptured,
  onMounted,
  provide,
  ref,
  toRef,
  watch
} from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { SelectedNodeIdsKey } from '@/renderer/core/canvas/injectionKeys'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { TransformStateKey } from '@/renderer/core/layout/injectionKeys'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeExecutionState } from '@/renderer/extensions/vueNodes/execution/useNodeExecutionState'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'
import { LODLevel, useLOD } from '@/renderer/extensions/vueNodes/lod/useLOD'
import { useNodePreviewState } from '@/renderer/extensions/vueNodes/preview/useNodePreviewState'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { app } from '@/scripts/app'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import {
  getLocatorIdFromNodeData,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'
import { cn } from '@/utils/tailwindUtil'

import { useVueElementTracking } from '../composables/useVueNodeResizeTracking'
import NodeContent from './NodeContent.vue'
import NodeHeader from './NodeHeader.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'
import SlotConnectionDot from './SlotConnectionDot.vue'

// Extended props for main node component
interface LGraphNodeProps {
  nodeData: VueNodeData
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  readonly?: boolean
  error?: string | null
  zoomLevel?: number
}

const {
  nodeData,
  position,
  size,
  error = null,
  readonly = false,
  zoomLevel = 1
} = defineProps<LGraphNodeProps>()

const emit = defineEmits<{
  'node-click': [
    event: PointerEvent,
    nodeData: VueNodeData,
    wasDragging: boolean
  ]
  'slot-click': [
    event: PointerEvent,
    nodeData: VueNodeData,
    slotIndex: number,
    isInput: boolean
  ]
  dragStart: [event: DragEvent, nodeData: VueNodeData]
  'update:collapsed': [nodeId: string, collapsed: boolean]
  'update:title': [nodeId: string, newTitle: string]
}>()

useVueElementTracking(nodeData.id, 'node')

// Inject selection state from parent
const selectedNodeIds = inject(SelectedNodeIdsKey)
if (!selectedNodeIds) {
  throw new Error(
    'SelectedNodeIds not provided - LGraphNode must be used within a component that provides selection state'
  )
}

// Inject transform state for coordinate conversion
const transformState = inject(TransformStateKey)

// Computed selection state - only this node re-evaluates when its selection changes
const isSelected = computed(() => {
  return selectedNodeIds.value.has(nodeData.id)
})

// Use execution state composable
const { executing, progress } = useNodeExecutionState(nodeData.id)

// Direct access to execution store for error state
const executionStore = useExecutionStore()
const hasExecutionError = computed(
  () => executionStore.lastExecutionErrorNodeId === nodeData.id
)

// Computed error states for styling
const hasAnyError = computed(
  (): boolean => !!(hasExecutionError.value || nodeData.hasErrors || error)
)

const bypassed = computed((): boolean => nodeData.mode === 4)

// Use canvas interactions for proper wheel event handling and pointer event capture control
const {
  handleWheel,
  handlePointer,
  forwardEventToCanvas,
  shouldHandleNodePointerEvents
} = useCanvasInteractions()

// LOD (Level of Detail) system based on zoom level
const zoomRef = toRef(() => zoomLevel)
const {
  lodLevel,
  shouldRenderWidgets,
  shouldRenderSlots,
  shouldRenderContent,
  lodCssClass
} = useLOD(zoomRef)

// Computed properties for template usage
const isMinimalLOD = computed(() => lodLevel.value === LODLevel.MINIMAL)

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false // Prevent error propagation
})

// Use layout system for node position and dragging
const {
  position: layoutPosition,
  zIndex,
  startDrag,
  handleDrag: handleLayoutDrag,
  endDrag,
  resize
} = useNodeLayout(nodeData.id)

onMounted(() => {
  if (size && transformState?.camera) {
    const scale = transformState.camera.z
    const screenSize = {
      width: size.width * scale,
      height: size.height * scale
    }
    resize(screenSize)
  }
})

// Drag state for styling
const isDragging = ref(false)
const dragStyle = computed(() => ({
  cursor: isDragging.value ? 'grabbing' : 'grab'
}))
const lastY = ref(0)
const lastX = ref(0)
// Treat tiny pointer jitter as a click, not a drag
const DRAG_THRESHOLD_PX = 4

// Track collapsed state
const isCollapsed = ref(nodeData.flags?.collapsed ?? false)

// Watch for external changes to the collapsed state
watch(
  () => nodeData.flags?.collapsed,
  (newCollapsed: boolean | undefined) => {
    if (newCollapsed !== undefined && newCollapsed !== isCollapsed.value) {
      isCollapsed.value = newCollapsed
    }
  }
)

// Check if node has custom content (like image outputs)
const hasCustomContent = computed(() => {
  // Show custom content if node has image outputs
  return nodeImageUrls.value.length > 0
})

// Computed classes and conditions for better reusability
const separatorClasses =
  'bg-sand-100 dark-theme:bg-charcoal-600 h-px mx-0 w-full'
const progressClasses = 'h-2 bg-primary-500 transition-all duration-300'

const { latestPreviewUrl, shouldShowPreviewImg } = useNodePreviewState(
  nodeData.id,
  {
    isMinimalLOD,
    isCollapsed
  }
)

// Common condition computations to avoid repetition
const shouldShowWidgets = computed(
  () => shouldRenderWidgets.value && nodeData.widgets?.length
)

const shouldShowContent = computed(
  () => shouldRenderContent.value && hasCustomContent.value
)

const borderClass = computed(() => {
  if (hasAnyError.value) {
    return 'border-error'
  }
  if (executing.value) {
    return 'border-blue-500'
  }
  return undefined
})

const outlineClass = computed(() => {
  if (!isSelected.value) {
    return undefined
  }
  if (hasAnyError.value) {
    return 'outline-error'
  }
  if (executing.value) {
    return 'outline-blue-500'
  }
  return 'outline-black dark-theme:outline-white'
})

// Event handlers
const handlePointerDown = (event: PointerEvent) => {
  if (!nodeData) {
    console.warn('LGraphNode: nodeData is null/undefined in handlePointerDown')
    return
  }

  // Don't handle pointer events when canvas is in panning mode - forward to canvas instead
  if (!shouldHandleNodePointerEvents.value) {
    forwardEventToCanvas(event)
    return
  }

  // Start drag using layout system
  isDragging.value = true

  // Set Vue node dragging state for selection toolbox
  layoutStore.isDraggingVueNodes.value = true

  startDrag(event)
  lastY.value = event.clientY
  lastX.value = event.clientX
}

const handlePointerMove = (event: PointerEvent) => {
  // Check if this should be forwarded to canvas (e.g., space panning, middle mouse)
  handlePointer(event)

  if (isDragging.value) {
    void handleLayoutDrag(event)
  }
}

const handlePointerUp = (event: PointerEvent) => {
  if (isDragging.value) {
    isDragging.value = false
    void endDrag(event)

    // Clear Vue node dragging state for selection toolbox
    layoutStore.isDraggingVueNodes.value = false
  }

  // Don't emit node-click when canvas is in panning mode - forward to canvas instead
  if (!shouldHandleNodePointerEvents.value) {
    forwardEventToCanvas(event)
    return
  }

  // Emit node-click for selection handling in GraphCanvas
  const dx = event.clientX - lastX.value
  const dy = event.clientY - lastY.value
  const wasDragging = Math.hypot(dx, dy) > DRAG_THRESHOLD_PX
  emit('node-click', event, nodeData, wasDragging)
}

const handleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  // Emit event so parent can sync with LiteGraph if needed
  emit('update:collapsed', nodeData.id, isCollapsed.value)
}

const handleSlotClick = (
  event: PointerEvent,
  slotIndex: number,
  isInput: boolean
) => {
  if (!nodeData) {
    console.warn('LGraphNode: nodeData is null/undefined in handleSlotClick')
    return
  }

  // Don't handle slot clicks when canvas is in panning mode
  if (!shouldHandleNodePointerEvents.value) {
    return
  }

  emit('slot-click', event, nodeData, slotIndex, isInput)
}

const handleTitleUpdate = (newTitle: string) => {
  emit('update:title', nodeData.id, newTitle)
}

const handleEnterSubgraph = () => {
  const graph = app.graph?.rootGraph || app.graph
  if (!graph) {
    console.warn('LGraphNode: No graph available for subgraph navigation')
    return
  }

  const locatorId = getLocatorIdFromNodeData(nodeData)

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

  canvas.openSubgraph(litegraphNode.subgraph)
}

const nodeOutputs = useNodeOutputStore()

const nodeImageUrls = ref<string[]>([])
const onNodeOutputsUpdate = (newOutputs: ExecutedWsMessage['output']) => {
  const locatorId = getLocatorIdFromNodeData(nodeData)

  // Use root graph for getNodeByLocatorId since it needs to traverse from root
  const rootGraph = app.graph?.rootGraph || app.graph
  if (!rootGraph) {
    nodeImageUrls.value = []
    return
  }

  const node = getNodeByLocatorId(rootGraph, locatorId)

  if (node && newOutputs?.images?.length) {
    const urls = nodeOutputs.getNodeImageUrls(node)
    if (urls) {
      nodeImageUrls.value = urls
    }
  } else {
    // Clear URLs if no outputs or no images
    nodeImageUrls.value = []
  }
}

const nodeOutputLocatorId = computed(() =>
  nodeData.subgraphId ? `${nodeData.subgraphId}:${nodeData.id}` : nodeData.id
)

watch(
  () => nodeOutputs.nodeOutputs[nodeOutputLocatorId.value],
  (newOutputs) => {
    onNodeOutputsUpdate(newOutputs)
  },
  { deep: true }
)

// Template ref for tooltip positioning
const nodeContainerRef = ref<HTMLElement>()

// Provide nodeImageUrls and tooltip container to child components
provide('nodeImageUrls', nodeImageUrls)
provide('tooltipContainer', nodeContainerRef)
</script>
