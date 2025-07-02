<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Render Error
  </div>
  <div
    v-else
    :class="[
      'lg-node absolute border-2 rounded',
      'contain-layout contain-style contain-paint',
      selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-600',
      executing ? 'animate-pulse' : '',
      nodeData.mode === 4 ? 'opacity-50' : '', // bypassed
      error ? 'border-red-500 bg-red-50' : '',
      isDragging ? 'will-change-transform' : ''
    ]"
    :style="{
      transform: `translate(${position?.x ?? 0}px, ${position?.y ?? 0}px)`,
      width: size ? `${size.width}px` : '200px',
      height: size ? `${size.height}px` : 'auto',
      backgroundColor: '#353535'
    }"
    @pointerdown="handlePointerDown"
  >
    <!-- Header only updates on title/color changes -->
    <NodeHeader
      v-memo="[nodeData.title]"
      :node-data="nodeData"
      :readonly="readonly"
      @collapse="handleCollapse"
    />

    <!-- Node Body -->
    <div class="flex flex-col gap-2 p-2">
      <!-- Slots only update when connections change -->
      <NodeSlots
        v-memo="[nodeData.inputs?.length, nodeData.outputs?.length]"
        :node-data="nodeData"
        :readonly="readonly"
        @slot-click="handleSlotClick"
      />

      <!-- Widgets update on value changes -->
      <NodeWidgets
        v-if="nodeData.widgets?.length"
        v-memo="[nodeData.widgets?.length]"
        :node-data="nodeData"
        :readonly="readonly"
      />

      <!-- Custom content area -->
      <NodeContent
        v-if="hasCustomContent"
        :node-data="nodeData"
        :readonly="readonly"
      />

      <!-- Placeholder if no widgets -->
      <div
        v-if="!nodeData.widgets?.length && !hasCustomContent"
        class="text-gray-500 text-sm text-center py-4"
      >
        No widgets
      </div>
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
import { computed, onErrorCaptured, ref } from 'vue'

// Import the VueNodeData type
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'

import NodeContent from './NodeContent.vue'
import NodeHeader from './NodeHeader.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'

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
  collapse: []
}>()

// Error boundary implementation
const renderError = ref<string | null>(null)

onErrorCaptured((error) => {
  renderError.value = error.message
  console.error('Vue node component error:', error)
  return false // Prevent error propagation
})

// Track dragging state for will-change optimization
const isDragging = ref(false)

// Check if node has custom content
const hasCustomContent = computed(() => {
  // Currently all content is handled through widgets
  // This remains false but provides extensibility point
  return false
})

// Event handlers
const handlePointerDown = (event: PointerEvent) => {
  emit('node-click', event, props.nodeData!)
}

const handleCollapse = () => {
  emit('collapse')
}

const handleSlotClick = (
  event: PointerEvent,
  slotIndex: number,
  isInput: boolean
) => {
  emit('slot-click', event, props.nodeData!, slotIndex, isInput)
}

// Expose methods for parent to control dragging state
defineExpose({
  setDragging(dragging: boolean) {
    isDragging.value = dragging
  }
})
</script>
