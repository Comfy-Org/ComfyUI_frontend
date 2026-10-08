<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import {
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot
} from 'reka-ui'
import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { nextTick, ref } from 'vue'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
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
const content = ref<InstanceType<typeof PopoverContent>>()
const contentStyle = useModalLiftedZIndex(open)
const returnFocusOnClose = ref(false)
let showRequest = 0

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
  const request = ++showRequest
  void nextTick(() => {
    if (request === showRequest) setOpen(true)
  })
}

function hide() {
  showRequest++
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

function onOpenChange(value: boolean) {
  setOpen(value)
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

defineExpose({ show, hide, toggle, container: content, open })
</script>

<template>
  <PopoverRoot :open @update:open="onOpenChange">
    <PopoverAnchor as="template" :reference="anchor" />
    <PopoverPortal>
      <PopoverContent
        ref="content"
        v-bind="$attrs"
        :align
        :side
        :side-offset
        :collision-padding
        :style="contentStyle"
        :class="
          cn(
            'pointer-events-auto z-3000 max-h-(--reka-popover-content-available-height) max-w-(--reka-popover-content-available-width) overflow-auto rounded-lg border border-border-subtle bg-base-background text-base-foreground shadow-lg outline-none',
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
    </PopoverPortal>
  </PopoverRoot>
</template>
