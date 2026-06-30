<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center',
        className
      )
    "
  >
    <slot />
  </div>
</template>
