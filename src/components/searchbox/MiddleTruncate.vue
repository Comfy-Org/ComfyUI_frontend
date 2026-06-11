<template>
  <span
    ref="elRef"
    v-bind="$attrs"
    :class="cn('block min-w-0 truncate', revealed && 'text-transparent')"
    @pointerenter="reveal"
    @pointermove="reveal"
    @pointerleave="onPointerLeave"
    @focusin="reveal"
    @focusout="hide"
  >
    {{ text }}
  </span>
  <Teleport to="body">
    <span
      v-if="revealed && revealRect"
      role="tooltip"
      class="pointer-events-none fixed z-99999 inline-flex items-center rounded-lg bg-interface-menu-component-surface-hovered pr-3 text-sm whitespace-nowrap text-base-foreground shadow-interface"
      :style="{
        left: `${revealRect.left}px`,
        top: `${revealRect.top}px`,
        height: `${revealRect.height}px`,
        minWidth: `${revealRect.minWidth}px`,
        width: 'max-content',
        maxWidth: '90vw'
      }"
    >
      {{ text }}
    </span>
  </Teleport>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import { isTextOverflowing } from './isTextOverflowing'

defineOptions({ inheritAttrs: false })

const { text } = defineProps<{ text: string }>()

type RevealRect = {
  left: number
  top: number
  height: number
  minWidth: number
}

const elRef = ref<HTMLElement>()
const revealed = ref(false)
const revealRect = ref<RevealRect>()

const menuItem = computed(
  () =>
    elRef.value?.closest<HTMLElement>('[role="menuitem"]') ??
    elRef.value?.parentElement ??
    null
)

function getRevealRect(el: HTMLElement): RevealRect {
  const textRect = el.getBoundingClientRect()
  const item = menuItem.value
  const itemRect = item?.getBoundingClientRect()
  const paddingRight = item
    ? Number.parseFloat(getComputedStyle(item).paddingRight)
    : 0
  const rightInset = itemRect ? itemRect.right - paddingRight : textRect.right
  return {
    left: textRect.left,
    top: itemRect?.top ?? textRect.top,
    height: itemRect?.height ?? textRect.height,
    minWidth: Math.max(textRect.width, rightInset - textRect.left)
  }
}

function reveal() {
  const el = elRef.value
  if (!el || !isTextOverflowing(el)) {
    revealed.value = false
    return
  }
  revealRect.value = getRevealRect(el)
  revealed.value = true
}

function hide() {
  revealed.value = false
}

function isStillOverMenuItem(related: EventTarget | null) {
  const item = menuItem.value
  return (
    related instanceof Node &&
    item != null &&
    (item === related || item.contains(related))
  )
}

function onPointerLeave(event: PointerEvent) {
  if (isStillOverMenuItem(event.relatedTarget)) return
  hide()
}

useEventListener(menuItem, 'pointerenter', reveal)
useEventListener(menuItem, 'pointermove', reveal)
useEventListener(menuItem, 'pointerleave', (event: PointerEvent) => {
  if (isStillOverMenuItem(event.relatedTarget)) return
  hide()
})
</script>
