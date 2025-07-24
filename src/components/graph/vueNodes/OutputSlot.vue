<template>
  <div v-if="renderError" class="node-error p-1 text-red-500 text-xs">⚠️</div>
  <div
    v-else
    class="lg-slot lg-slot--output flex items-center cursor-crosshair justify-end group"
    :class="{
      'opacity-70': readonly,
      'lg-slot--connected': connected,
      'lg-slot--compatible': compatible,
      'lg-slot--dot-only': dotOnly,
      'pl-2 hover:bg-black/5': !dotOnly,
      'justify-center': dotOnly
    }"
    :style="{
      height: slotHeight + 'px'
    }"
    @pointerdown="handleClick"
  >
    <!-- Slot Name -->
    <span v-if="!dotOnly" class="text-xs text-surface-700 whitespace-nowrap">
      {{ slotData.name || `Output ${index}` }}
    </span>

    <!-- Connection Dot -->
    <div class="w-5 h-5 flex items-center justify-center">
      <div
        class="w-2 h-2 rounded-full bg-white transition-all duration-150 group-hover:w-2.5 group-hover:h-2.5 group-hover:border-2 group-hover:border-white"
        :style="{
          backgroundColor: slotColor
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { INodeSlot, LGraphNode } from '@comfyorg/litegraph'
import { COMFY_WIDGET_DIMENSIONS } from '@comfyorg/litegraph'
import { computed, onErrorCaptured, ref } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { getSlotColor } from '@/constants/slotColors'

interface OutputSlotProps {
  node?: LGraphNode
  slotData: INodeSlot
  index: number
  connected?: boolean
  compatible?: boolean
  readonly?: boolean
  dotOnly?: boolean
}

const props = defineProps<OutputSlotProps>()

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
const slotHeight = COMFY_WIDGET_DIMENSIONS.components.SLOT_HEIGHT

// Handle click events
const handleClick = (event: PointerEvent) => {
  if (!props.readonly) {
    emit('slot-click', event)
  }
}
</script>
