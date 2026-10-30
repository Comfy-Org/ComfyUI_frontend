<script setup lang="ts">
import type {
  DropdownMenuRadioItemEmits,
  DropdownMenuRadioItemProps
} from 'reka-ui'
import { DropdownMenuRadioItem, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { menuItemClass } from './menuStyles'

const { class: className, ...restProps } = defineProps<
  DropdownMenuRadioItemProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<DropdownMenuRadioItemEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)
</script>

<template>
  <DropdownMenuRadioItem
    v-bind="forwarded"
    :class="cn(menuItemClass, 'w-full', className)"
  >
    <slot />
  </DropdownMenuRadioItem>
</template>
