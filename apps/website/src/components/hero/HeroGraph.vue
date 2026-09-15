<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { reactive, ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { externalLinks } from '../../config/routes'
import BrandButton from '../common/BrandButton.vue'
import AngleNode from './AngleNode.vue'
import ColorNode from './ColorNode.vue'
import GraphLinks from './GraphLinks.vue'
import HeroHeadline from './HeroHeadline.vue'
import HeroImageCard from './HeroImageCard.vue'
import type { ElementKey } from './graphLayout'
import { DRAG_MARGIN, ELEMENT_KEYS, FLOW } from './graphLayout'
import { useHeroPipeline } from './useHeroPipeline'
import { useIdleAutoplay } from './useIdleAutoplay'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const canvasEl = ref<HTMLElement>()

const { pose, hue, saturation, output, outputFilter } = useHeroPipeline()

useIdleAutoplay({ pose, hue, saturation }, canvasEl)

const positions = reactive(
  Object.fromEntries(
    ELEMENT_KEYS.map((key) => [
      key,
      { x: FLOW.elements[key].left, y: FLOW.elements[key].top }
    ])
  ) as Record<ElementKey, { x: number; y: number }>
)

const zOrder = ref<ElementKey[]>([...ELEMENT_KEYS])

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
        fontSize: `min(${100 / FLOW.canvas.width}cqw, 1.6rem)`
      }"
    >
      <GraphLinks :positions />

      <div
        class="pointer-events-none absolute top-[1.5em] left-1/2 z-20 flex -translate-x-1/2 flex-col items-center"
      >
        <div class="text-[3em]">
          <HeroHeadline :locale />
        </div>
      </div>

      <div
        class="pointer-events-none absolute bottom-[2em] left-1/2 z-20 flex -translate-x-1/2"
      >
        <BrandButton
          :href="externalLinks.cloudCta('hero_get_started_free')"
          variant="outline"
          class="pointer-events-auto uppercase"
        >
          {{ t('hero.getStartedFree', locale) }}
        </BrandButton>
      </div>

      <!-- Nodes are static under prefers-reduced-motion: dragging them (and
      the 3D scene / sliders inside) animates the composition, so the whole
      interactive surface is disabled. Keyboard controls stay live. -->
      <div
        v-for="key in ELEMENT_KEYS"
        :key="key"
        :class="
          cn(
            'absolute touch-none motion-reduce:pointer-events-none',
            drag?.key === key ? 'cursor-grabbing' : 'cursor-grab'
          )
        "
        :style="wrapperStyle(key)"
        data-hero-node
        :data-hero-angle="key === 'angle' ? '' : undefined"
        @pointerdown="onPointerDown(key, $event)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <HeroImageCard
          v-if="key === 'input'"
          src="/hero/input.webp"
          alt="Input image: futuristic over-ear headphones with transparent ear cups and glowing yellow accents"
          dot
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
