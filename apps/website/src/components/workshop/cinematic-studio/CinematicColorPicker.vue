<script setup lang="ts">
import { clamp } from 'es-toolkit'
import { computed, ref, useTemplateRef, watch } from 'vue'

import type { Locale } from '../../../i18n/translations'
import type { Hsv } from '../../../lib/workshop/cinematic-studio/color-space'
import {
  hexToHsv,
  hsvToHex,
  isHex
} from '../../../lib/workshop/cinematic-studio/color-space'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const color = defineModel<string>({ required: true })

const hsv = ref<Hsv>(hexToHsv(color.value))
const hexText = ref(color.value)
watch(color, (next) => {
  if (next === hsvToHex(hsv.value)) return
  hsv.value = hexToHsv(next)
  hexText.value = next
})

function update(next: Hsv) {
  hsv.value = next
  color.value = hsvToHex(next)
  hexText.value = color.value
}

const area = useTemplateRef<HTMLElement>('area')

function pick(event: PointerEvent) {
  const box = area.value?.getBoundingClientRect()
  if (!box) return
  update({
    ...hsv.value,
    s: clamp((event.clientX - box.left) / box.width, 0, 1),
    v: 1 - clamp((event.clientY - box.top) / box.height, 0, 1)
  })
}

function startPick(event: PointerEvent) {
  area.value?.setPointerCapture(event.pointerId)
  pick(event)
}

const STEP = 0.02
const KEYS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-STEP, 0],
  ArrowRight: [STEP, 0],
  ArrowUp: [0, STEP],
  ArrowDown: [0, -STEP]
}

function nudge(event: KeyboardEvent) {
  const step = KEYS[event.key]
  if (!step) return
  event.preventDefault()
  update({
    ...hsv.value,
    s: clamp(hsv.value.s + step[0], 0, 1),
    v: clamp(hsv.value.v + step[1], 0, 1)
  })
}

function setHue(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  update({ ...hsv.value, h: Number(event.target.value) })
}

function commitHex() {
  const typed = hexText.value.trim()
  const hex = (typed.startsWith('#') ? typed : `#${typed}`).toLowerCase()
  if (isHex(hex)) update(hexToHsv(hex))
  else hexText.value = color.value
}

const hueColor = computed(() => hsvToHex({ h: hsv.value.h, s: 1, v: 1 }))
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      ref="area"
      role="slider"
      tabindex="0"
      :aria-label="tc('cinematic.colors.shade', locale)"
      :aria-valuetext="color"
      class="relative h-36 w-full cursor-crosshair touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/60"
      :style="{
        backgroundColor: hueColor,
        backgroundImage:
          'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)'
      }"
      @pointerdown="startPick"
      @pointermove="(event) => event.buttons && pick(event)"
      @keydown="nudge"
    >
      <span
        class="pointer-events-none absolute size-4 -translate-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
        :style="{
          left: `${hsv.s * 100}%`,
          top: `${(1 - hsv.v) * 100}%`,
          backgroundColor: color
        }"
        aria-hidden="true"
      />
    </div>
    <input
      type="range"
      min="0"
      max="360"
      :value="Math.round(hsv.h)"
      :aria-label="tc('cinematic.colors.hue', locale)"
      class="h-3 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)] [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
      @input="setHue"
    />
    <label class="flex items-center gap-2">
      <span
        class="size-8 shrink-0 rounded-lg ring-1 ring-transparency-white-t20 ring-inset"
        :style="{ backgroundColor: color }"
        aria-hidden="true"
      />
      <span class="sr-only">{{ tc('cinematic.colors.hex', locale) }}</span>
      <input
        v-model="hexText"
        type="text"
        spellcheck="false"
        maxlength="7"
        class="h-8 w-full rounded-lg bg-transparency-white-t4 px-2.5 font-mono text-sm text-primary-warm-white uppercase outline-none focus-visible:ring-1 focus-visible:ring-primary-comfy-yellow/60"
        @change="commitHex"
        @keydown.enter="commitHex"
      />
    </label>
  </div>
</template>
