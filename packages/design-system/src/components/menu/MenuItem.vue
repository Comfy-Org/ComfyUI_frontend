<script setup lang="ts">
import type { DropdownMenuItemEmits, DropdownMenuItemProps } from 'reka-ui'
import { DropdownMenuItem, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { menuItemClass } from './menuStyles'

const { class: className, ...restProps } = defineProps<
  DropdownMenuItemProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<DropdownMenuItemEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)
</script>

<template>
  <DropdownMenuItem v-bind="forwarded" :class="cn(menuItemClass, className)">
    <slot />
  </DropdownMenuItem>
</template>
