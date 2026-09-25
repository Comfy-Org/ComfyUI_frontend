<script setup lang="ts">
import { Video } from '@lucide/vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  ReshootCamera,
  ReshootZone
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { clampAxis } from '../../../../lib/workshop/cinematic-studio/reshoot'
import {
  GLOBE_FLATTEN,
  globePoint,
  zoneArcs
} from '../../../../lib/workshop/cinematic-studio/reshoot-globe'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'

const {
  clip,
  camera,
  disabled = false,
  locale = 'en'
} = defineProps<{
  clip: string
  camera: Readonly<ReshootCamera>
  disabled?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ aim: [patch: Partial<ReshootCamera>] }>()

const SIZE = 240
const R = SIZE * 0.4
const C = SIZE / 2
const MERIDIANS = [0, 30, 60].map((deg) => R * Math.cos((deg * Math.PI) / 180))
const PARALLELS = [-40, 40].map((deg) => {
  const rad = (deg * Math.PI) / 180
  return { y: R * Math.sin(rad), rx: R * Math.cos(rad) }
})
const ARCS = zoneArcs(R)
const STROKE: Readonly<Record<ReshootZone, string>> = {
  green: 'stroke-primary-comfy-yellow',
  yellow: 'stroke-primary-comfy-orange',
  red: 'stroke-primary-comfy-red'
}

const marker = computed(() => globePoint(camera.azimuth, camera.elevation, R))
const label = computed(
  () =>
    `${rc('reshoot.aim.globe', locale)}: ${camera.azimuth}°, ${camera.elevation}°`
)

const dragFrom = ref<{ x: number; y: number }>()

function nudge(dx: number, dy: number) {
  emit('aim', {
    azimuth: clampAxis('azimuth', Math.round(camera.azimuth + dx)),
    elevation: clampAxis('elevation', Math.round(camera.elevation + dy))
  })
}

function startDrag(event: PointerEvent) {
  if (disabled) return
  dragFrom.value = { x: event.clientX, y: event.clientY }
  if (event.currentTarget instanceof Element)
    event.currentTarget.setPointerCapture?.(event.pointerId)
}

function drag(event: PointerEvent) {
  if (!dragFrom.value) return
  const dx = event.clientX - dragFrom.value.x
  const dy = event.clientY - dragFrom.value.y
  dragFrom.value = { x: event.clientX, y: event.clientY }
  nudge(dx * 0.6, -dy * 0.4)
}

const KEYS: Readonly<Record<string, [number, number]>> = {
  ArrowLeft: [-5, 0],
  ArrowRight: [5, 0],
  ArrowUp: [0, 5],
  ArrowDown: [0, -5]
}

function key(event: KeyboardEvent) {
  const step = KEYS[event.key]
  if (!step || disabled) return
  event.preventDefault()
  nudge(...step)
}
</script>

<template>
  <div
    role="group"
    :aria-label="label"
    :aria-disabled="disabled"
    :tabindex="disabled ? -1 : 0"
    :class="
      cn(
        'relative mx-auto touch-none rounded-full outline-none select-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
        disabled ? 'opacity-40' : 'cursor-grab active:cursor-grabbing'
      )
    "
    :style="{ width: `${SIZE}px`, height: `${SIZE}px` }"
    data-testid="reshoot-globe"
    @pointerdown="startDrag"
    @pointermove="drag"
    @pointerup="dragFrom = undefined"
    @pointercancel="dragFrom = undefined"
    @keydown="key"
  >
    <svg
      :width="SIZE"
      :height="SIZE"
      :viewBox="`${-C} ${-C} ${SIZE} ${SIZE}`"
      aria-hidden="true"
      class="fill-none"
    >
      <circle
        :r="R"
        class="fill-transparency-white-t4 stroke-transparency-white-t20"
      />
      <ellipse
        v-for="rx in MERIDIANS"
        :key="rx"
        :rx
        :ry="R"
        class="stroke-transparency-white-t8"
      />
      <ellipse
        v-for="{ y, rx } in PARALLELS"
        :key="y"
        :cy="y"
        :rx
        :ry="rx * GLOBE_FLATTEN"
        class="stroke-transparency-white-t8"
      />
      <polyline
        v-for="arc in ARCS"
        :key="arc.points"
        :points="arc.points"
        stroke-width="4"
        stroke-linecap="round"
        :class="STROKE[arc.zone]"
      />
      <line
        :x2="marker.x"
        :y2="marker.y"
        stroke-dasharray="3 4"
        class="stroke-primary-comfy-yellow/50"
      />
    </svg>
    <video
      :src="clip"
      muted
      playsinline
      preload="metadata"
      class="pointer-events-none absolute top-1/2 left-1/2 h-11 w-17 -translate-1/2 rounded-lg object-cover ring-1 ring-transparency-white-t20"
    />
    <span
      class="pointer-events-none absolute grid size-8 -translate-1/2 place-items-center rounded-full bg-primary-comfy-yellow shadow-[0_0_0_4px_rgb(33_25_39/0.6)] transition-[left,top] duration-75"
      :style="{ left: `${C + marker.x}px`, top: `${C + marker.y}px` }"
      aria-hidden="true"
    >
      <Video class="size-4 text-primary-comfy-ink" />
    </span>
  </div>
</template>
