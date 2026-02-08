<template>
  <span
    class="flex items-center gap-1 rounded border px-1.5 py-0.5 text-xxs"
    :class="textColorClass"
    :style="customStyle"
  >
    <i v-if="icon" :class="cn(icon, 'size-2.5', iconClass)" />
    <slot>{{ text }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { borderStyle, filled } = defineProps<{
  text?: string
  icon?: string
  iconClass?: string
  borderStyle?: string
  filled?: boolean
}>()

const textColorClass = computed(() =>
  borderStyle && filled ? '' : 'text-white'
)

const customStyle = computed(() => {
  if (!borderStyle) {
    return { borderColor: '#525252' }
  }

  const isGradient = borderStyle.includes('linear-gradient')
  if (isGradient) {
    return {
      borderColor: 'transparent',
      backgroundImage: `linear-gradient(#1a1a1a, #1a1a1a), ${borderStyle}`,
      backgroundOrigin: 'border-box',
      backgroundClip: 'padding-box, border-box'
    }
  }

  if (filled) {
    return {
      borderColor: borderStyle,
      backgroundColor: `${borderStyle}33`,
      color: borderStyle
    }
  }

  return { borderColor: borderStyle }
})
</script>
