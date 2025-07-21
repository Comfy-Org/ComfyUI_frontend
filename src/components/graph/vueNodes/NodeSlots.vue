<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Slots Error
  </div>
  <div v-else class="lg-node-slots flex justify-between">
    <div v-if="nodeInfo?.inputs?.length" class="flex flex-col">
      <div
        v-for="(input, index) in nodeInfo.inputs"
        :key="`input-${index}`"
        class="text-xs text-gray-300"
      >
        {{ getInputName(input, index) }}
      </div>
    </div>

    <div v-if="nodeInfo?.outputs?.length" class="flex flex-col ml-auto">
      <div
        v-for="(output, index) in nodeInfo.outputs"
        :key="`output-${index}`"
        class="text-xs text-gray-300 text-right"
      >
        {{ getOutputName(output, index) }}
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
import type { LODLevel } from '@/composables/graph/useLOD'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { isSlotObject } from '@/utils/typeGuardUtil'

interface NodeSlotsProps {
  node?: LGraphNode // For backwards compatibility
  nodeData?: VueNodeData // New clean data structure
  readonly?: boolean
  lodLevel?: LODLevel
}

const props = defineProps<NodeSlotsProps>()

const nodeInfo = computed(() => props.nodeData || props.node)

const getInputName = (input: unknown, index: number): string => {
  if (isSlotObject(input) && input.name) {
    return input.name
  }
  return `Input ${index}`
}

// const getInputType = (input: unknown): string => {
//   if (isSlotObject(input) && input.type) {
//     return input.type
//   }
//   return 'any'
// }

const getOutputName = (output: unknown, index: number): string => {
  if (isSlotObject(output) && output.name) {
    return output.name
  }
  return `Output ${index}`
}

// const getOutputType = (output: unknown): string => {
//   if (isSlotObject(output) && output.type) {
//     return output.type
//   }
//   return 'any'
// }

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})
</script>
