<template>
  <span
    class="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary-background-hover"
  >
    <i :class="cn(getProviderIcon(partner), 'size-3')" :style="iconStyle" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { getProviderBorderStyle, getProviderIcon } from '@/utils/categoryUtil'
import { cn } from '@comfyorg/tailwind-utils'

const { partner } = defineProps<{ partner: string }>()

// Monotone provider glyphs (Anthropic, BFL, …) render in currentColor, so tint
// them with the brand color. Multi-color brands (ByteDance, Kling, Gemini, …)
// ship full-color icons — identified by a gradient brand color — and must be
// left untouched or the tint replaces their artwork.
const iconStyle = computed(() => {
  const style = getProviderBorderStyle(partner)
  return style.includes('gradient') ? undefined : { color: style }
})
</script>
