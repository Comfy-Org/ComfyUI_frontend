<script setup lang="ts">
import type { NumberFieldDecrementProps } from 'reka-ui'
import { NumberFieldDecrement, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  NumberFieldDecrementProps & {
    class?: HTMLAttributes['class']
  }
>()
const forwarded = useForwardProps(restProps)
</script>

<template>
  <NumberFieldDecrement
    v-bind="forwarded"
    data-slot="number-field-decrement"
    :class="
      cn(
        'flex h-full w-6 shrink-0 cursor-pointer items-center justify-center rounded-l-lg border-none bg-transparent text-muted-foreground hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-30',
        className
      )
    "
  >
    <slot>
      <i class="icon-[lucide--minus]" />
    </slot>
  </NumberFieldDecrement>
</template>
