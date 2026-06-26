<script setup lang="ts">
import type { DropdownMenuSubTriggerProps } from 'reka-ui'
import { DropdownMenuSubTrigger, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, useSlots } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useMenuSize, useReserveLeading } from '../menu.context'
import {
  menuItemClassesFor,
  menuItemLeadingClassesFor,
  trailingIconSizeClass
} from '../menu.styles'

const { class: className, ...restProps } = defineProps<
  DropdownMenuSubTriggerProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = computed(() => ({ ...restProps }))
const forwarded = useForwardProps(delegatedProps)

const slots = useSlots()
const showLeading = useReserveLeading(() => !!slots.icon)
const size = useMenuSize()
const itemClass = computed(() => menuItemClassesFor(size.value))
const leadingClass = computed(() => menuItemLeadingClassesFor(size.value))
const trailingSize = computed(() => trailingIconSizeClass(size.value))
</script>

<template>
  <DropdownMenuSubTrigger
    v-bind="forwarded"
    :class="
      cn(itemClass, 'data-[state=open]:bg-secondary-background', className)
    "
  >
    <span v-if="showLeading" :class="leadingClass">
      <slot name="icon" />
    </span>
    <slot />
    <i
      :class="cn('ml-auto icon-[lucide--chevron-right] shrink-0', trailingSize)"
    />
  </DropdownMenuSubTrigger>
</template>
