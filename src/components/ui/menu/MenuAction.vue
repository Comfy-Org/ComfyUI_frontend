<script setup lang="ts">
import { DropdownMenuCheckboxItem, DropdownMenuItem } from 'reka-ui'
import { toValue } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { MenuItemAction } from './types'

const { item, itemClass } = defineProps<{
  item: MenuItemAction
  itemClass: string
}>()

const emit = defineEmits<{
  select: []
}>()

function select(event: Event) {
  if (!item.command) {
    event.preventDefault()
    return
  }
  if (item.checked !== undefined) {
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
      item.checked === undefined ? DropdownMenuItem : DropdownMenuCheckboxItem
    "
    v-tooltip="{ value: item.tooltip, showDelay: 0 }"
    :aria-label="toValue(item.label)"
    :aria-description="toValue(item.description)"
    :disabled="toValue(item.disabled)"
    :class="
      cn(
        itemClass,
        item.variant === 'destructive' && 'text-destructive-background',
        toValue(item.class)
      )
    "
    :model-value="toValue(item.checked)"
    @select="select"
  >
    <slot />
  </component>
</template>
