<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Slots Error
  </div>
  <div v-else class="lg-node-slots relative">
    <!-- Input Slots -->
    <div
      v-if="node.inputs?.length"
      class="lg-node-slots__inputs absolute left-0 top-0 flex flex-col"
    >
      <InputSlot
        v-for="(input, index) in node.inputs"
        :key="`input-${index}`"
        :node="node"
        :slot-data="input"
        :index="index"
        :connected="isInputConnected(index)"
        :compatible="false"
        :readonly="readonly"
        @slot-click="(e) => handleSlotClick(e, index, true)"
      />
    </div>

    <!-- Output Slots -->
    <div
      v-if="node.outputs?.length"
      class="lg-node-slots__outputs absolute right-0 top-0 flex flex-col"
    >
      <OutputSlot
        v-for="(output, index) in node.outputs"
        :key="`output-${index}`"
        :node="node"
        :slot-data="output"
        :index="index"
        :connected="isOutputConnected(index)"
        :compatible="false"
        :readonly="readonly"
        @slot-click="(e) => handleSlotClick(e, index, false)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import { onErrorCaptured, ref } from 'vue'

import InputSlot from './InputSlot.vue'
import OutputSlot from './OutputSlot.vue'

interface NodeSlotsProps {
  node: LGraphNode
  readonly?: boolean
}

const props = defineProps<NodeSlotsProps>()

const emit = defineEmits<{
  'slot-click': [event: PointerEvent, slotIndex: number, isInput: boolean]
}>()

// Error boundary implementation
const renderError = ref<string | null>(null)

onErrorCaptured((error) => {
  renderError.value = error.message
  console.error('Vue node slots error:', error)
  return false
})

// Check if input slot has a connection
const isInputConnected = (index: number) => {
  return props.node.inputs?.[index]?.link != null
}

// Check if output slot has any connections
const isOutputConnected = (index: number) => {
  return (props.node.outputs?.[index]?.links?.length ?? 0) > 0
}

// Handle slot click events
const handleSlotClick = (
  event: PointerEvent,
  slotIndex: number,
  isInput: boolean
) => {
  emit('slot-click', event, slotIndex, isInput)
}
</script>
