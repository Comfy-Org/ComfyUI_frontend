<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, language } = defineProps<{
  class?: HTMLAttributes['class']
  language: string
}>()

const containerStyle = {
  contentVisibility: 'auto' as const,
  containIntrinsicSize: 'auto 200px'
}
</script>

<template>
  <div
    :class="
      cn(
        'group relative w-full overflow-hidden rounded-md border border-border-default bg-base-background text-base-foreground',
        className
      )
    "
    :data-language="language"
    :style="containerStyle"
  >
    <slot />
  </div>
</template>
