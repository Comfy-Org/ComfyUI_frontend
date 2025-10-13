<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ $t('Node Slots Error') }}
  </div>
  <div v-else class="lg-node-slots flex justify-between">
    <div v-if="filteredInputs.length" class="flex flex-col gap-1">
      <InputSlot
        v-for="(input, index) in filteredInputs"
        :key="`input-${index}`"
        :slot-data="input"
        :node-type="nodeData?.type || ''"
        :node-id="nodeData?.id != null ? String(nodeData.id) : ''"
        :index="getActualInputIndex(input, index)"
      />
    </div>

    <div v-if="nodeData?.outputs?.length" class="ml-auto flex flex-col gap-1">
      <OutputSlot
        v-for="(output, index) in nodeData.outputs"
        :key="`output-${index}`"
        :slot-data="output"
        :node-type="nodeData?.type || ''"
        :node-id="nodeData?.id != null ? String(nodeData.id) : ''"
        :index="index"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { isSlotObject } from '@/utils/typeGuardUtil'

import InputSlot from './InputSlot.vue'
import OutputSlot from './OutputSlot.vue'

interface NodeSlotsProps {
  nodeData?: VueNodeData
}

const { nodeData = null } = defineProps<NodeSlotsProps>()

// Filter out input slots that have corresponding widgets
const filteredInputs = computed(() => {
  if (!nodeData?.inputs) return []

  return nodeData.inputs
    .filter((input) => {
      // Check if this slot has a widget property (indicating it has a corresponding widget)
      if (isSlotObject(input) && 'widget' in input && input.widget) {
        // This slot has a widget, so we should not display it separately
        return false
      }
      return true
    })
    .map((input) =>
      isSlotObject(input)
        ? input
        : ({
            name: typeof input === 'string' ? input : '',
            type: 'any',
            boundingRect: [0, 0, 0, 0] as [number, number, number, number]
          } as INodeSlot)
    )
})

// Get the actual index of an input slot in the node's inputs array
// (accounting for filtered widget slots)
const getActualInputIndex = (
  input: INodeSlot,
  filteredIndex: number
): number => {
  if (!nodeData?.inputs) return filteredIndex

  // Find the actual index in the unfiltered inputs array
  const actualIndex = nodeData.inputs.findIndex((i) => i === input)
  return actualIndex !== -1 ? actualIndex : filteredIndex
}

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})
</script>
