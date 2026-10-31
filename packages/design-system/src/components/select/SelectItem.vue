<script setup lang="ts">
import type { SelectItemProps } from 'reka-ui'
import { SelectItem, SelectItemIndicator, SelectItemText } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  SelectItemProps & { class?: HTMLAttributes['class'] }
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
    <SelectItemText class="truncate">
      <slot />
    </SelectItemText>

    <SelectItemIndicator class="flex shrink-0 items-center justify-center">
      <i class="icon-[lucide--check] text-foreground" aria-hidden="true" />
    </SelectItemIndicator>
  </SelectItem>
</template>
