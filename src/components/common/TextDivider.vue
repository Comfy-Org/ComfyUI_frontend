<template>
  <div class="flex items-center">
    <span v-if="position === 'left'" class="mr-2 shrink-0">{{ text }}</span>
    <div
      :class="
        cn(
          'grow border-interface-stroke',
          layout === 'horizontal' ? 'border-t' : 'h-full border-l',
          type === 'dashed' && 'border-dashed',
          type === 'dotted' && 'border-dotted'
        )
      "
    />
    <span v-if="position === 'right'" class="ml-2 shrink-0">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const {
  text,
  position = 'left',
  type = 'solid',
  layout = 'horizontal'
} = defineProps<{
  text: string
  position?: 'left' | 'right'
  type?: 'solid' | 'dashed' | 'dotted'
  layout?: 'horizontal' | 'vertical'
}>()
</script>
