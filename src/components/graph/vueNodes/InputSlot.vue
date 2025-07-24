<template>
  <div v-if="renderError" class="node-error p-1 text-red-500 text-xs">⚠️</div>
  <div
    v-else
    class="lg-slot lg-slot--input flex items-center gap-2 cursor-crosshair group"
    :class="{
      'opacity-70': readonly,
      'lg-slot--connected': connected,
      'lg-slot--compatible': compatible,
      'lg-slot--dot-only': dotOnly,
      'py-1 pl-2 pr-4 hover:bg-black/5': !dotOnly,
      'px-2': dotOnly
    }"
    @pointerdown="handleClick"
  >
    <!-- Connection Dot -->
    <div class="w-2.5 h-2.5 flex items-center justify-center">
      <div
        class="w-2 h-2 rounded-full bg-white transition-all duration-150 group-hover:w-2.5 group-hover:h-2.5 group-hover:border-2 group-hover:border-white"
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
import type { INodeSlot, LGraphNode } from '@comfyorg/litegraph'
import { computed, onErrorCaptured, ref } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { getSlotColor } from '@/constants/slotColors'

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

// Handle click events
const handleClick = (event: PointerEvent) => {
  if (!props.readonly) {
    emit('slot-click', event)
  }
}
</script>
