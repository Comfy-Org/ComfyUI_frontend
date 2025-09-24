<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    {{ $t('Node Render Error') }}
  </div>
  <NodeBaseTemplate
    v-else
    :node-data="nodeData"
    :readonly="readonly"
    :container-classes="presentation.containerBaseClasses.value"
    :container-style="containerStyle"
    :is-collapsed="presentation.isCollapsed.value"
    :separator-classes="presentation.separatorClasses"
    :progress-classes="presentation.progressClasses"
    :progress-bar-classes="presentation.progressBarClasses.value"
    :show-progress="presentation.showProgress.value"
    :progress-value="progress"
    :progress-style="presentation.progressStyle.value"
    :progress-bar-style="presentation.progressBarStyle.value"
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
import { useNodePresentation } from '@/renderer/extensions/vueNodes/composables/useNodePresentation'
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

// Use the new presentation composable
const presentation = useNodePresentation(() => nodeData, {
  readonly,
  isPreview: false,
  isSelected,
  executing,
  progress,
  hasExecutionError,
  hasAnyError,
  bypassed,
  isDragging,
  shouldHandleNodePointerEvents
})

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
    isCollapsed: presentation.isCollapsed
  }
)

// Event handlers
const handleCollapse = () => {
  handleNodeCollapse(nodeData.id, !presentation.isCollapsed.value)
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
