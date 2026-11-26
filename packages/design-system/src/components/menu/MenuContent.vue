<script setup lang="ts">
import type {
  DropdownMenuContentEmits,
  DropdownMenuContentProps
} from 'reka-ui'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  injectDropdownMenuRootContext,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { menuContentClass } from './menuStyles'

defineOptions({ inheritAttrs: false })

const {
  class: className,
  to,
  width = 'default',
  maxHeight = 'available',
  ...restProps
} = defineProps<
  DropdownMenuContentProps & {
    class?: HTMLAttributes['class']
    to?: string | HTMLElement
    width?: 'default' | 'trigger' | 'compact'
    maxHeight?: 'available' | 'compact' | 'viewport'
  }
>()
const emits = defineEmits<DropdownMenuContentEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)
const rootContext = injectDropdownMenuRootContext()
</script>

<template>
  <DropdownMenuPortal :key="Number(rootContext.open.value)" :to>
    <DropdownMenuContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="
        cn(
          menuContentClass,
          width === 'trigger' &&
            'w-(--reka-dropdown-menu-trigger-width) min-w-0 overflow-hidden',
          width === 'compact' && 'w-max min-w-46.5',
          maxHeight === 'available' &&
            'max-h-(--reka-dropdown-menu-content-available-height)',
          maxHeight === 'compact' && 'max-h-64',
          maxHeight === 'viewport' &&
            'max-h-[min(40vh,var(--reka-dropdown-menu-content-available-height))]',
          className
        )
      "
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
