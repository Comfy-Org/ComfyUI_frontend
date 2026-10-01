<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { Light } from '../../../lib/workshop/relight/lights'
import {
  ORBIT_PRESETS,
  fromOrbit,
  toOrbit
} from '../../../lib/workshop/relight/orbit'
import { towardLight } from '../../../lib/workshop/relight/shading'

const { light, locale = 'en' } = defineProps<{
  light: Light
  locale?: Locale
}>()

const emit = defineEmits<{
  change: [patch: Pick<Light, 'direction' | 'elevation'>, key?: string]
}>()

const LABELS = {
  front: 'relight.orbit.front',
  top: 'relight.orbit.top',
  left: 'relight.orbit.left',
  back: 'relight.orbit.back',
  bottom: 'relight.orbit.bottom',
  right: 'relight.orbit.right'
} as const

const svg = useTemplateRef<SVGSVGElement>('svg')
const orbit = computed(() => toOrbit(light.direction, light.elevation))
const rad = (value: number) => (value * Math.PI) / 180
const ring = computed(() => ({
  x: 50 + 38 * Math.sin(rad(orbit.value.around)),
  y: 50 + 12 * Math.cos(rad(orbit.value.around)),
  front: Math.cos(rad(orbit.value.around)) >= 0
}))
const arc = computed(() => ({
  x: 50 + 12 * Math.cos(rad(orbit.value.height)),
  y: 50 - 38 * Math.sin(rad(orbit.value.height))
}))
const glow = computed(() => {
  const [x, y] = towardLight(light.direction, light.elevation)
  return { cx: `${50 + x * 35}%`, cy: `${50 + y * 35}%` }
})

const clamp = (value: number) => Math.max(-1, Math.min(1, value))

function place(around: number, height: number, key?: string) {
  emit('change', fromOrbit(around, height), key)
}

function at(event: PointerEvent) {
  const box = svg.value?.getBoundingClientRect()
  if (!box?.width) return { x: 0, y: 0 }
  return {
    x: ((event.clientX - box.left) / box.width) * 100 - 50,
    y: ((event.clientY - box.top) / box.height) * 100 - 50
  }
}

let drag: ((event: PointerEvent) => void) | undefined

function grab(handle: 'around' | 'height', event: PointerEvent) {
  event.preventDefault()
  svg.value?.setPointerCapture?.(event.pointerId)
  const key = `orbit:${light.id}`
  drag = (moved) => {
    const { x, y } = at(moved)
    if (handle === 'around')
      place(
        Math.round((Math.atan2(x / 38, y / 12) * 180) / Math.PI),
        orbit.value.height,
        key
      )
    else
      place(
        orbit.value.around,
        Math.round((Math.asin(clamp(-y / 38)) * 180) / Math.PI),
        key
      )
  }
  drag(event)
}

function nudge(handle: 'around' | 'height', event: KeyboardEvent) {
  const step = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 }[
    event.key
  ]
  if (!step) return
  event.preventDefault()
  const { around, height } = orbit.value
  if (handle === 'around') place(around + step, height, `orbit:${light.id}`)
  else
    place(
      around,
      Math.max(-90, Math.min(90, height + step)),
      `orbit:${light.id}`
    )
}

function isPreset(around: number, height: number) {
  const gap = Math.abs(((orbit.value.around - around + 540) % 360) - 180)
  return gap <= 3 && Math.abs(orbit.value.height - height) <= 3
}
</script>

<template>
  <div class="flex items-center gap-3 px-1 py-1">
    <svg
      ref="svg"
      viewBox="0 0 100 100"
      class="size-26 shrink-0 touch-none rounded-lg bg-black/30"
      role="group"
      :aria-label="lc('relight.orbit', locale)"
      @pointermove="drag?.($event)"
      @pointerup="drag = undefined"
      @pointercancel="drag = undefined"
    >
      <defs>
        <radialGradient
          :id="`orbit-${light.id}`"
          :cx="glow.cx"
          :cy="glow.cy"
          r="75%"
        >
          <stop offset="0%" :stop-color="light.color" />
          <stop
            offset="45%"
            class="text-primary-warm-gray"
            stop-color="currentColor"
          />
          <stop
            offset="100%"
            class="text-primary-comfy-ink"
            stop-color="currentColor"
          />
        </radialGradient>
      </defs>
      <ellipse
        cx="50"
        cy="50"
        rx="12"
        ry="38"
        fill="none"
        class="text-transparency-white-t20"
        stroke="currentColor"
        stroke-dasharray="2 3"
      />
      <circle cx="50" cy="50" r="16" :fill="`url(#orbit-${light.id})`" />
      <ellipse
        cx="50"
        cy="50"
        rx="38"
        ry="12"
        fill="none"
        class="text-transparency-white-t20"
        stroke="currentColor"
      />
      <circle
        role="slider"
        tabindex="0"
        :cx="ring.x"
        :cy="ring.y"
        r="5"
        :fill="light.color"
        :class="
          cn(
            'cursor-grab stroke-primary-warm-white focus-visible:outline-none',
            !ring.front && 'opacity-50'
          )
        "
        stroke-width="1.5"
        :aria-label="lc('relight.orbit.around', locale)"
        :aria-valuenow="orbit.around"
        aria-valuemin="-180"
        aria-valuemax="180"
        @pointerdown="grab('around', $event)"
        @keydown="nudge('around', $event)"
      />
      <circle
        role="slider"
        tabindex="0"
        :cx="arc.x"
        :cy="arc.y"
        r="4"
        class="cursor-grab fill-primary-warm-white focus-visible:outline-none"
        :aria-label="lc('relight.orbit.height', locale)"
        :aria-valuenow="orbit.height"
        aria-valuemin="-90"
        aria-valuemax="90"
        @pointerdown="grab('height', $event)"
        @keydown="nudge('height', $event)"
      />
    </svg>
    <div class="grid flex-1 grid-cols-3 gap-1">
      <button
        v-for="preset in ORBIT_PRESETS"
        :key="preset.id"
        type="button"
        :aria-pressed="isPreset(preset.around, preset.height)"
        :class="
          cn(
            'h-7 rounded-md bg-transparency-white-t4 text-[11px] text-primary-warm-gray transition hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40',
            isPreset(preset.around, preset.height) &&
              'bg-transparency-white-t20 text-primary-warm-white'
          )
        "
        @click="place(preset.around, preset.height)"
      >
        {{ lc(LABELS[preset.id], locale) }}
      </button>
    </div>
  </div>
</template>
