<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import type { LightMapView } from '@/lib/workshop/relight/light-map'
import {
  MAP_CENTER,
  MAP_RIM,
  fromMapPoint,
  mapPoint,
  mapValue,
  nudgeMap
} from '@/lib/workshop/relight/light-map'
import type { Light } from '@/lib/workshop/relight/lights'

const {
  view,
  lights,
  selected,
  locale = 'en'
} = defineProps<{
  view: LightMapView
  lights: readonly Light[]
  selected?: string
  locale?: Locale
}>()

const emit = defineEmits<{
  select: [id: string]
  change: [id: string, patch: Partial<Light>]
}>()

const svg = useTemplateRef<SVGSVGElement>('svg')
const dragging = ref<string>()
const dots = computed(() =>
  lights
    .map((light) => ({
      light,
      at: mapPoint(light, view),
      size: 3 + (light.intensity / 100) * 3,
      strength: 0.45 + (light.intensity / 100) * 0.55,
      on: light.id === selected
    }))
    .sort((a, b) => Number(a.on) - Number(b.on))
)

const RANGES = {
  point: { min: 0, max: 100 },
  top: { min: -180, max: 180 },
  side: { min: -90, max: 90 }
} as const
const DOT_LABEL = {
  top: 'relight.map.dot.top',
  side: 'relight.map.dot.side'
} as const
const VALUE_TEXT = {
  point: { top: 'relight.map.across', side: 'relight.map.up' },
  directional: { top: 'relight.map.around', side: 'relight.map.height' }
} as const

const range = (light: Light) => RANGES[light.kind === 'point' ? 'point' : view]
const valueText = (light: Light) =>
  lc(VALUE_TEXT[light.kind][view], locale, { n: mapValue(light, view) })

function boxPoint(event: PointerEvent) {
  const box = svg.value?.getBoundingClientRect()
  if (!box?.width || !box.height) return undefined
  return {
    x: ((event.clientX - box.left) / box.width) * 100,
    y: ((event.clientY - box.top) / box.height) * 100
  }
}

function move(event: PointerEvent) {
  const light = lights.find((candidate) => candidate.id === dragging.value)
  const at = boxPoint(event)
  if (light && at)
    emit('change', light.id, fromMapPoint(light, view, at.x, at.y))
}

function grab(light: Light, event: PointerEvent) {
  event.preventDefault()
  if (event.currentTarget instanceof SVGElement) {
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  emit('select', light.id)
  dragging.value = light.id
}

function nudge(light: Light, event: KeyboardEvent) {
  const patch = nudgeMap(light, view, event.key, event.shiftKey ? 15 : 5)
  if (!patch) return
  event.preventDefault()
  emit('change', light.id, patch)
}
</script>

<template>
  <svg
    ref="svg"
    viewBox="0 0 100 100"
    class="size-20 touch-none overflow-visible sm:size-28"
    :data-testid="`relight-map-${view}`"
  >
    <circle
      :cx="MAP_CENTER"
      :cy="MAP_CENTER"
      :r="MAP_RIM"
      fill="none"
      class="stroke-transparency-white-t20"
      stroke-dasharray="2 3"
    />
    <g class="fill-transparency-white-t20 stroke-transparency-white-t20">
      <template v-if="view === 'top'">
        <ellipse :cx="MAP_CENTER" :cy="MAP_CENTER" rx="11" ry="5.5" />
        <circle
          :cx="MAP_CENTER"
          :cy="MAP_CENTER"
          r="5"
          class="fill-primary-warm-gray"
        />
      </template>
      <template v-else>
        <circle
          :cx="MAP_CENTER"
          :cy="MAP_CENTER - 8"
          r="5"
          class="fill-primary-warm-gray"
        />
        <path
          :d="`M${MAP_CENTER - 5} ${MAP_CENTER + 14} v-12 a5 5 0 0 1 10 0 v12 z`"
        />
      </template>
    </g>
    <g
      class="fill-primary-warm-gray"
      :transform="
        view === 'top'
          ? `translate(${MAP_CENTER} 96)`
          : `translate(4 ${MAP_CENTER}) rotate(90)`
      "
      aria-hidden="true"
    >
      <rect x="-5" y="-3" width="10" height="6" rx="1.5" />
      <path d="M-2.5 -3 L0 -6.5 L2.5 -3 z" />
    </g>
    <template v-for="{ light, at, size, strength, on } in dots" :key="light.id">
      <line
        v-if="on"
        :x1="MAP_CENTER"
        :y1="MAP_CENTER"
        :x2="at.x"
        :y2="at.y"
        :stroke="light.color"
        stroke-opacity="0.5"
        stroke-dasharray="1.5 2"
      />
      <g
        role="slider"
        tabindex="0"
        :aria-label="lc(DOT_LABEL[view], locale, { name: light.name })"
        :aria-valuenow="mapValue(light, view)"
        :aria-valuemin="range(light).min"
        :aria-valuemax="range(light).max"
        :aria-valuetext="valueText(light)"
        :class="
          cn(
            'group pointer-events-auto cursor-grab outline-none',
            dragging === light.id && 'cursor-grabbing',
            !light.visible && 'opacity-50'
          )
        "
        @pointerdown="grab(light, $event)"
        @pointermove="move"
        @pointerup="dragging = undefined"
        @pointercancel="dragging = undefined"
        @keydown="nudge(light, $event)"
        @focus="emit('select', light.id)"
      >
        <circle :cx="at.x" :cy="at.y" r="8" fill="transparent" />
        <circle
          :cx="at.x"
          :cy="at.y"
          :r="size + 3.5"
          fill="none"
          stroke-width="1.5"
          :class="
            cn(
              'stroke-primary-comfy-yellow opacity-0 group-focus-visible:opacity-100',
              on && 'stroke-primary-warm-white opacity-80'
            )
          "
        />
        <circle
          :cx="at.x"
          :cy="at.y"
          :r="size"
          :fill="light.color"
          :fill-opacity="strength"
          :stroke-dasharray="light.visible ? undefined : '1.5 1.5'"
          stroke-width="1"
          class="stroke-primary-warm-white"
        />
      </g>
    </template>
  </svg>
</template>
