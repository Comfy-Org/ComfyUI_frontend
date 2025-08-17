<template>
  <!-- eslint-disable-next-line @intlify/vue-i18n/no-raw-text -->
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Render Error
  </div>
  <div
    v-else
    :data-node-id="nodeData.id"
    :class="[
      'lg-node absolute border-2 rounded-lg',
      'contain-layout contain-style contain-paint',
      selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-600',
      executing ? 'animate-pulse' : '',
      nodeData.mode === 4 ? 'opacity-50' : '', // bypassed
      error ? 'border-red-500 bg-red-50' : '',
      isDragging ? 'will-change-transform' : '',
      lodCssClass,
      'hover:border-green-500' // Debug: visual feedback on hover
    ]"
    :style="[
      {
        transform: `translate(${layoutPosition.x ?? position?.x ?? 0}px, ${(layoutPosition.y ?? position?.y ?? 0) - LiteGraph.NODE_TITLE_HEIGHT}px)`,
        width: size ? `${size.width}px` : '200px',
        height: size ? `${size.height}px` : 'auto',
        backgroundColor: '#353535',
        pointerEvents: 'auto'
      },
      dragStyle
    ]"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
  >
    <!-- Header only updates on title/color changes -->
    <NodeHeader
      v-memo="[nodeData.title, lodLevel, isCollapsed]"
      :node-data="nodeData"
      :readonly="readonly"
      :lod-level="lodLevel"
      :collapsed="isCollapsed"
      @collapse="handleCollapse"
      @update:title="handleTitleUpdate"
    />

    <!-- Node Body - rendered based on LOD level and collapsed state -->
    <div
      v-if="!isMinimalLOD && !isCollapsed"
      class="flex flex-col gap-2"
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
        v-if="shouldRenderWidgets && nodeData.widgets?.length"
        v-memo="[nodeData.widgets?.length, lodLevel]"
        :node-data="nodeData"
        :readonly="readonly"
        :lod-level="lodLevel"
      />

      <!-- Custom content at reduced+ detail -->
      <NodeContent
        v-if="shouldRenderContent && hasCustomContent"
        :node-data="nodeData"
        :readonly="readonly"
        :lod-level="lodLevel"
      />
    </div>

    <!-- Progress bar for executing state -->
    <div
      v-if="executing && progress !== undefined"
      class="absolute bottom-0 left-0 h-1 bg-primary-500 transition-all duration-300"
      :style="{ width: `${progress * 100}%` }"
    />
  </div>
</template>

<script setup lang="ts">
import log from 'loglevel'
import { computed, onErrorCaptured, ref, toRef, watch } from 'vue'

// Import the VueNodeData type
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { LODLevel, useLOD } from '@/composables/graph/useLOD'
import { useNodeLayout } from '@/composables/graph/useNodeLayout'
import { useErrorHandling } from '@/composables/useErrorHandling'

import { LiteGraph } from '../../../lib/litegraph/src/litegraph'
import NodeContent from './NodeContent.vue'
import NodeHeader from './NodeHeader.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'

// Create logger for vue nodes
const logger = log.getLogger('vue-nodes')
// In dev mode, always show debug logs
if (import.meta.env.DEV) {
  logger.setLevel('debug')
}

// Extended props for main node component
interface LGraphNodeProps {
  nodeData: VueNodeData
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  readonly?: boolean
  selected?: boolean
  executing?: boolean
  progress?: number
  error?: string | null
  zoomLevel?: number
}

const props = defineProps<LGraphNodeProps>()

const emit = defineEmits<{
  'node-click': [event: PointerEvent, nodeData: VueNodeData]
  'slot-click': [
    event: PointerEvent,
    nodeData: VueNodeData,
    slotIndex: number,
    isInput: boolean
  ]
  'update:collapsed': [nodeId: string, collapsed: boolean]
  'update:title': [nodeId: string, newTitle: string]
}>()

// LOD (Level of Detail) system based on zoom level
const zoomRef = toRef(() => props.zoomLevel ?? 1)
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
  startDrag,
  handleDrag: handleLayoutDrag,
  endDrag
} = useNodeLayout(props.nodeData.id)

// Debug layout position
watch(
  layoutPosition,
  (newPos, oldPos) => {
    logger.debug(`Layout position changed for node ${props.nodeData.id}:`, {
      newPos,
      oldPos,
      layoutPositionValue: layoutPosition.value
    })
  },
  { immediate: true, deep: true }
)

logger.debug(`LGraphNode mounted for ${props.nodeData.id}`, {
  layoutPosition: layoutPosition.value,
  propsPosition: props.position,
  nodeDataId: props.nodeData.id
})

// Drag state for styling
const isDragging = ref(false)
const dragStyle = computed(() => ({
  cursor: isDragging.value ? 'grabbing' : 'grab'
}))

// Track collapsed state
const isCollapsed = ref(props.nodeData.flags?.collapsed ?? false)

// Watch for external changes to the collapsed state
watch(
  () => props.nodeData.flags?.collapsed,
  (newCollapsed) => {
    if (newCollapsed !== undefined && newCollapsed !== isCollapsed.value) {
      isCollapsed.value = newCollapsed
    }
  }
)

// Check if node has custom content
const hasCustomContent = computed(() => {
  // Currently all content is handled through widgets
  // This remains false but provides extensibility point
  return false
})

// Event handlers
const handlePointerDown = (event: PointerEvent) => {
  if (!props.nodeData) {
    console.warn('LGraphNode: nodeData is null/undefined in handlePointerDown')
    return
  }

  // Start drag using layout system
  isDragging.value = true
  startDrag(event)

  // Emit node-click for selection handling in GraphCanvas
  emit('node-click', event, props.nodeData)
}

const handlePointerMove = (event: PointerEvent) => {
  if (isDragging.value) {
    void handleLayoutDrag(event)
  }
}

const handlePointerUp = (event: PointerEvent) => {
  if (isDragging.value) {
    isDragging.value = false
    void endDrag(event)
  }
}

const handleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  // Emit event so parent can sync with LiteGraph if needed
  emit('update:collapsed', props.nodeData.id, isCollapsed.value)
}

const handleSlotClick = (
  event: PointerEvent,
  slotIndex: number,
  isInput: boolean
) => {
  if (!props.nodeData) {
    console.warn('LGraphNode: nodeData is null/undefined in handleSlotClick')
    return
  }
  emit('slot-click', event, props.nodeData, slotIndex, isInput)
}

const handleTitleUpdate = (newTitle: string) => {
  emit('update:title', props.nodeData.id, newTitle)
}
</script>
