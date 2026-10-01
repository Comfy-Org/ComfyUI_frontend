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

const CENTER = { x: 120, y: 76 }
const RING = { rx: 88, ry: 22 }
const ARC = { rx: 22, ry: 56 }
const RING_PRESETS = new Set(['front', 'back', 'left', 'right'])

const svg = useTemplateRef<SVGSVGElement>('svg')
const orbit = computed(() => toOrbit(light.direction, light.elevation))
const rad = (value: number) => (value * Math.PI) / 180
const onRing = (around: number) => ({
  x: CENTER.x + RING.rx * Math.sin(rad(around)),
  y: CENTER.y + RING.ry * Math.cos(rad(around))
})
const onArc = (height: number) => ({
  x: CENTER.x + ARC.rx * Math.cos(rad(height)),
  y: CENTER.y - ARC.ry * Math.sin(rad(height))
})
const ring = computed(() => ({
  ...onRing(orbit.value.around),
  front: Math.cos(rad(orbit.value.around)) >= 0
}))
const arc = computed(() => onArc(orbit.value.height))
const presets = computed(() =>
  ORBIT_PRESETS.map((preset) => {
    const at = RING_PRESETS.has(preset.id)
      ? onRing(preset.around)
      : onArc(preset.height)
    const side = at.x < CENTER.x - 4 ? -1 : at.x > CENTER.x + 4 ? 1 : 0
    return {
      ...preset,
      ...at,
      label: lc(LABELS[preset.id], locale),
      pressed: isPreset(preset.around, preset.height),
      text: {
        x: at.x + side * 8,
        y: side ? at.y + 3 : at.y + (at.y > CENTER.y ? 13 : -7),
        anchor: side < 0 ? 'end' : side > 0 ? 'start' : 'middle'
      }
    }
  })
)
const glow = computed(() => {
  const [x, y] = towardLight(light.direction, light.elevation)
  return { cx: `${50 + x * 35}%`, cy: `${50 + y * 35}%` }
})

const clamp = (value: number) => Math.max(-1, Math.min(1, value))

function place(around: number, height: number, key?: string) {
  emit('change', fromOrbit(around, height), key)
}

function at(event: PointerEvent) {
  const matrix = svg.value?.getScreenCTM()?.inverse()
  if (!matrix) return { x: 0, y: 0 }
  const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(
    matrix
  )
  return { x: x - CENTER.x, y: y - CENTER.y }
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
        Math.round((Math.atan2(x / RING.rx, y / RING.ry) * 180) / Math.PI),
        orbit.value.height,
        key
      )
    else
      place(
        orbit.value.around,
        Math.round((Math.asin(clamp(-y / ARC.ry)) * 180) / Math.PI),
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
  <div class="relative rounded-xl bg-transparency-white-t4">
    <svg
      ref="svg"
      viewBox="0 0 240 150"
      class="block h-38 w-full touch-none"
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
        :cx="CENTER.x"
        :cy="CENTER.y"
        :rx="ARC.rx"
        :ry="ARC.ry"
        fill="none"
        class="text-transparency-white-t20"
        stroke="currentColor"
        stroke-dasharray="2 3"
      />
      <circle
        :cx="CENTER.x"
        :cy="CENTER.y"
        r="20"
        :fill="`url(#orbit-${light.id})`"
      />
      <ellipse
        :cx="CENTER.x"
        :cy="CENTER.y"
        :rx="RING.rx"
        :ry="RING.ry"
        fill="none"
        class="text-transparency-white-t20"
        stroke="currentColor"
      />
      <g
        v-for="preset in presets"
        :key="preset.id"
        role="button"
        tabindex="0"
        :aria-label="preset.label"
        :aria-pressed="preset.pressed"
        class="group cursor-pointer focus-visible:outline-none"
        @click="place(preset.around, preset.height)"
        @keydown.enter.prevent="place(preset.around, preset.height)"
        @keydown.space.prevent="place(preset.around, preset.height)"
      >
        <circle :cx="preset.x" :cy="preset.y" r="9" fill="transparent" />
        <circle
          :cx="preset.x"
          :cy="preset.y"
          r="2.5"
          :class="
            cn(
              'fill-primary-warm-gray transition group-hover:fill-primary-warm-white group-focus-visible:stroke-primary-comfy-yellow',
              preset.pressed && 'fill-primary-warm-white'
            )
          "
          stroke-width="1.5"
        />
        <text
          :x="preset.text.x"
          :y="preset.text.y"
          :text-anchor="preset.text.anchor"
          :class="
            cn(
              'fill-primary-warm-gray text-[8px] transition select-none group-hover:fill-primary-warm-white group-focus-visible:fill-primary-comfy-yellow',
              preset.pressed && 'fill-primary-warm-white'
            )
          "
        >
          {{ preset.label }}
        </text>
      </g>
      <circle
        role="slider"
        tabindex="0"
        :cx="ring.x"
        :cy="ring.y"
        r="6"
        :fill="light.color"
        :class="
          cn(
            'cursor-grab stroke-primary-warm-white focus-visible:stroke-primary-comfy-yellow focus-visible:outline-none',
            !ring.front && 'opacity-60'
          )
        "
        stroke-width="2"
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
        r="4.5"
        class="cursor-grab fill-primary-warm-white focus-visible:stroke-primary-comfy-yellow focus-visible:outline-none"
        stroke-width="2"
        :aria-label="lc('relight.orbit.height', locale)"
        :aria-valuenow="orbit.height"
        aria-valuemin="-90"
        aria-valuemax="90"
        @pointerdown="grab('height', $event)"
        @keydown="nudge('height', $event)"
      />
    </svg>
    <span
      class="pointer-events-none absolute top-2 right-2.5 text-[11px] text-primary-warm-white tabular-nums"
      data-testid="relight-orbit-readout"
      >{{ light.direction }}° · {{ light.elevation }}°</span
    >
  </div>
</template>
