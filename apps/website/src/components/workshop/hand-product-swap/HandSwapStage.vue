<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import type {
  SwapImage,
  SwapProduct
} from '../../../lib/workshop/hand-product-swap/examples'
import { HAND_EXAMPLE } from '../../../lib/workshop/hand-product-swap/examples'
import { gripRect } from '../../../lib/workshop/hand-product-swap/placement'
import type { Corner, Rect } from '../../../lib/workshop/move-anything/arrange'
import {
  MIN_SIZE,
  moveRect,
  rectBetween,
  resizeRect
} from '../../../lib/workshop/move-anything/arrange'
import EditorFrame from '../app-editor/EditorFrame.vue'
import { pointerFraction, rectStyle } from '../app-editor/stage-geometry'
import HandSwapBox from './HandSwapBox.vue'

const {
  hand,
  product,
  productName,
  region,
  drawing,
  locale = 'en'
} = defineProps<{
  hand: SwapImage
  product: SwapProduct
  productName: string
  region: Rect
  drawing: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  begin: []
  place: [region: Rect]
  commit: [region: Rect]
}>()

const frame = useTemplateRef<HTMLElement>('frame')
const sketch = ref<Rect>()
let gesture: (at: { x: number; y: number }) => void = () => {}

const ghost = computed(() =>
  rectStyle(
    gripRect(product.width, product.height, region, hand.width / hand.height)
  )
)

const point = (event: PointerEvent) => pointerFraction(event, frame.value)

function track(event: PointerEvent, onMove: typeof gesture) {
  frame.value?.setPointerCapture?.(event.pointerId)
  gesture = onMove
}

function grab(event: PointerEvent, corner?: Corner) {
  if (drawing) return
  event.preventDefault()
  emit('begin')
  const start = point(event)
  const from = region
  track(event, (at) => {
    const dx = at.x - start.x
    const dy = at.y - start.y
    emit(
      'place',
      corner ? resizeRect(from, corner, dx, dy) : moveRect(from, dx, dy)
    )
  })
}

function startSketch(event: PointerEvent) {
  if (!drawing) return
  const start = point(event)
  sketch.value = rectBetween(start, start)
  track(event, (at) => (sketch.value = rectBetween(start, at)))
}

function finish() {
  gesture = () => {}
  const drawn = sketch.value
  sketch.value = undefined
  if (drawn && drawn.w > MIN_SIZE && drawn.h > MIN_SIZE) emit('commit', drawn)
}
</script>

<template>
  <EditorFrame :width="hand.width" :height="hand.height">
    <div
      ref="frame"
      :class="
        cn(
          'relative size-full touch-none select-none',
          drawing && 'cursor-crosshair'
        )
      "
      data-testid="swap-stage"
      @pointerdown.self="startSketch"
      @pointermove="gesture(point($event))"
      @pointerup="finish"
      @pointercancel="finish"
    >
      <img
        :src="hand.url"
        :alt="
          hand.url === HAND_EXAMPLE.url
            ? hc('swap.alt.example', locale)
            : hand.name
        "
        draggable="false"
        class="pointer-events-none size-full rounded-sm object-cover"
      />
      <img
        v-if="!sketch"
        :src="product.url"
        alt=""
        draggable="false"
        class="pointer-events-none absolute object-fill opacity-55 mix-blend-multiply"
        :style="ghost"
      />
      <HandSwapBox
        v-if="!sketch"
        :rect="region"
        :label="productName"
        :description="hc('swap.box', locale)"
        :class="cn(drawing && 'pointer-events-none opacity-40')"
        @grab="grab"
        @nudge="(dx, dy) => emit('commit', moveRect(region, dx, dy))"
      />
      <span
        v-if="sketch"
        class="pointer-events-none absolute rounded-sm border-[1.5px] border-dashed border-primary-warm-white bg-primary-warm-white/10"
        :style="rectStyle(sketch)"
        aria-hidden="true"
      />
      <slot />
    </div>
  </EditorFrame>
</template>
