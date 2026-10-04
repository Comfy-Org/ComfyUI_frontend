<script setup lang="ts">
import type {
  DropdownMenuContentEmits,
  DropdownMenuContentProps
} from 'reka-ui'
import {
  DropdownMenuContent,
  injectDropdownMenuRootContext,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'

import { menuContentClass } from './menuStyles'

const {
  class: className,
  width = 'default',
  maxHeight = 'available',
  ...restProps
} = defineProps<
  DropdownMenuContentProps & {
    class?: HTMLAttributes['class']
    width?: 'default' | 'trigger' | 'compact'
    maxHeight?: 'available' | 'compact'
  }
>()
const emits = defineEmits<DropdownMenuContentEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)
const rootContext = injectDropdownMenuRootContext()
const contentStyle = useModalLiftedZIndex(rootContext.open)
</script>

<template>
  <DropdownMenuContent
    v-bind="forwarded"
    :style="contentStyle"
    :class="
      cn(
        menuContentClass,
        width === 'trigger' &&
          'w-(--reka-dropdown-menu-trigger-width) min-w-0 overflow-hidden',
        width === 'compact' && 'w-max min-w-46.5',
        maxHeight === 'available' &&
          'max-h-(--reka-dropdown-menu-content-available-height)',
        maxHeight === 'compact' && 'max-h-64',
        className
      )
    "
  >
    <slot />
  </DropdownMenuContent>
</template>
