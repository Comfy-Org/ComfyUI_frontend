<script setup lang="ts">
import { NumberFieldInput } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <NumberFieldInput
    data-slot="number-field-input"
    :class="
      cn(
        'min-w-0 flex-1 border-none bg-transparent text-center text-base text-base-foreground focus-visible:outline-none',
        className
      )
    "
  />
</template>
