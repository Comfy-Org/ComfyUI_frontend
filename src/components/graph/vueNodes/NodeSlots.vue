<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Slots Error
  </div>
  <div v-else class="lg-node-slots">
    <!-- For now, render slots info as text to see what's there -->
    <div v-if="nodeInfo?.inputs?.length" class="mb-2">
      <div class="text-xs text-gray-400 mb-1">Inputs:</div>
      <div
        v-for="(input, index) in nodeInfo.inputs"
        :key="`input-${index}`"
        class="text-xs text-gray-300"
      >
        {{ getInputName(input, index) }} ({{ getInputType(input) }})
      </div>
    </div>

    <div v-if="nodeInfo?.outputs?.length">
      <div class="text-xs text-gray-400 mb-1">Outputs:</div>
      <div
        v-for="(output, index) in nodeInfo.outputs"
        :key="`output-${index}`"
        class="text-xs text-gray-300"
      >
        {{ getOutputName(output, index) }} ({{ getOutputType(output) }})
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import { computed, onErrorCaptured, ref } from 'vue'

// import InputSlot from './InputSlot.vue'
// import OutputSlot from './OutputSlot.vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'

interface NodeSlotsProps {
  node?: LGraphNode // For backwards compatibility
  nodeData?: VueNodeData // New clean data structure
  readonly?: boolean
}

const props = defineProps<NodeSlotsProps>()

const nodeInfo = computed(() => props.nodeData || props.node)

const getInputName = (input: unknown, index: number): string => {
  const inputObj = input as { name?: string } | null | undefined
  return inputObj?.name || `Input ${index}`
}

const getInputType = (input: unknown): string => {
  const inputObj = input as { type?: string } | null | undefined
  return inputObj?.type || 'any'
}

const getOutputName = (output: unknown, index: number): string => {
  const outputObj = output as { name?: string } | null | undefined
  return outputObj?.name || `Output ${index}`
}

const getOutputType = (output: unknown): string => {
  const outputObj = output as { type?: string } | null | undefined
  return outputObj?.type || 'any'
}

// Error boundary implementation
const renderError = ref<string | null>(null)

onErrorCaptured((error) => {
  renderError.value = error.message
  console.error('Vue node slots error:', error)
  return false
})
</script>
