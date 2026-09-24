<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCameraWidget } from '../../composables/useCameraWidget'
import {
  azimuthLabel,
  distanceLabel,
  elevationLabel
} from '../hero/cameraVocabulary'
import type { Locale } from '../../i18n/translations'
import { tHub } from '../../i18n/hub'

// Where the camera stands, asked as a camera rather than as three numbers.
// The workflow underneath takes degrees and a distance, and the node it came
// from names each reading in the words a photographer would use, so the reader
// moves the camera and reads back "front view, eye-level shot" instead of
// guessing what 315 means.
const { subject, locale = 'en' } = defineProps<{
  /** The picture the pose is being chosen for, shown on the card in the scene. */
  subject?: string
  locale?: Locale
}>()

const azimuth = defineModel<number>('azimuth', { required: true })
const elevation = defineModel<number>('elevation', { required: true })
const zoom = defineModel<number>('zoom', { required: true })

const PANEL_PALETTE = {
  azimuth: 0xe6e6e6,
  elevation: 0x9a9a9a,
  distance: 0xf2ff59,
  camera: 0xf2ff59,
  fill: 0xffffff,
  frame: 0xb8b8b8,
  cardFront: 0x808080,
  background: null,
  showGrid: false,
  showGlowRing: true,
  showGlows: false
} as const

const scene = ref<HTMLElement>()

const { ready } = useCameraWidget(
  scene,
  { azimuth, elevation, zoom },
  { palette: PANEL_PALETTE, image: () => subject ?? null }
)

// One sentence for the three readings, in the node's own vocabulary. It is
// what the workflow will actually be told, so it doubles as the answer the
// reader is giving.
const reading = computed(
  () =>
    `${azimuthLabel(azimuth.value)} · ${elevationLabel(elevation.value)} · ${distanceLabel(zoom.value)}`
)

const sliders = computed(() => [
  {
    key: 'azimuth',
    label: tHub('workshop.v2.camera.around', locale),
    model: azimuth,
    min: 0,
    max: 360,
    step: 1,
    reading: azimuthLabel(azimuth.value)
  },
  {
    key: 'elevation',
    label: tHub('workshop.v2.camera.height', locale),
    model: elevation,
    min: -30,
    max: 60,
    step: 1,
    reading: elevationLabel(elevation.value)
  },
  {
    key: 'zoom',
    label: tHub('workshop.v2.camera.distance', locale),
    model: zoom,
    min: 0,
    max: 10,
    step: 0.1,
    reading: distanceLabel(zoom.value)
  }
])

const track =
  'h-1 w-full cursor-pointer appearance-none rounded-full bg-transparency-white-t20 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary-comfy-yellow [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-comfy-yellow'
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="workflow-run-camera">
    <div class="flex min-w-0 flex-col gap-0.5">
      <span
        class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ tHub('workshop.v2.camera.title', locale) }}
      </span>
      <p class="text-xs text-primary-warm-gray" data-testid="camera-reading">
        {{ reading }}
      </p>
    </div>

    <!-- Dragging the camera is the quick way and the pointer's alone, so the
      three readings below it stay the way anyone can set the same pose. -->
    <div
      ref="scene"
      aria-hidden="true"
      class="relative aspect-4/3 w-full touch-none overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 transition-opacity duration-300 motion-reduce:pointer-events-none"
      :class="ready ? 'opacity-100' : 'opacity-0'"
      data-testid="camera-scene"
    />

    <div class="flex flex-col gap-3">
      <label
        v-for="slider in sliders"
        :key="slider.key"
        class="flex flex-col gap-1.5"
      >
        <span class="flex items-baseline justify-between gap-2 text-xs">
          <span class="text-primary-warm-gray">{{ slider.label }}</span>
          <span class="text-primary-warm-white">{{ slider.reading }}</span>
        </span>
        <input
          type="range"
          :min="slider.min"
          :max="slider.max"
          :step="slider.step"
          :value="slider.model.value"
          :aria-valuetext="slider.reading"
          :class="track"
          :data-testid="`camera-${slider.key}`"
          @input="
            slider.model.value = (
              $event.target as HTMLInputElement
            ).valueAsNumber
          "
        />
      </label>
    </div>
  </div>
</template>
