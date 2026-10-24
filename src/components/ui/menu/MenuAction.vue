<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import { DropdownMenuCheckboxItem, DropdownMenuItem } from 'reka-ui'
import { computed, onBeforeUnmount, toValue } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import TextTooltip from '@/components/ui/tooltip/TextTooltip.vue'
import { whileMouseDown } from '@/utils/mouseDownUtil'

import { menuItemClass } from './menuStyles'
import type { MenuItemAction } from './types'

const { allowCommandless = false, item } = defineProps<{
  allowCommandless?: boolean
  item: MenuItemAction
}>()

const emit = defineEmits<{
  select: []
  activate: [item: MenuItemAction]
}>()

const [DefineItem, ReuseItem] = createReusableTemplate()

const disabled = computed(() => toValue(item.disabled) === true)
const focusableDisabled = computed(
  () => disabled.value && item.focusableWhenDisabled === true
)
const unfocusable = computed(() =>
  disabled.value
    ? !item.focusableWhenDisabled
    : !item.command && !allowCommandless
)

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
      const firstRepeat = !pointerRepeating
      pointerRepeating = true
      void item.command?.({ originalEvent: event, item })
      if (firstRepeat) emit('activate', item)
    },
    item.pressAndHoldInterval
  )
  stopRepeating = dispose
}

function select(event: Event) {
  if (disabled.value || !item.command) {
    event.preventDefault()
    return
  }
  if (pointerRepeating) {
    pointerRepeating = false
    event.preventDefault()
    return
  }
  if (item.checked !== undefined) event.preventDefault()
  void item.command({ originalEvent: event, item })
  emit('activate', item)
  if (event.defaultPrevented) return
  if (item.pressAndHoldInterval !== undefined) {
    event.preventDefault()
    return
  }
  emit('select')
}
</script>

<template>
  <DefineItem>
    <component
      :is="
        item.checked === undefined ? DropdownMenuItem : DropdownMenuCheckboxItem
      "
      :aria-label="toValue(item.label)"
      :aria-description="toValue(item.description)"
      :disabled="unfocusable"
      :as-child="focusableDisabled"
      :class="
        cn(
          menuItemClass,
          item.variant === 'destructive' && 'text-destructive',
          focusableDisabled && 'opacity-50',
          toValue(item.class)
        )
      "
      :model-value="toValue(item.checked)"
      @mousedown="mouseDown"
      @keydown.capture="pointerRepeating = false"
      @select="select"
    >
      <div v-if="focusableDisabled" aria-disabled="true">
        <slot />
      </div>
      <slot v-else />
    </component>
  </DefineItem>
  <TextTooltip v-if="item.tooltip" :text="item.tooltip" side="right">
    <ReuseItem />
  </TextTooltip>
  <ReuseItem v-else />
</template>
