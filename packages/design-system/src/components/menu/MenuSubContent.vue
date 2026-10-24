<script setup lang="ts">
import type {
  DropdownMenuSubContentEmits,
  DropdownMenuSubContentProps
} from 'reka-ui'
import {
  DropdownMenuPortal,
  DropdownMenuSubContent,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { inject } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { menuContentClass } from './menuStyles'
import { menuSubOpenKey } from './menuSubContext'

defineOptions({ inheritAttrs: false })

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
const open = inject(menuSubOpenKey)
if (!open) throw new Error('MenuSubContent must be rendered inside MenuSub')
</script>

<template>
  <DropdownMenuPortal :key="Number(open)">
    <DropdownMenuSubContent
      v-bind="{ ...forwarded, ...$attrs }"
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
  </DropdownMenuPortal>
</template>
