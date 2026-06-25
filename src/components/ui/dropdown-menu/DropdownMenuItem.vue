<script setup lang="ts">
import type { DropdownMenuItemEmits, DropdownMenuItemProps } from 'reka-ui'
import { DropdownMenuItem, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, useSlots } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import {
  useMenuHasCheckables,
  useMenuSize,
  useRegisterCheckable,
  useReserveLeading
} from '../menu.context'
import {
  menuItemClassesFor,
  menuItemLeadingClassesFor,
  trailingIconSizeClass
} from '../menu.styles'

const props = defineProps<
  DropdownMenuItemProps & {
    class?: HTMLAttributes['class']
    checkable?: boolean
    checked?: boolean
  }
>()
const emits = defineEmits<DropdownMenuItemEmits>()

const delegatedProps = computed(() => {
  const { class: _c, checkable: _ck, checked: _ch, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegatedProps, emits)

const slots = useSlots()
const showLeading = useReserveLeading(() => !!slots.icon)
const size = useMenuSize()
const itemClass = computed(() => menuItemClassesFor(size.value))
const leadingClass = computed(() => menuItemLeadingClassesFor(size.value))
const trailingSize = computed(() => trailingIconSizeClass(size.value))

useRegisterCheckable(() => props.checkable === true)
const hasCheckables = useMenuHasCheckables()
</script>

<template>
  <DropdownMenuItem v-bind="forwarded" :class="cn(itemClass, props.class)">
    <span v-if="showLeading" :class="leadingClass">
      <slot name="icon" />
    </span>
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <slot />
    </div>
    <i
      v-if="props.checked === true"
      :class="cn('icon-[lucide--check] shrink-0', trailingSize)"
    />
    <span
      v-else-if="hasCheckables"
      :class="cn('shrink-0', trailingSize)"
      aria-hidden="true"
    />
  </DropdownMenuItem>
</template>
