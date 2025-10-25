<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { cn } from '@/utils/tailwindUtil'
import type { ClassValue } from '@/utils/tailwindUtil'

const props = defineProps<{
  color?: string
  multi?: boolean
  class?: ClassValue
}>()

const slotElRef = useTemplateRef('slot-el')

defineExpose({
  slotElRef
})
</script>

<template>
  <div
    :class="
      cn('size-6 flex items-center justify-center group/slot', props.class)
    "
  >
    <div
      ref="slot-el"
      class="slot-dot"
      :style="{ backgroundColor: color }"
      :class="
        cn(
          'bg-slate-300 rounded-full',
          'transition-all duration-150',
          'border border-solid border-node-component-slot-dot-outline',
          !multi &&
            'cursor-crosshair group-hover/slot:[--node-component-slot-dot-outline-opacity-mult:5] group-hover/slot:scale-125',
          multi ? 'w-3 h-6' : 'size-3'
        )
      "
    />
  </div>
</template>
