<script setup lang="ts">
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from '@lucide/vue'
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

const SIZE = 264
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

const SUBJECT = { w: 52, h: 32 }
const marker = computed(() => globePoint(camera.azimuth, camera.elevation, R))
const mirrored = computed(() => marker.value.x > 0)
const cone = computed(() => {
  const { x, y } = marker.value
  const half = SUBJECT.h / 2
  return `${x.toFixed(1)},${y.toFixed(1)} ${-SUBJECT.w / 2},${-half} ${SUBJECT.w / 2},${half}`
})
const label = computed(
  () =>
    `${rc('reshoot.aim.globe', locale)}: ${camera.azimuth}°, ${camera.elevation}°`
)

const dragFrom = ref<{ x: number; y: number; tilts: boolean }>()

function nudge(dx: number, dy: number) {
  emit('aim', {
    azimuth: clampAxis('azimuth', Math.round(camera.azimuth + dx)),
    elevation: clampAxis('elevation', Math.round(camera.elevation + dy))
  })
}

function startDrag(event: PointerEvent) {
  if (disabled) return
  const onHandle =
    event.target instanceof Element &&
    event.target.closest('[data-globe-handle]') !== null
  dragFrom.value = {
    x: event.clientX,
    y: event.clientY,
    tilts: event.pointerType !== 'touch' || onHandle
  }
  if (event.currentTarget instanceof Element)
    event.currentTarget.setPointerCapture?.(event.pointerId)
}

function drag(event: PointerEvent) {
  if (!dragFrom.value) return
  const dx = event.clientX - dragFrom.value.x
  const dy = event.clientY - dragFrom.value.y
  dragFrom.value = { ...dragFrom.value, x: event.clientX, y: event.clientY }
  nudge(dx * 0.6, dragFrom.value.tilts ? -dy * 0.4 : 0)
}

const NUDGES = [
  {
    key: 'ArrowUp',
    icon: ChevronUp,
    label: 'reshoot.nudge.up',
    place: 'top-0 left-1/2 -translate-x-1/2'
  },
  {
    key: 'ArrowDown',
    icon: ChevronDown,
    label: 'reshoot.nudge.down',
    place: 'bottom-0 left-1/2 -translate-x-1/2'
  },
  {
    key: 'ArrowLeft',
    icon: ChevronLeft,
    label: 'reshoot.nudge.left',
    place: 'top-1/2 left-0 -translate-y-1/2'
  },
  {
    key: 'ArrowRight',
    icon: ChevronRight,
    label: 'reshoot.nudge.right',
    place: 'top-1/2 right-0 -translate-y-1/2'
  }
] as const

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
        'relative mx-auto touch-pan-y rounded-full outline-none select-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
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
    </svg>
    <video
      :src="clip"
      muted
      playsinline
      preload="metadata"
      class="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 rounded-md object-cover ring-1 ring-transparency-white-t20"
      :style="{ width: `${SUBJECT.w}px`, height: `${SUBJECT.h}px` }"
    />
    <svg
      :width="SIZE"
      :height="SIZE"
      :viewBox="`${-C} ${-C} ${SIZE} ${SIZE}`"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0"
    >
      <polygon
        :points="cone"
        class="fill-primary-comfy-yellow/15 stroke-primary-comfy-yellow/40"
        stroke-linejoin="round"
      />
      <g
        :transform="`translate(${marker.x} ${marker.y}) scale(${mirrored ? -1 : 1} 1)`"
      >
        <circle r="17" class="fill-primary-comfy-ink/70" />
        <rect
          x="-11"
          y="-7"
          width="14"
          height="14"
          rx="3"
          class="fill-primary-comfy-yellow"
        />
        <path d="M3 -3 L11 -7 L11 7 L3 3 Z" class="fill-primary-comfy-yellow" />
        <circle cx="-4" r="3" class="fill-primary-comfy-ink" />
      </g>
    </svg>
    <span
      data-globe-handle
      data-testid="reshoot-globe-handle"
      class="absolute size-12 -translate-1/2 touch-none rounded-full"
      :style="{ left: `${C + marker.x}px`, top: `${C + marker.y}px` }"
      aria-hidden="true"
    />
    <button
      v-for="nudgeButton in NUDGES"
      :key="nudgeButton.key"
      type="button"
      tabindex="-1"
      :disabled
      :aria-label="rc(nudgeButton.label, locale)"
      :class="
        cn(
          'absolute grid size-7 place-items-center rounded-full text-primary-warm-gray hover:bg-transparency-white-t8 hover:text-primary-warm-white disabled:pointer-events-none',
          nudgeButton.place
        )
      "
      @pointerdown.stop
      @click="nudge(...KEYS[nudgeButton.key])"
    >
      <component :is="nudgeButton.icon" class="size-4" aria-hidden="true" />
    </button>
  </div>
</template>
