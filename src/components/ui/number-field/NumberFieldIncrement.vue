<script setup lang="ts">
import type { NumberFieldIncrementProps } from 'reka-ui'
import { NumberFieldIncrement, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  NumberFieldIncrementProps & { class?: HTMLAttributes['class'] }
>()
const forwarded = useForwardProps(restProps)
</script>

<template>
  <NumberFieldIncrement
    v-bind="forwarded"
    data-slot="number-field-increment"
    :aria-label="$t('g.increment')"
    :class="
      cn(
        'flex h-full w-6 shrink-0 cursor-pointer items-center justify-center rounded-r-lg border-none bg-transparent text-muted-foreground hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-30',
        className
      )
    "
  >
    <slot>
      <i class="icon-[lucide--plus] size-4" />
    </slot>
  </NumberFieldIncrement>
</template>
