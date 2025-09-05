<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    {{ $t('Node Slots Error') }}
  </div>
  <div v-else class="lg-node-slots flex justify-between">
    <div v-if="filteredInputs.length" class="flex flex-col gap-1">
      <InputSlot
        v-for="(input, index) in filteredInputs"
        :key="`input-${index}`"
        :slot-data="input"
        :node-id="nodeInfo?.id != null ? String(nodeInfo.id) : ''"
        :index="getActualInputIndex(input, index)"
        :readonly="readonly"
      />
    </div>

    <div v-if="filteredOutputs.length" class="flex flex-col gap-1 ml-auto">
      <OutputSlot
        v-for="(output, index) in filteredOutputs"
        :key="`output-${index}`"
        :slot-data="output"
        :node-id="nodeInfo?.id != null ? String(nodeInfo.id) : ''"
        :index="index"
        :readonly="readonly"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import type { INodeSlot, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LODLevel } from '@/renderer/extensions/vueNodes/lod/useLOD'
import { isSlotObject } from '@/utils/typeGuardUtil'

import InputSlot from './InputSlot.vue'
import OutputSlot from './OutputSlot.vue'

interface NodeSlotsProps {
  node?: LGraphNode // For backwards compatibility
  nodeData?: VueNodeData // New clean data structure
  readonly?: boolean
  lodLevel?: LODLevel
}

const props = defineProps<NodeSlotsProps>()

const nodeInfo = computed(() => {
  const info = props.nodeData || props.node || null
  return info
})

// Filter out input slots that have corresponding widgets
const filteredInputs = computed(() => {
  if (!nodeInfo.value?.inputs) return []

  return nodeInfo.value.inputs
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

// Outputs don't have widgets, so we don't need to filter them
const filteredOutputs = computed(() => {
  const outputs = nodeInfo.value?.outputs || []
  return outputs.map((output) =>
    isSlotObject(output)
      ? output
      : ({
          name: typeof output === 'string' ? output : '',
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
  if (!nodeInfo.value?.inputs) return filteredIndex

  // Find the actual index in the unfiltered inputs array
  const actualIndex = nodeInfo.value.inputs.findIndex((i) => i === input)
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
