<script setup lang="ts">
import { type ClassValue, cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  color?: string
  multi?: boolean
  class?: ClassValue
}>()
</script>

<template>
  <div
    :class="
      cn('size-6 flex items-center justify-center group/slot', props.class)
    "
  >
    <div
      :style="{ backgroundColor: color }"
      :class="
        cn(
          'bg-[#5B5E7D] rounded-full',
          'transition-all duration-150',
          'cursor-crosshair group-hover/slot:border-2 group-hover/slot:border-white group-hover/slot:scale-125',
          multi ? 'w-3 h-6' : 'size-3'
        )
      "
    />
  </div>
</template>
