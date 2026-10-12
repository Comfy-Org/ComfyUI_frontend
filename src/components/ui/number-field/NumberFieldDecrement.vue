<script setup lang="ts">
import type { NumberFieldDecrementProps } from 'reka-ui'
import { NumberFieldDecrement, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  NumberFieldDecrementProps & { class?: HTMLAttributes['class'] }
>()
const forwarded = useForwardProps(restProps)
</script>

<template>
  <NumberFieldDecrement
    v-bind="forwarded"
    data-slot="number-field-decrement"
    :aria-label="$t('g.decrement')"
    :class="
      cn(
        'flex h-full w-6 shrink-0 cursor-pointer items-center justify-center rounded-l-lg border-none bg-transparent text-muted-foreground hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-30',
        className
      )
    "
  >
    <slot>
      <i class="icon-[lucide--minus] size-4" />
    </slot>
  </NumberFieldDecrement>
</template>
