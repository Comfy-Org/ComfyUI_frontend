<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: customClass = '' } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'flex shrink-0 items-center justify-end gap-2 px-4 pt-2 pb-4',
        customClass
      )
    "
  >
    <slot />
  </div>
</template>
