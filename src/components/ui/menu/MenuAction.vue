<script setup lang="ts">
import { DropdownMenuCheckboxItem, DropdownMenuItem } from 'reka-ui'
import { toValue } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { MenuItemAction } from './types'

const {
  item,
  itemClass,
  disableCommandless = false,
  legacyCheckedRole = false
} = defineProps<{
  item: MenuItemAction
  itemClass: string
  disableCommandless?: boolean
  legacyCheckedRole?: boolean
}>()

const emit = defineEmits<{
  select: []
}>()

function select(event: Event) {
  if (!item.command) {
    event.preventDefault()
    return
  }
  if (!legacyCheckedRole && item.checked !== undefined) {
    event.preventDefault()
    void item.command({ originalEvent: event, item })
    return
  }
  void item.command({ originalEvent: event, item })
  emit('select')
}
</script>

<template>
  <component
    :is="
      item.checked === undefined || legacyCheckedRole
        ? DropdownMenuItem
        : DropdownMenuCheckboxItem
    "
    v-tooltip="{ value: item.tooltip, showDelay: 0 }"
    :aria-label="toValue(item.label)"
    :disabled="toValue(item.disabled) ?? (disableCommandless && !item.command)"
    :class="cn(itemClass, toValue(item.class))"
    v-bind="
      legacyCheckedRole && item.checked !== undefined
        ? {
            role: 'menuitemradio',
            'aria-checked': Boolean(toValue(item.checked))
          }
        : { modelValue: toValue(item.checked) }
    "
    @select="select"
  >
    <slot />
  </component>
</template>
