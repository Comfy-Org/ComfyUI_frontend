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
          'opacity-50 before:rounded-2xl before:pointer-events-none before:absolute before:inset-0':
            muted,
          'will-change-transform': isDragging
        },

        shouldHandleNodePointerEvents
          ? 'pointer-events-auto'
          : 'pointer-events-none'
      )
    "
    :style="[
      {
        transform: `translate(${position.x ?? 0}px, ${(position.y ?? 0) - LiteGraph.NODE_TITLE_HEIGHT}px)`,
        zIndex: zIndex,
        backgroundColor: nodeBodyBackgroundColor
      },
      dragStyle
    ]"
    v-bind="pointerHandlers"
    @wheel="handleWheel"
    @contextmenu="handleContextMenu"
  >
    <div class="flex items-center">
      <template v-if="isCollapsed">
        <SlotConnectionDot multi class="absolute left-0 -translate-x-1/2" />
        <SlotConnectionDot multi class="absolute right-0 translate-x-1/2" />
      </template>
      <NodeHeader
        v-memo="[
          nodeData.title,
          nodeData.color,
          nodeData.bgcolor,
          isCollapsed,
          nodeData.flags?.pinned
        ]"
        :node-data="nodeData"
        :readonly="readonly"
        :collapsed="isCollapsed"
        @collapse="handleCollapse"
        @update:title="handleHeaderTitleUpdate"
        @enter-subgraph="handleEnterSubgraph"
      />
    </div>

    <div
      v-if="isCollapsed && executing && progress !== undefined"
      :class="
        cn(
          'absolute inset-x-4 -bottom-[1px] translate-y-1/2 rounded-full',
          progressClasses
        )
      "
      :style="{ width: `${Math.min(progress * 100, 100)}%` }"
    />

    <template v-if="!isCollapsed">
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
          v-memo="[nodeData.inputs?.length, nodeData.outputs?.length]"
          :node-data="nodeData"
          :readonly="readonly"
        />

        <!-- Widgets rendered at reduced+ detail -->
        <NodeWidgets
          v-if="nodeData.widgets?.length"
          v-memo="[nodeData.widgets?.length]"
          :node-data="nodeData"
          :readonly="readonly"
        />

        <!-- Custom content at reduced+ detail -->
        <NodeContent
          v-if="hasCustomContent"
          :node-data="nodeData"
          :readonly="readonly"
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
import { storeToRefs } from 'pinia'
import { computed, inject, onErrorCaptured, onMounted, provide, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { toggleNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { TransformStateKey } from '@/renderer/core/layout/injectionKeys'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import { useNodeExecutionState } from '@/renderer/extensions/vueNodes/execution/useNodeExecutionState'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'
import { useNodePreviewState } from '@/renderer/extensions/vueNodes/preview/useNodePreviewState'
import { app } from '@/scripts/app'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'
import {
  getLocatorIdFromNodeData,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'
import { cn } from '@/utils/tailwindUtil'

import NodeContent from './NodeContent.vue'
import NodeHeader from './NodeHeader.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'
import SlotConnectionDot from './SlotConnectionDot.vue'

// Extended props for main node component
interface LGraphNodeProps {
  nodeData: VueNodeData
  readonly?: boolean
  error?: string | null
  zoomLevel?: number
}

const {
  nodeData,
  error = null,
  readonly = false
} = defineProps<LGraphNodeProps>()

const {
  handleNodeCollapse,
  handleNodeTitleUpdate,
  handleNodeSelect,
  handleNodeRightClick
} = useNodeEventHandlers()

useVueElementTracking(() => nodeData.id, 'node')

const { selectedNodeIds } = storeToRefs(useCanvasStore())

// Inject transform state for coordinate conversion
const transformState = inject(TransformStateKey)

// Computed selection state - only this node re-evaluates when its selection changes
const isSelected = computed(() => {
  return selectedNodeIds.value.has(nodeData.id)
})

// Use execution state composable
const { executing, progress } = useNodeExecutionState(() => nodeData.id)

// Direct access to execution store for error state
const executionStore = useExecutionStore()
const hasExecutionError = computed(
  () => executionStore.lastExecutionErrorNodeId === nodeData.id
)

// Computed error states for styling
const hasAnyError = computed((): boolean => {
  return !!(
    hasExecutionError.value ||
    nodeData.hasErrors ||
    error ||
    // Type assertions needed because VueNodeData.inputs/outputs are typed as unknown[]
    // but at runtime they contain INodeInputSlot/INodeOutputSlot objects
    nodeData.inputs?.some((slot) => slot?.hasErrors) ||
    nodeData.outputs?.some((slot) => slot?.hasErrors)
  )
})

const bypassed = computed((): boolean => nodeData.mode === 4)
const muted = computed((): boolean => nodeData.mode === 2) // NEVER mode

// Node body background color that exactly replicates LiteGraph's drawNode logic
const nodeBodyBackgroundColor = computed(() => {
  const colorPaletteStore = useColorPaletteStore()
  const settingStore = useSettingStore()

  // This replicates the drawNode logic for bgColor
  let bgColor = nodeData.bgcolor || '' // matches: old_bgcolor || LiteGraph.NODE_DEFAULT_BGCOLOR

  if (!bgColor) return '' // No color to adjust

  // Apply the exact same adjustments as the drawNode monkey patch
  const adjustments: { lightness?: number; opacity?: number } = {}

  // 1. Apply opacity setting (same as drawNode)
  const opacity = settingStore.get('Comfy.Node.Opacity')
  if (opacity) adjustments.opacity = opacity

  // 2. Apply light theme background lightening (same as drawNode)
  if (colorPaletteStore.completedActivePalette.light_theme) {
    // This matches: "if (old_bgcolor) adjustments.lightness = 0.5"
    adjustments.lightness = 0.5
  }

  // Apply all adjustments at once: node.bgcolor = adjustColor(bgColor, adjustments)
  if (Object.keys(adjustments).length > 0) {
    bgColor = adjustColor(bgColor, adjustments)
  }

  return bgColor
})

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

// Use layout system for node position and dragging
const { position, size, zIndex, resize } = useNodeLayout(() => nodeData.id)
const { pointerHandlers, isDragging, dragStyle } = useNodePointerInteractions(
  () => nodeData,
  handleNodeSelect
)

// Handle right-click context menu
const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()

  // First handle the standard right-click behavior (selection)
  handleNodeRightClick(event as PointerEvent, nodeData)

  // Show the node options menu at the cursor position
  const targetElement = event.currentTarget as HTMLElement
  if (targetElement) {
    toggleNodeOptions(event, targetElement, false)
  }
}

onMounted(() => {
  if (size.value && transformState?.camera) {
    const scale = transformState.camera.z
    const screenSize = {
      width: size.value.width * scale,
      height: size.value.height * scale
    }
    resize(screenSize)
  }
})

// Track collapsed state
const isCollapsed = computed(() => nodeData.flags?.collapsed ?? false)

// Check if node has custom content (like image outputs)
const hasCustomContent = computed(() => {
  // Show custom content if node has image outputs
  return nodeImageUrls.value.length > 0
})

// Computed classes and conditions for better reusability
const separatorClasses =
  'bg-sand-100 dark-theme:bg-charcoal-600 h-px mx-0 w-full lod-toggle'
const progressClasses = 'h-2 bg-primary-500 transition-all duration-300'

const { latestPreviewUrl, shouldShowPreviewImg } = useNodePreviewState(
  () => nodeData.id,
  {
    isCollapsed
  }
)

const borderClass = computed(() => {
  if (hasAnyError.value) {
    return 'border-error dark-theme:border-error'
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
    return 'outline-error dark-theme:outline-error'
  }
  if (executing.value) {
    return 'outline-blue-500 dark-theme:outline-blue-500'
  }
  return 'outline-black dark-theme:outline-white'
})

// Event handlers
const handleCollapse = () => {
  handleNodeCollapse(nodeData.id, !isCollapsed.value)
}

const handleHeaderTitleUpdate = (newTitle: string) => {
  handleNodeTitleUpdate(nodeData.id, newTitle)
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

const nodeOutputLocatorId = computed(() =>
  nodeData.subgraphId ? `${nodeData.subgraphId}:${nodeData.id}` : nodeData.id
)
const nodeImageUrls = computed(() => {
  const newOutputs = nodeOutputs.nodeOutputs[nodeOutputLocatorId.value]
  const locatorId = getLocatorIdFromNodeData(nodeData)

  // Use root graph for getNodeByLocatorId since it needs to traverse from root
  const rootGraph = app.graph?.rootGraph || app.graph
  if (!rootGraph) {
    return []
  }

  const node = getNodeByLocatorId(rootGraph, locatorId)

  if (node && newOutputs?.images?.length) {
    const urls = nodeOutputs.getNodeImageUrls(node)
    if (urls) {
      return urls
    }
  }
  // Clear URLs if no outputs or no images
  return []
})

const nodeContainerRef = ref()
provide('tooltipContainer', nodeContainerRef)
</script>
