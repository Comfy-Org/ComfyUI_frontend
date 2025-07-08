<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Render Error
  </div>
  <div
    v-else
    :class="[
      'lg-node absolute border-2 rounded bg-surface-0',
      'contain-layout contain-style contain-paint',
      selected
        ? 'border-primary-500 ring-2 ring-primary-300'
        : 'border-surface-300',
      executing ? 'animate-pulse' : '',
      node.mode === 4 ? 'opacity-50' : '', // bypassed
      error ? 'border-red-500 bg-red-50' : '',
      isDragging ? 'will-change-transform' : ''
    ]"
    :style="{
      transform: `translate(${position.x}px, ${position.y}px)`,
      width: node.size ? `${node.size[0]}px` : 'auto',
      minWidth: '200px'
    }"
    @pointerdown="handlePointerDown"
  >
    <!-- Header only updates on title/color changes -->
    <NodeHeader
      v-memo="[node.title, node.color]"
      :node="node"
      :readonly="readonly"
      @collapse="handleCollapse"
    />

    <!-- Node Body (only visible when not collapsed) -->
    <div v-if="!node.flags?.collapsed" class="flex flex-col gap-2 p-2">
      <!-- Slots only update when connections change -->
      <NodeSlots
        v-memo="[node.inputs?.length, node.outputs?.length]"
        :node="node"
        :readonly="readonly"
        @slot-click="handleSlotClick"
      />

      <!-- Widgets update on value changes -->
      <NodeWidgets
        v-if="node.widgets?.length"
        v-memo="[
          node.widgets?.length,
          ...(node.widgets?.map((w) => w.value) ?? [])
        ]"
        :node="node"
        :readonly="readonly"
      />

      <!-- Custom content area -->
      <NodeContent v-if="hasCustomContent" :node="node" :readonly="readonly" />
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
import type { LGraphNode } from '@comfyorg/litegraph'
import { computed, onErrorCaptured, reactive, ref, watch } from 'vue'

import NodeContent from './NodeContent.vue'
import NodeHeader from './NodeHeader.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'

// Extended props for main node component
interface LGraphNodeProps {
  node: LGraphNode
  readonly?: boolean
  selected?: boolean
  executing?: boolean
  progress?: number
  error?: string | null
  zoomLevel?: number
}

const props = defineProps<LGraphNodeProps>()

const emit = defineEmits<{
  'node-click': [event: PointerEvent, node: LGraphNode]
  'slot-click': [
    event: PointerEvent,
    node: LGraphNode,
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

// Position state - initialized from node.pos but then controlled via transforms
const position = reactive({
  x: props.node.pos[0],
  y: props.node.pos[1]
})

// Track dragging state for will-change optimization
const isDragging = ref(false)

// Only update position when node.pos changes AND we're not dragging
// This prevents reflows during drag operations
watch(
  () => props.node.pos,
  (newPos) => {
    if (!isDragging.value) {
      position.x = newPos[0]
      position.y = newPos[1]
    }
  },
  { deep: true }
)

// Check if node has custom content
const hasCustomContent = computed(() => {
  // Currently all content is handled through widgets
  // This remains false but provides extensibility point
  return false
})

// Event handlers
const handlePointerDown = (event: PointerEvent) => {
  emit('node-click', event, props.node)
  // The parent component will handle setting isDragging when appropriate
}

const handleCollapse = () => {
  // Parent component should handle node mutations
  // This is just emitting the event upwards
  emit('collapse')
}

const handleSlotClick = (
  event: PointerEvent,
  slotIndex: number,
  isInput: boolean
) => {
  emit('slot-click', event, props.node, slotIndex, isInput)
}

// Expose methods for parent to control position during drag
defineExpose({
  setPosition(x: number, y: number) {
    position.x = x
    position.y = y
  },
  setDragging(dragging: boolean) {
    isDragging.value = dragging
  }
})
</script>
