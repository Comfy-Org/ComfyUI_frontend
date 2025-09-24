<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    {{ $t('Node Render Error') }}
  </div>
  <NodeBaseTemplate
    v-else
    :node-data="nodeData"
    :readonly="readonly"
    :container-classes="containerClasses"
    :container-style="containerStyle"
    :is-collapsed="isCollapsed"
    :separator-classes="separatorClasses"
    :progress-classes="progressClasses"
    :progress-bar-classes="progressBarClasses"
    :show-progress="showProgress"
    :progress-value="progress"
    :progress-style="progressStyle"
    :progress-bar-style="progressBarStyle"
    :has-custom-content="hasCustomContent"
    :image-urls="nodeImageUrls"
    :show-preview-image="shouldShowPreviewImg"
    :preview-image-url="latestPreviewUrl"
    :event-handlers="{
      onPointerdown: handlePointerDown,
      onPointermove: handlePointerMove,
      onPointerup: handlePointerUp,
      onWheel: handleWheel
    }"
    @collapse="handleCollapse"
    @update:title="handleHeaderTitleUpdate"
    @enter-subgraph="handleEnterSubgraph"
  />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, inject, onErrorCaptured, onMounted, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
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
import {
  getLocatorIdFromNodeData,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'
import { cn } from '@/utils/tailwindUtil'

import NodeBaseTemplate from './NodeBaseTemplate.vue'

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

const { handleNodeCollapse, handleNodeTitleUpdate, handleNodeSelect } =
  useNodeEventHandlers()

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
const hasAnyError = computed(
  (): boolean => !!(hasExecutionError.value || nodeData.hasErrors || error)
)

const bypassed = computed((): boolean => nodeData.mode === 4)

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
const {
  handlePointerDown,
  handlePointerUp,
  handlePointerMove,
  isDragging,
  dragStyle
} = useNodePointerInteractions(() => nodeData, handleNodeSelect)

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

// Collapsed state
const isCollapsed = computed(() => nodeData.flags?.collapsed ?? false)

// Show progress when executing with defined progress
const showProgress = computed(() => {
  return !!(executing.value && progress.value !== undefined)
})

// Progress styles
const progressStyle = computed(() => {
  if (!showProgress.value || !progress.value) return undefined
  return { width: `${Math.min(progress.value * 100, 100)}%` }
})

const progressBarStyle = progressStyle

// Border class based on state
const borderClass = computed(() => {
  if (hasAnyError.value) {
    return 'border-error'
  }
  if (executing.value) {
    return 'border-blue-500'
  }
  return undefined
})

// Outline class based on selection and state
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

// Container classes
const containerClasses = computed(() => {
  return cn(
    'bg-white dark-theme:bg-charcoal-800',
    'lg-node absolute rounded-2xl',
    'border border-solid border-sand-100 dark-theme:border-charcoal-600',
    // hover (only when node should handle events)
    shouldHandleNodePointerEvents.value &&
      'hover:ring-7 ring-gray-500/50 dark-theme:ring-gray-500/20',
    'outline-transparent -outline-offset-2 outline-2',
    borderClass.value,
    outlineClass.value,
    {
      'animate-pulse': executing.value,
      'opacity-50 before:rounded-2xl before:pointer-events-none before:absolute before:bg-bypass/60 before:inset-0':
        bypassed.value,
      'will-change-transform': isDragging.value
    },
    shouldHandleNodePointerEvents.value
      ? 'pointer-events-auto'
      : 'pointer-events-none'
  )
})

const progressBarClasses = computed(() => {
  return cn(
    'absolute inset-x-4 -bottom-[1px] translate-y-1/2 rounded-full',
    progressClasses
  )
})

// Static classes
const separatorClasses =
  'bg-sand-100 dark-theme:bg-charcoal-600 h-px mx-0 w-full lod-toggle'
const progressClasses = 'h-2 bg-primary-500 transition-all duration-300'

// Container style combining position and drag styles
const containerStyle = computed(() => [
  {
    transform: `translate(${position.value.x ?? 0}px, ${(position.value.y ?? 0) - LiteGraph.NODE_TITLE_HEIGHT}px)`,
    zIndex: zIndex.value
  },
  dragStyle.value
])

// Check if node has custom content (like image outputs)
const hasCustomContent = computed(() => {
  // Show custom content if node has image outputs
  return nodeImageUrls.value.length > 0
})

const { latestPreviewUrl, shouldShowPreviewImg } = useNodePreviewState(
  () => nodeData.id,
  {
    isCollapsed
  }
)

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
</script>
