<template>
  <div v-if="renderError" class="node-error p-1 text-red-500 text-xs">⚠️</div>
  <div
    v-else
    class="lg-slot lg-slot--input flex items-center gap-2 py-1 pl-2 pr-4 cursor-crosshair hover:bg-black/5"
    :class="{
      'opacity-70': readonly,
      'lg-slot--connected': connected,
      'lg-slot--compatible': compatible
    }"
    @pointerdown="handleClick"
  >
    <!-- Connection Dot -->
    <div
      class="lg-slot__dot w-3 h-3 rounded-full border-2"
      :style="{
        backgroundColor: connected ? slotColor : 'transparent',
        borderColor: slotColor
      }"
    />

    <!-- Slot Name -->
    <span class="text-xs text-surface-700 whitespace-nowrap">
      {{ slotData.name || `Input ${index}` }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { INodeSlot, LGraphNode } from '@comfyorg/litegraph'
import { computed, onErrorCaptured, ref } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { getSlotColor } from '@/constants/slotColors'

interface InputSlotProps {
  node: LGraphNode
  slotData: INodeSlot
  index: number
  connected?: boolean
  compatible?: boolean
  readonly?: boolean
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

// Handle click events
const handleClick = (event: PointerEvent) => {
  if (!props.readonly) {
    emit('slot-click', event)
  }
}
</script>
