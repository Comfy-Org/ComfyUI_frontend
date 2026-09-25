<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
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
const anchorRect = ref({ left: 0, top: 0, width: 0, height: 0 })
const content = ref<InstanceType<typeof PopoverContent>>()
const contentStyle = useModalLiftedZIndex(open)

function setOpen(value: boolean) {
  if (open.value === value) return
  open.value = value
  if (value) emit('show')
  else emit('hide')
}

function show(event: Event, target?: EventTarget | null) {
  const eventTarget =
    target ??
    (event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : event.target)
  if (!(eventTarget instanceof HTMLElement)) return
  anchor.value = eventTarget
  const rect = eventTarget.getBoundingClientRect()
  anchorRect.value = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  }
  void nextTick(() => setOpen(true))
}

function hide() {
  setOpen(false)
}

function onScroll(event: Event) {
  if (
    anchor.value &&
    event.target instanceof Element &&
    event.target.contains(anchor.value)
  ) {
    hide()
  }
}

useEventListener(window, 'scroll', onScroll, { capture: true })

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
  }
}

const tabbableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]'

// Reka falls back to focusing the popper wrapper when the content has nothing
// tabbable. Browsers ignore that (the wrapper is not focusable); happy-dom
// honors it and the resulting focusin outside the layer dismisses the popover.
function onOpenAutoFocus(event: Event) {
  const element: unknown = content.value?.$el
  if (
    element instanceof HTMLElement &&
    element.querySelector(tabbableSelector) === null
  ) {
    event.preventDefault()
  }
}

function onCloseAutoFocus(event: Event) {
  event.preventDefault()
  anchor.value?.focus()
}

defineExpose({ show, hide, toggle, container: content, open })
</script>

<template>
  <PopoverRoot :open @update:open="onOpenChange">
    <PopoverTrigger as-child>
      <button
        type="button"
        tabindex="-1"
        aria-hidden="true"
        class="pointer-events-none fixed opacity-0"
        :style="{
          left: `${anchorRect.left}px`,
          top: `${anchorRect.top}px`,
          width: `${anchorRect.width}px`,
          height: `${anchorRect.height}px`
        }"
      />
    </PopoverTrigger>
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
