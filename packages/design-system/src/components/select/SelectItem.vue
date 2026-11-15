<script setup lang="ts">
import type { SelectItemProps } from 'reka-ui'
import { SelectItem, SelectItemIndicator, SelectItemText } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  textClass,
  reserveIndicator = false,
  ...restProps
} = defineProps<
  SelectItemProps & {
    class?: HTMLAttributes['class']
    /** Classes for the item's text, which holds the slot. */
    textClass?: HTMLAttributes['class']
    /** Keeps the check's column on unchecked items too, so text that ends at the right lines up. */
    reserveIndicator?: boolean
  }
>()
</script>

<template>
  <SelectItem
    v-bind="restProps"
    :class="
      cn(
        'relative flex w-full cursor-pointer items-center justify-between select-none',
        'gap-3 rounded-sm px-2 py-3 text-sm outline-none',
        'hover:bg-accent',
        'focus:bg-accent',
        'data-[state=checked]:bg-muted',
        'data-[state=checked]:hover:bg-muted',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        className
      )
    "
  >
    <SelectItemText :class="cn('truncate', textClass)">
      <slot />
    </SelectItemText>

    <span
      :class="
        cn(
          'flex shrink-0 items-center justify-center',
          reserveIndicator ? 'w-4' : 'empty:hidden'
        )
      "
    >
      <SelectItemIndicator class="flex items-center justify-center">
        <i class="icon-[lucide--check] text-foreground" aria-hidden="true" />
      </SelectItemIndicator>
    </span>
  </SelectItem>
</template>
