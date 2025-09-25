<script setup lang="ts">
import { type ClassValue, cn } from '@comfyorg/tailwind-utils'
import { useTemplateRef } from 'vue'

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
          'bg-[#5B5E7D] rounded-full',
          'transition-all duration-150',
          'cursor-crosshair',
          'border border-solid border-black/5 dark-theme:border-white/10',
          'group-hover/slot:border-black/20 dark-theme:group-hover/slot:border-white/50 group-hover/slot:scale-125',
          multi ? 'w-3 h-6' : 'size-3'
        )
      "
    />
  </div>
</template>
