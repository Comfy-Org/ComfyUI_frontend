<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed, reactive, ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { DEFAULT_POSE } from './cameraVocabulary'
import { resolveAsset } from './assetResolver'
import AngleNode from './AngleNode.vue'
import ColorNode from './ColorNode.vue'
import GraphLinks from './GraphLinks.vue'
import HeroHeadline from './HeroHeadline.vue'
import HeroImageCard from './HeroImageCard.vue'
import type { ElementKey } from './graphLayout'
import { DRAG_MARGIN, ELEMENT_KEYS, FLOW } from './graphLayout'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const canvasEl = ref<HTMLElement>()

const hue = ref(0)
const saturation = ref(1)

const outputFilter = computed(() =>
  hue.value === 0 && saturation.value === 1
    ? undefined
    : `hue-rotate(${hue.value}deg) saturate(${saturation.value})`
)

const positions = reactive(
  Object.fromEntries(
    ELEMENT_KEYS.map((key) => [
      key,
      { x: FLOW.elements[key].left, y: FLOW.elements[key].top }
    ])
  ) as Record<ElementKey, { x: number; y: number }>
)

const zOrder = ref<ElementKey[]>([...ELEMENT_KEYS])

const pose = reactive({ ...DEFAULT_POSE })

const output = computed(() => resolveAsset(pose))

interface DragState {
  key: ElementKey
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  emPx: number
}

const drag = ref<DragState | null>(null)

function bringToFront(key: ElementKey) {
  zOrder.value = [...zOrder.value.filter((k) => k !== key), key]
}

function onPointerDown(key: ElementKey, event: PointerEvent) {
  bringToFront(key)
  const target = event.target as Element
  if (
    target.closest(
      'a, button, input, label, [role="slider"], [data-camera-scene]'
    )
  )
    return
  const canvas = canvasEl.value
  if (!canvas) return
  drag.value = {
    key,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: positions[key].x,
    originY: positions[key].y,
    emPx: Number.parseFloat(getComputedStyle(canvas).fontSize)
  }
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  const state = drag.value
  if (!state || event.pointerId !== state.pointerId) return
  const el = FLOW.elements[state.key]
  const x = state.originX + (event.clientX - state.startX) / state.emPx
  const y = state.originY + (event.clientY - state.startY) / state.emPx
  positions[state.key].x = Math.min(
    FLOW.canvas.width - DRAG_MARGIN,
    Math.max(DRAG_MARGIN - el.width, x)
  )
  positions[state.key].y = Math.min(
    FLOW.canvas.height - Math.min(el.height, 6),
    Math.max(0, y)
  )
}

function onPointerUp(event: PointerEvent) {
  if (drag.value?.pointerId === event.pointerId) drag.value = null
}

function wrapperStyle(key: ElementKey) {
  return {
    left: `${positions[key].x}em`,
    top: `${positions[key].y}em`,
    width: `${FLOW.elements[key].width}em`,
    height: `${FLOW.elements[key].height}em`,
    zIndex: zOrder.value.indexOf(key) + 1
  }
}
</script>

<template>
  <div class="@container">
    <div
      ref="canvasEl"
      :class="cn('relative mx-auto', drag && 'cursor-grabbing select-none')"
      :style="{
        width: `${FLOW.canvas.width}em`,
        height: `${FLOW.canvas.height}em`,
        fontSize: `min(${100 / FLOW.canvas.width}cqw, 1rem)`
      }"
    >
      <GraphLinks :positions />

      <div
        class="pointer-events-none absolute top-[1.5em] left-1/2 z-20 -translate-x-1/2 text-[3em]"
      >
        <HeroHeadline :locale />
      </div>

      <div
        v-for="key in ELEMENT_KEYS"
        :key="key"
        :class="
          cn(
            'absolute touch-none',
            drag?.key === key ? 'cursor-grabbing' : 'cursor-grab'
          )
        "
        :style="wrapperStyle(key)"
        @pointerdown="onPointerDown(key, $event)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <HeroImageCard
          v-if="key === 'input'"
          src="/hero/input.webp"
          alt="Input image: two robotic hands reaching toward each other through glowing rings"
        />
        <AngleNode
          v-else-if="key === 'angle'"
          v-model:azimuth="pose.azimuth"
          v-model:elevation="pose.elevation"
          v-model:zoom="pose.zoom"
        />
        <ColorNode
          v-else-if="key === 'color'"
          v-model:hue="hue"
          v-model:saturation="saturation"
        />
        <HeroImageCard
          v-else
          :src="output.src"
          :filter="outputFilter"
          alt="Generated image rendered from the selected camera angle"
          label="OUTPUT"
        />
      </div>
    </div>
  </div>
</template>
