<script setup lang="ts">
import type { SelectTriggerProps } from 'reka-ui'
import { SelectIcon, SelectTrigger } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const {
  class: className,
  size = 'lg',
  invalid = false,
  ...restProps
} = defineProps<
  SelectTriggerProps & {
    class?: HTMLAttributes['class']
    /** Trigger size: 'lg' (40px) or 'md' (32px) */
    size?: 'lg' | 'md'
    /** Show invalid (destructive) border */
    invalid?: boolean
  }
>()
</script>

<template>
  <SelectTrigger
    v-bind="restProps"
    :aria-invalid="invalid || undefined"
    :class="
      cn(
        'flex w-full cursor-pointer items-center justify-between select-none',
        size === 'md' ? 'h-8 px-3 py-1 text-xs' : 'h-10 px-4 py-2 text-sm',
        'rounded-lg',
        'bg-secondary-background text-base-foreground',
        'transition-all duration-200 ease-in-out',
        'hover:bg-secondary-background-hover',
        'border-[2.5px] border-solid',
        invalid
          ? 'border-destructive-background'
          : 'border-transparent focus:border-node-component-border',
        'focus:outline-none',
        'data-placeholder:text-muted-foreground',
        'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-secondary-background',
        '[&>span]:truncate',
        className
      )
    "
  >
    <slot />
    <SelectIcon as-child>
      <i class="icon-[lucide--chevron-down] shrink-0 text-muted-foreground" />
    </SelectIcon>
  </SelectTrigger>
</template>
