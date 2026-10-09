<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { PopoverAnchor } from 'reka-ui'
import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'

import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { cn } from '@comfyorg/tailwind-utils'

defineOptions({ inheritAttrs: false })

const {
  align = 'center',
  side = 'bottom',
  sideOffset = 4,
  collisionPadding = 8,
  dismissable = true,
  closeOnEscape = true,
  class: className,
  contentClass
} = defineProps<{
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  collisionPadding?: number
  dismissable?: boolean
  closeOnEscape?: boolean
  class?: HTMLAttributes['class']
  contentClass?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  show: []
  hide: []
}>()

const open = ref(false)
const anchor = ref<HTMLElement>()
const focusTarget = ref<HTMLElement>()
const returnFocusOnClose = ref(false)

function setOpen(value: boolean) {
  if (open.value === value) return
  open.value = value
  if (value) emit('show')
  else emit('hide')
}

function show(event: Event, target?: EventTarget | null) {
  const sourceTarget =
    event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : event.target
  const eventTarget = target ?? sourceTarget
  if (!(eventTarget instanceof HTMLElement)) return
  const openedByHover = [
    'mouseenter',
    'mouseover',
    'pointerenter',
    'pointerover'
  ].includes(event.type)
  focusTarget.value = openedByHover
    ? undefined
    : sourceTarget instanceof HTMLElement
      ? sourceTarget
      : eventTarget
  returnFocusOnClose.value = !openedByHover
  anchor.value = eventTarget
  setOpen(true)
}

function hide() {
  returnFocusOnClose.value = Boolean(focusTarget.value)
  setOpen(false)
}

function onScroll(event: Event) {
  if (
    anchor.value &&
    (event.target === document ||
      event.target instanceof Window ||
      (event.target instanceof Element && event.target.contains(anchor.value)))
  ) {
    hide()
  }
}

useEventListener(() => (open.value ? window : undefined), 'scroll', onScroll, {
  capture: true
})
useEventListener(() => (open.value ? window : undefined), 'resize', hide)

function toggle(event: Event, target?: EventTarget | null) {
  if (open.value) hide()
  else show(event, target)
}

function onInteractOutside(event: FocusOutsideEvent | PointerDownOutsideEvent) {
  const target = event.detail.originalEvent.target
  if (
    !dismissable ||
    (target instanceof Node && anchor.value?.contains(target))
  ) {
    event.preventDefault()
  } else {
    returnFocusOnClose.value = false
  }
}

function onOpenAutoFocus(event: Event) {
  if (!focusTarget.value) event.preventDefault()
}

function onCloseAutoFocus(event: Event) {
  event.preventDefault()
  if (returnFocusOnClose.value) focusTarget.value?.focus()
}

defineExpose({ show, hide, toggle, open })
</script>

<template>
  <Popover :open @update:open="setOpen">
    <PopoverAnchor as="template" :reference="anchor" />
    <PopoverContent
      v-bind="$attrs"
      :align
      :side
      :side-offset
      :collision-padding
      :class="
        cn(
          'pointer-events-auto z-3000 max-h-(--reka-popover-content-available-height) w-auto max-w-(--reka-popover-content-available-width) overflow-auto rounded-lg border-border-subtle p-0 shadow-lg data-[state=closed]:animate-none data-[state=open]:animate-none',
          className,
          contentClass
        )
      "
      @escape-key-down="!closeOnEscape && $event.preventDefault()"
      @open-auto-focus="onOpenAutoFocus"
      @close-auto-focus="onCloseAutoFocus"
      @interact-outside="onInteractOutside"
    >
      <slot />
    </PopoverContent>
  </Popover>
</template>
