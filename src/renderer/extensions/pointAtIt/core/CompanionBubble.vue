<template>
  <div
    ref="bubble"
    :data-side="placement.side"
    class="absolute rounded-xl border border-solid border-border bg-background px-3 py-2 text-xs text-foreground shadow-md"
    :style="{
      left: `${placement.position.x}px`,
      top: `${placement.position.y}px`
    }"
  >
    <span
      aria-hidden="true"
      :class="
        cn(
          'absolute size-2.5 -translate-1/2 rotate-45 border-solid border-border bg-background',
          tail.classes
        )
      "
      :style="tail.style"
    />
    <slot />
  </div>
</template>

<script setup lang="ts">
import { useElementSize, useWindowSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { bubbleTail } from './bubbleTail'
import { placeAttached } from './geometry'
import type { Rect, Side } from './geometry'

const {
  anchor,
  order,
  avoid = null
} = defineProps<{
  /** What the bubble comes from, her head, in window coordinates. */
  anchor: Rect
  /** The sides it may sit on, best first. */
  order: Side[]
  /** A rect it should not sit on, such as what she points at, when another side is free. */
  avoid?: Rect | null
}>()

const bubble = useTemplateRef('bubble')
const size = useElementSize(bubble, undefined, { box: 'border-box' })
const windowSize = useWindowSize()

const placement = computed(() =>
  placeAttached(
    anchor,
    { width: size.width.value, height: size.height.value },
    { width: windowSize.width.value, height: windowSize.height.value },
    order,
    avoid
  )
)
const tail = computed(() =>
  bubbleTail(placement.value.side, placement.value.tail)
)
</script>
