<template>
  <!-- eslint-disable-next-line @intlify/vue-i18n/no-raw-text -->
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Slots Error
  </div>
  <div v-else class="lg-node-slots flex justify-between">
    <div v-if="filteredInputs.length" class="flex flex-col">
      <InputSlot
        v-for="(input, index) in filteredInputs"
        :key="`input-${index}`"
        :slot-data="input"
        :node-id="nodeInfo?.id != null ? String(nodeInfo.id) : ''"
        :index="getActualInputIndex(input, index)"
        :readonly="readonly"
        @slot-click="
          handleInputSlotClick(getActualInputIndex(input, index), $event)
        "
      />
    </div>

    <div v-if="filteredOutputs.length" class="flex flex-col ml-auto">
      <OutputSlot
        v-for="(output, index) in filteredOutputs"
        :key="`output-${index}`"
        :slot-data="output"
        :node-id="nodeInfo?.id != null ? String(nodeInfo.id) : ''"
        :index="index"
        :readonly="readonly"
        @slot-click="handleOutputSlotClick(index, $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, onUnmounted, ref } from 'vue'

import { useEventForwarding } from '@/composables/graph/useEventForwarding'
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

const nodeInfo = computed(() => props.nodeData || props.node || null)

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

// Set up event forwarding for slot interactions
const { handleSlotPointerDown, cleanup } = useEventForwarding()

// Handle input slot click
const handleInputSlotClick = (_index: number, event: PointerEvent) => {
  // Forward the event to LiteGraph for native slot handling
  handleSlotPointerDown(event)
}

// Handle output slot click
const handleOutputSlotClick = (_index: number, event: PointerEvent) => {
  // Forward the event to LiteGraph for native slot handling
  handleSlotPointerDown(event)
}

// Clean up event listeners on unmount
onUnmounted(() => {
  cleanup()
})

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})
</script>
