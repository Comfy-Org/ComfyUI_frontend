<template>
  <div v-if="renderError" class="node-error p-1 text-red-500 text-xs">⚠️</div>
  <div
    v-else
    class="lg-slot lg-slot--input flex items-center cursor-crosshair group"
    :class="{
      'opacity-70': readonly,
      'lg-slot--connected': connected,
      'lg-slot--compatible': compatible,
      'lg-slot--dot-only': dotOnly,
      'pr-2 hover:bg-black/5': !dotOnly
    }"
    :style="{
      height: slotHeight + 'px'
    }"
    @pointerdown="handleClick"
  >
    <!-- Connection Dot -->
    <div class="w-5 h-5 flex items-center justify-center group/slot">
      <div
        class="w-2 h-2 rounded-full bg-white transition-all duration-150 group-hover/slot:w-2.5 group-hover/slot:h-2.5 group-hover/slot:border-2 group-hover/slot:border-white"
        :style="{
          backgroundColor: slotColor
        }"
      />
    </div>

    <!-- Slot Name -->
    <span v-if="!dotOnly" class="text-xs text-surface-700 whitespace-nowrap">
      {{ slotData.name || `Input ${index}` }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { getSlotColor } from '@/constants/slotColors'
import {
  COMFY_VUE_NODE_DIMENSIONS,
  INodeSlot,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'

interface InputSlotProps {
  node?: LGraphNode
  slotData: INodeSlot
  index: number
  connected?: boolean
  compatible?: boolean
  readonly?: boolean
  dotOnly?: boolean
}

const props = defineProps<InputSlotProps>()

const emit = defineEmits<{
  'slot-click': [event: PointerEvent]
}>()

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

// Get slot color based on type
const slotColor = computed(() => getSlotColor(props.slotData.type))

// Get slot height from litegraph constants
const slotHeight = COMFY_VUE_NODE_DIMENSIONS.components.SLOT_HEIGHT

// Handle click events
const handleClick = (event: PointerEvent) => {
  if (!props.readonly) {
    emit('slot-click', event)
  }
}
</script>
