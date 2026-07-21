<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

import type { CameraWidget } from './camera/CameraWidget'
import { azimuthLabel, distanceLabel, elevationLabel } from './cameraVocabulary'

const INPUT_IMAGE_URL = '/hero/input.webp'

const SCENE_PALETTE = {
  azimuth: 0xe6e6e6,
  elevation: 0x9a9a9a,
  distance: 0xf2ff59,
  camera: 0xf2ff59,
  fill: 0xffffff,
  frame: 0xb8b8b8,
  background: null,
  showGrid: false,
  showGlowRing: false,
  showGlows: false
} as const

const azimuth = defineModel<number>('azimuth', { default: 0 })
const elevation = defineModel<number>('elevation', { default: 0 })
const zoom = defineModel<number>('zoom', { default: 5 })

const sceneContainer = ref<HTMLElement>()
const sceneReady = ref(false)

let widget: CameraWidget | null = null
let unmounted = false
let syncingFromWidget = false
let intersecting = true
let initObserver: IntersectionObserver | null = null
let pauseObserver: IntersectionObserver | null = null

function syncPause() {
  if (!widget) return
  if (document.hidden || !intersecting) widget.pause()
  else widget.resume()
}

async function initScene(container: HTMLElement) {
  await new Promise<void>((resolve) => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => resolve())
    else setTimeout(resolve, 200)
  })
  if (unmounted || widget) return

  const { CameraWidget: Widget } = await import('./camera/CameraWidget')
  if (unmounted) return

  widget = new Widget({
    container,
    palette: SCENE_PALETTE,
    initialState: {
      azimuth: azimuth.value,
      elevation: elevation.value,
      distance: zoom.value,
      imageUrl: INPUT_IMAGE_URL
    },
    onStateChange: (state) => {
      syncingFromWidget = true
      azimuth.value = state.azimuth
      elevation.value = state.elevation
      zoom.value = state.distance
      syncingFromWidget = false
    }
  })
  sceneReady.value = true

  pauseObserver = new IntersectionObserver(([entry]) => {
    intersecting = entry.isIntersecting
    syncPause()
  })
  pauseObserver.observe(container)
  document.addEventListener('visibilitychange', syncPause)
}

watch(
  [azimuth, elevation, zoom],
  ([a, e, z]) => {
    if (syncingFromWidget || !widget) return
    widget.setState({ azimuth: a, elevation: e, distance: z })
  },
  { flush: 'sync' }
)

onMounted(() => {
  const container = sceneContainer.value
  if (!container) return
  initObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      initObserver?.disconnect()
      initObserver = null
      void initScene(container)
    },
    { rootMargin: '100px' }
  )
  initObserver.observe(container)
})

onUnmounted(() => {
  unmounted = true
  initObserver?.disconnect()
  pauseObserver?.disconnect()
  document.removeEventListener('visibilitychange', syncPause)
  widget?.dispose()
  widget = null
})
</script>

<template>
  <div
    class="relative flex size-full flex-col rounded-[1.25em] border border-white/12 bg-[#242428]"
  >
    <div class="flex h-[2.25em] shrink-0 items-center px-[1.05em]">
      <span class="bg-primary-comfy-yellow size-[0.55em] rounded-full" />
      <span class="ml-auto flex items-center gap-[0.5em]">
        <span
          class="font-formula text-[0.75em] font-semibold tracking-[0.14em] text-white"
        >
          3D ANGLE
        </span>
        <span class="bg-primary-comfy-yellow size-[0.55em] rounded-full" />
      </span>
    </div>

    <div class="min-h-0 flex-1 px-[0.9em] pb-[0.9em]">
      <div
        ref="sceneContainer"
        data-camera-scene
        class="relative size-full touch-none overflow-hidden rounded-[0.75em] bg-[#3a3a3e]"
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
