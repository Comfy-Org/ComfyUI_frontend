<script setup lang="ts">
import type {
  DropdownMenuSubContentEmits,
  DropdownMenuSubContentProps
} from 'reka-ui'
import { DropdownMenuSubContent, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { menuContentClass } from './menuStyles'

const {
  class: className,
  width = 'default',
  maxHeight = 'available',
  ...restProps
} = defineProps<
  DropdownMenuSubContentProps & {
    class?: HTMLAttributes['class']
    width?: 'default' | 'compact'
    maxHeight?: 'available' | 'compact'
  }
>()
const emits = defineEmits<DropdownMenuSubContentEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)
</script>

<template>
  <DropdownMenuSubContent
    v-bind="forwarded"
    :class="
      cn(
        menuContentClass,
        width === 'compact' && 'min-w-46.5',
        maxHeight === 'available' &&
          'max-h-(--reka-dropdown-menu-content-available-height)',
        maxHeight === 'compact' && 'max-h-64',
        className
      )
    "
  >
    <slot />
  </DropdownMenuSubContent>
</template>
