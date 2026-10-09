<script setup lang="ts">
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Circle,
  CircleDot,
  Crosshair
} from '@lucide/vue'
import { computed, useId, useTemplateRef } from 'vue'

import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import { dialPoint, fromDial, nudgeDial } from '@/lib/workshop/relight/dial'
import type { Light } from '@/lib/workshop/relight/lights'
import { ORBIT_PRESETS, fromOrbit } from '@/lib/workshop/relight/orbit'
import EditorMenuButton from '@/components/workshop/app-editor/EditorMenuButton.vue'

const { light, locale = 'en' } = defineProps<{
  light: Light
  locale?: Locale
}>()

const emit = defineEmits<{
  change: [patch: Pick<Light, 'direction' | 'elevation'>, key?: string]
}>()

const RADIUS = 26
const PRESETS = {
  front: { label: 'relight.preset.front', icon: CircleDot },
  top: { label: 'relight.preset.top', icon: ArrowUp },
  left: { label: 'relight.preset.left', icon: ArrowLeft },
  back: { label: 'relight.preset.back', icon: Circle },
  bottom: { label: 'relight.preset.bottom', icon: ArrowDown },
  right: { label: 'relight.preset.right', icon: ArrowRight }
} as const

const glowId = useId()
const svg = useTemplateRef<SVGSVGElement>('svg')
const handle = computed(() => {
  const { x, y } = dialPoint(light.direction, light.elevation)
  return { x: 32 + x * RADIUS, y: 32 + y * RADIUS }
})
const presets = ORBIT_PRESETS.map(({ id }) => ({
  id,
  label: lc(PRESETS[id].label, locale),
  icon: PRESETS[id].icon
}))

function pickPreset(id: (typeof ORBIT_PRESETS)[number]['id']) {
  const preset = ORBIT_PRESETS.find((candidate) => candidate.id === id)
  if (preset) emit('change', fromOrbit(preset.around, preset.height))
}

let dragging = false

function aim(event: PointerEvent) {
  const box = svg.value?.getBoundingClientRect()
  if (!dragging || !box?.width) return
  const scale = (RADIUS / 32) * (box.width / 2)
  const x = (event.clientX - box.left - box.width / 2) / scale
  const y = (event.clientY - box.top - box.height / 2) / scale
  emit('change', fromDial(x, y, light.direction), 'dial')
}

function grab(event: PointerEvent) {
  event.preventDefault()
  svg.value?.focus()
  svg.value?.setPointerCapture?.(event.pointerId)
  dragging = true
  aim(event)
}

function nudge(event: KeyboardEvent) {
  const next = nudgeDial(
    light.direction,
    light.elevation,
    event.key,
    event.shiftKey ? 15 : 5
  )
  if (!next) return
  event.preventDefault()
  emit('change', next, 'dial')
}
</script>

<template>
  <div class="flex items-center gap-3 px-1">
    <svg
      ref="svg"
      viewBox="0 0 64 64"
      role="slider"
      tabindex="0"
      :aria-label="lc('relight.direction', locale)"
      :aria-valuenow="light.direction"
      aria-valuemin="-180"
      aria-valuemax="180"
      :aria-valuetext="
        lc('relight.dial.value', locale, {
          direction: light.direction,
          elevation: light.elevation
        })
      "
      class="size-15 shrink-0 cursor-grab touch-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-comfy-yellow/70"
      @pointerdown="grab"
      @pointermove="aim"
      @pointerup="dragging = false"
      @pointercancel="dragging = false"
      @keydown="nudge"
    >
      <defs>
        <radialGradient
          :id="glowId"
          :cx="handle.x"
          :cy="handle.y"
          r="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" :stop-color="light.color" stop-opacity="0.5" />
          <stop offset="1" :stop-color="light.color" stop-opacity="0" />
        </radialGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="31"
        class="fill-transparency-white-t4 stroke-transparency-white-t8"
      />
      <circle cx="32" cy="32" r="31" :fill="`url(#${glowId})`" />
      <circle
        cx="32"
        cy="32"
        :r="RADIUS / 2"
        fill="none"
        class="stroke-transparency-white-t20"
        stroke-dasharray="2 2.5"
      />
      <line
        x1="32"
        y1="32"
        :x2="handle.x"
        :y2="handle.y"
        class="stroke-transparency-white-t20"
      />
      <circle
        :cx="handle.x"
        :cy="handle.y"
        r="4.5"
        :fill="light.color"
        class="stroke-primary-warm-white"
        stroke-width="1.5"
      />
    </svg>
    <div class="flex min-w-0 flex-1 flex-col">
      <span class="text-xs text-primary-warm-gray">{{
        lc('relight.direction', locale)
      }}</span>
      <span
        class="text-[13px] text-primary-warm-white tabular-nums"
        data-testid="relight-dial-readout"
        >{{ light.direction }}° · {{ light.elevation }}°</span
      >
    </div>
    <EditorMenuButton
      :label="lc('relight.presets', locale)"
      :items="presets"
      :icon="Crosshair"
      icon-only
      end
      @pick="pickPreset"
    />
  </div>
</template>
