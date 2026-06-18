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
      v-if="revealed && revealStyle"
      role="tooltip"
      :class="
        cn(
          'pointer-events-none fixed z-99999 inline-flex items-center rounded-lg bg-interface-menu-component-surface-hovered pr-3 text-sm whitespace-nowrap text-base-foreground shadow-interface',
          revealRect?.anchor === 'right' && 'pl-3'
        )
      "
      :style="revealStyle"
    >
      {{ text }}
    </span>
  </Teleport>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import { measureTextWidth } from './isTextOverflowing'

defineOptions({ inheritAttrs: false })

const { text } = defineProps<{ text: string }>()

// Gap kept between the reveal and the viewport edge (mirrors the menu's
// collision-padding) and the reveal's own far-side padding (`pl-3`/`pr-3`).
const VIEWPORT_MARGIN = 8
const REVEAL_PADDING = 12

type RevealRect = {
  top: number
  height: number
  minWidth: number
  maxWidth: number
  anchor: 'left' | 'right'
  offset: number
}

const elRef = ref<HTMLElement>()
const revealed = ref(false)
const revealRect = ref<RevealRect>()

const revealStyle = computed(() => {
  const rect = revealRect.value
  if (!rect) return undefined
  return {
    top: `${rect.top}px`,
    height: `${rect.height}px`,
    minWidth: `${rect.minWidth}px`,
    maxWidth: `${rect.maxWidth}px`,
    width: 'max-content',
    [rect.anchor]: `${rect.offset}px`
  }
})

const menuItem = computed(
  () =>
    elRef.value?.closest<HTMLElement>('[role="menuitem"]') ??
    elRef.value?.parentElement ??
    null
)

function getRevealRect(el: HTMLElement, textWidth: number): RevealRect {
  const textRect = el.getBoundingClientRect()
  const item = menuItem.value
  const itemRect = item?.getBoundingClientRect()
  const paddingRight = item
    ? Number.parseFloat(getComputedStyle(item).paddingRight) || 0
    : 0
  const rightInset = itemRect ? itemRect.right - paddingRight : textRect.right
  const itemRight = itemRect ? itemRect.right : textRect.right
  const viewportWidth = document.documentElement.clientWidth
  const top = itemRect?.top ?? textRect.top
  const height = itemRect?.height ?? textRect.height
  const minWidth = Math.max(textRect.width, rightInset - textRect.left)
  const neededWidth = Math.max(minWidth, textWidth + REVEAL_PADDING)
  const fitsRight =
    textRect.left + neededWidth <= viewportWidth - VIEWPORT_MARGIN

  if (fitsRight) {
    return {
      top,
      height,
      minWidth,
      maxWidth: viewportWidth - VIEWPORT_MARGIN - textRect.left,
      anchor: 'left',
      offset: textRect.left
    }
  }
  return {
    top,
    height,
    minWidth,
    maxWidth: itemRight - VIEWPORT_MARGIN,
    anchor: 'right',
    offset: Math.max(VIEWPORT_MARGIN, viewportWidth - itemRight)
  }
}

function reveal() {
  const el = elRef.value
  if (!el) {
    revealed.value = false
    return
  }
  const textWidth = measureTextWidth(el)
  if (textWidth <= el.clientWidth + 0.5) {
    revealed.value = false
    return
  }
  revealRect.value = getRevealRect(el, textWidth)
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
