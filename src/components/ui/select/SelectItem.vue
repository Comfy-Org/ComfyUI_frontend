<script setup lang="ts">
import type { SelectItemProps } from 'reka-ui'
import { SelectItem, SelectItemIndicator, SelectItemText } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  textClass,
  ...restProps
} = defineProps<
  SelectItemProps & {
    class?: HTMLAttributes['class']
    /** Classes for the item's text, which holds the slot. */
    textClass?: HTMLAttributes['class']
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
        'hover:bg-secondary-background-hover',
        'focus:bg-secondary-background-hover',
        'data-[state=checked]:bg-secondary-background-selected',
        'data-[state=checked]:hover:bg-secondary-background-selected',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        className
      )
    "
  >
    <SelectItemText :class="cn('truncate', textClass)">
      <slot />
    </SelectItemText>

    <SelectItemIndicator class="flex shrink-0 items-center justify-center">
      <i class="icon-[lucide--check] text-base-foreground" aria-hidden="true" />
    </SelectItemIndicator>
  </SelectItem>
</template>
