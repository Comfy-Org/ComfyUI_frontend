<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const { class: customClass = '' } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'flex shrink-0 items-center justify-between gap-2 px-4 pt-4 pb-2',
        customClass
      )
    "
  >
    <slot />
  </div>
</template>
