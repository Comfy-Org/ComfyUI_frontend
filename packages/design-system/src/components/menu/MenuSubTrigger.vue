<script setup lang="ts">
import type { DropdownMenuSubTriggerProps } from 'reka-ui'
import { DropdownMenuSubTrigger, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { menuItemClass } from './menuStyles'

const { class: className, ...restProps } = defineProps<
  DropdownMenuSubTriggerProps & { class?: HTMLAttributes['class'] }
>()
const forwarded = useForwardProps(restProps)
</script>

<template>
  <DropdownMenuSubTrigger
    v-bind="forwarded"
    :class="cn(menuItemClass, className)"
  >
    <slot />
  </DropdownMenuSubTrigger>
</template>
