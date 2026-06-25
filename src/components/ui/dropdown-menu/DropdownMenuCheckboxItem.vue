<script setup lang="ts">
import type {
  DropdownMenuCheckboxItemEmits,
  DropdownMenuCheckboxItemProps
} from 'reka-ui'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItemIndicator,
  useForwardPropsEmits
} from 'reka-ui'
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
  DropdownMenuCheckboxItemProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<DropdownMenuCheckboxItemEmits>()

const delegatedProps = computed(() => ({ ...restProps }))
const forwarded = useForwardPropsEmits(delegatedProps, emits)

const slots = useSlots()
const showLeading = useReserveLeading(() => !!slots.icon)
const size = useMenuSize()
const itemClass = computed(() => menuItemClassesFor(size.value))
const leadingClass = computed(() => menuItemLeadingClassesFor(size.value))
const trailingSize = computed(() => trailingIconSizeClass(size.value))
</script>

<template>
  <DropdownMenuCheckboxItem
    v-bind="forwarded"
    :class="cn(itemClass, 'pr-2', className)"
  >
    <span v-if="showLeading" :class="leadingClass">
      <slot name="icon" />
    </span>
    <slot />
    <span
      :class="
        cn('ml-auto flex shrink-0 items-center justify-center', trailingSize)
      "
    >
      <DropdownMenuItemIndicator>
        <i :class="cn('icon-[lucide--check]', trailingSize)" />
      </DropdownMenuItemIndicator>
    </span>
  </DropdownMenuCheckboxItem>
</template>
