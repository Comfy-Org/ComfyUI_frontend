<script setup lang="ts">
import { DropdownMenuCheckboxItem, DropdownMenuItem } from 'reka-ui'
import { onBeforeUnmount, toValue } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { whileMouseDown } from '@/utils/mouseDownUtil'

import { menuItemClass } from './menuStyles'
import type { MenuItemAction } from './types'

const { allowCommandless = false, item } = defineProps<{
  allowCommandless?: boolean
  item: MenuItemAction
}>()

const emit = defineEmits<{
  select: []
}>()

let pointerRepeating = false
let stopRepeating: (() => void) | undefined

onBeforeUnmount(() => stopRepeating?.())

function mouseDown(event: MouseEvent) {
  if (
    event.button !== 0 ||
    toValue(item.disabled) ||
    !item.command ||
    item.pressAndHoldInterval === undefined
  )
    return
  stopRepeating?.()
  pointerRepeating = false
  const { dispose } = whileMouseDown(
    event,
    () => {
      pointerRepeating = true
      void item.command?.({ originalEvent: event, item })
    },
    item.pressAndHoldInterval
  )
  stopRepeating = dispose
}

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
  if (pointerRepeating) {
    pointerRepeating = false
    event.preventDefault()
    return
  }
  void item.command({ originalEvent: event, item })
  if (event.defaultPrevented) return
  if (item.pressAndHoldInterval !== undefined) {
    event.preventDefault()
    return
  }
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
    :disabled="toValue(item.disabled) || (!item.command && !allowCommandless)"
    :class="
      cn(
        menuItemClass,
        item.variant === 'destructive' && 'text-destructive-background',
        toValue(item.class)
      )
    "
    :model-value="toValue(item.checked)"
    @mousedown="mouseDown"
    @keydown.capture="pointerRepeating = false"
    @select="select"
  >
    <slot />
  </component>
</template>
