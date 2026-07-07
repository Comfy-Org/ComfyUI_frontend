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

// The comfy provider icons are monochrome (currentColor), so tint them with the
// provider's brand color: a solid color via `color`, a gradient painted over the
// icon mask via `background-image` (e.g. Anthropic coral, Kling teal gradient).
const iconStyle = computed(() => {
  const style = getProviderBorderStyle(partner)
  return style.includes('gradient')
    ? { backgroundImage: style }
    : { color: style }
})
</script>
