<script setup lang="ts">
import { ref } from 'vue'

import { useCameraWidget } from '../../composables/useCameraWidget'
import { azimuthLabel, distanceLabel, elevationLabel } from './cameraVocabulary'

const SCENE_PALETTE = {
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

const azimuth = defineModel<number>('azimuth', { default: 0 })
const elevation = defineModel<number>('elevation', { default: 0 })
const zoom = defineModel<number>('zoom', { default: 5 })

const sceneContainer = ref<HTMLElement>()

const { ready: sceneReady } = useCameraWidget(
  sceneContainer,
  { azimuth, elevation, zoom },
  { palette: SCENE_PALETTE, image: () => '/hero/input.webp' }
)
</script>

<template>
  <div
    class="relative flex size-full flex-col rounded-[1.25em] border border-white/12 bg-[#242428]"
  >
    <div class="flex h-[2.25em] shrink-0 items-center px-[1.05em]">
      <span class="size-[0.55em] rounded-full bg-primary-comfy-yellow" />
      <span class="ml-auto flex items-center gap-[0.5em]">
        <span
          class="ppformula-text-center inline-block font-formula text-[0.75em] leading-[1.1] font-bold tracking-[-0.01em] text-primary-comfy-canvas"
        >
          3D ANGLE
        </span>
        <span class="size-[0.55em] rounded-full bg-primary-comfy-yellow" />
      </span>
    </div>

    <div class="min-h-0 flex-1 px-[0.9em] pb-[0.9em]">
      <div
        ref="sceneContainer"
        data-camera-scene
        class="relative size-full touch-none overflow-hidden rounded-[0.75em] bg-[#3a3a3e] motion-reduce:pointer-events-none"
        :class="sceneReady ? 'opacity-100' : 'opacity-0'"
        style="transition: opacity 300ms"
      />
    </div>

    <div class="sr-only">
      <label>
        Horizontal angle
        <input
          type="range"
          min="0"
          max="360"
          step="1"
          :value="azimuth"
          :aria-valuetext="azimuthLabel(azimuth)"
          @input="azimuth = ($event.target as HTMLInputElement).valueAsNumber"
        />
      </label>
      <label>
        Vertical angle
        <input
          type="range"
          min="-30"
          max="60"
          step="1"
          :value="elevation"
          :aria-valuetext="elevationLabel(elevation)"
          @input="elevation = ($event.target as HTMLInputElement).valueAsNumber"
        />
      </label>
      <label>
        Zoom
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          :value="zoom"
          :aria-valuetext="distanceLabel(zoom)"
          @input="zoom = ($event.target as HTMLInputElement).valueAsNumber"
        />
      </label>
    </div>
  </div>
</template>
