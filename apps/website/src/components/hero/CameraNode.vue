<script setup lang="ts">
import { RotateCcw } from '@lucide/vue'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import type { CameraWidget } from './camera/CameraWidget'
import {
  AZIMUTH_PRESETS,
  DEFAULT_POSE,
  DISTANCE_PRESETS,
  ELEVATION_PRESETS,
  azimuthLabel,
  distanceLabel,
  elevationLabel,
  promptString
} from './cameraVocabulary'
import GraphNode from './GraphNode.vue'
import NodeSliderRow from './NodeSliderRow.vue'
import NodeToggleRow from './NodeToggleRow.vue'

const INPUT_IMAGE_URL = '/hero/input.webp'

const collapsed = defineModel<boolean>('collapsed', { default: false })
const azimuth = defineModel<number>('azimuth', { default: 0 })
const elevation = defineModel<number>('elevation', { default: 0 })
const zoom = defineModel<number>('zoom', { default: 5 })
const defaultPrompts = defineModel<boolean>('defaultPrompts', {
  default: false
})
const cameraView = defineModel<boolean>('cameraView', { default: false })

const prompt = computed(() =>
  promptString({
    azimuth: azimuth.value,
    elevation: elevation.value,
    zoom: zoom.value
  })
)

const CAMERA_LABEL_WIDTH = 'w-[8.5em] whitespace-nowrap'

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
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => resolve())
    } else {
      setTimeout(resolve, 200)
    }
  })
  if (unmounted || widget) return

  const { CameraWidget: Widget } = await import('./camera/CameraWidget')
  if (unmounted) return

  widget = new Widget({
    container,
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
  widget.setCameraView(cameraView.value)
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

watch(cameraView, (enabled) => widget?.setCameraView(enabled))

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

const azimuthPreset = computed({
  get: () => {
    let best = AZIMUTH_PRESETS[0].value
    let bestDiff = Number.POSITIVE_INFINITY
    for (const { value } of AZIMUTH_PRESETS) {
      const diff = Math.min(
        Math.abs(azimuth.value - value),
        Math.abs(azimuth.value - value - 360),
        Math.abs(azimuth.value - value + 360)
      )
      if (diff < bestDiff) {
        bestDiff = diff
        best = value
      }
    }
    return best
  },
  set: (value) => {
    azimuth.value = value
  }
})

const elevationPreset = computed({
  get: () => {
    let best = ELEVATION_PRESETS[0].value
    let bestDiff = Number.POSITIVE_INFINITY
    for (const { value } of ELEVATION_PRESETS) {
      const diff = Math.abs(elevation.value - value)
      if (diff < bestDiff) {
        bestDiff = diff
        best = value
      }
    }
    return best
  },
  set: (value) => {
    elevation.value = value
  }
})

const distancePreset = computed({
  get: () => {
    if (zoom.value < 2) return 1
    if (zoom.value < 6) return 4
    return 8
  },
  set: (value) => {
    zoom.value = value
  }
})

function reset() {
  azimuth.value = DEFAULT_POSE.azimuth
  elevation.value = DEFAULT_POSE.elevation
  zoom.value = DEFAULT_POSE.zoom
}

const PRESET_CONTROLS = [
  {
    key: 'H',
    label: 'Horizontal angle preset',
    labelClass: 'text-[#e93d82]',
    model: azimuthPreset,
    options: AZIMUTH_PRESETS
  },
  {
    key: 'V',
    label: 'Vertical angle preset',
    labelClass: 'text-[#00ffd0]',
    model: elevationPreset,
    options: ELEVATION_PRESETS
  },
  {
    key: 'Z',
    label: 'Zoom preset',
    labelClass: 'text-[#ffb800]',
    model: distancePreset,
    options: DISTANCE_PRESETS
  }
]
</script>

<template>
  <GraphNode
    v-model:collapsed="collapsed"
    title="Qwen Multiangle Camera"
    badge="comfyui-qwenmultiangle"
    grip
    :ports="[
      {
        input: { label: 'image', type: 'IMAGE', connected: true },
        output: { label: 'Prompt', type: 'STRING' }
      },
      { output: { label: 'Camera Info', type: 'CAMERA' } }
    ]"
  >
    <NodeSliderRow
      v-model="azimuth"
      label="Horizontal Angle"
      :min="0"
      :max="360"
      :step="1"
      :display="String(Math.round(azimuth))"
      :value-text="azimuthLabel(azimuth)"
      :label-width="CAMERA_LABEL_WIDTH"
      notch
    />
    <NodeSliderRow
      v-model="elevation"
      label="Vertical Angle"
      :min="-30"
      :max="60"
      :step="1"
      :display="String(Math.round(elevation))"
      :value-text="elevationLabel(elevation)"
      :label-width="CAMERA_LABEL_WIDTH"
      notch
    />
    <NodeSliderRow
      v-model="zoom"
      label="Zoom"
      :min="0"
      :max="10"
      :step="0.1"
      :display="zoom.toFixed(1)"
      :value-text="distanceLabel(zoom)"
      :label-width="CAMERA_LABEL_WIDTH"
      notch
    />
    <NodeToggleRow v-model="defaultPrompts" label="Default Prompts" notch />
    <NodeToggleRow v-model="cameraView" label="Camera View" notch />

    <p
      class="rounded-[0.375em] border border-[#e93d82]/40 bg-black/40 px-[0.6em] py-[0.4em] font-mono text-[0.7em] text-[#e93d82]"
    >
      {{ prompt }}
    </p>

    <div
      ref="sceneContainer"
      data-camera-scene
      class="relative touch-none overflow-hidden rounded-[0.375em] bg-[#0a0a0f]"
    >
      <img
        src="/hero/camera-poster.webp"
        alt=""
        aria-hidden="true"
        :width="532"
        :height="524"
        :class="sceneReady ? 'opacity-0' : 'opacity-100'"
        class="w-full transition-opacity duration-300"
        decoding="async"
      />

      <div
        class="absolute inset-x-[0.5em] bottom-[0.5em] z-10 flex flex-col gap-[0.25em] rounded-[0.375em] border border-[#e93d82]/30 bg-[#0a0a0f]/90 px-[0.625em] py-[0.375em] backdrop-blur-sm"
      >
        <div class="flex items-center justify-between gap-[0.5em]">
          <label
            v-for="control in PRESET_CONTROLS"
            :key="control.key"
            class="flex min-w-0 flex-1 items-center gap-[0.3em]"
          >
            <span
              :class="`text-[0.5625em] font-semibold tracking-wider ${control.labelClass}`"
            >
              {{ control.key }}
            </span>
            <span class="relative min-w-0 flex-1">
              <select
                v-model="control.model.value"
                :aria-label="control.label"
                class="w-full min-w-0 cursor-pointer appearance-none rounded-[0.25em] border border-white/20 bg-transparent py-[0.125em] pr-[1em] pl-[0.375em] text-[0.5625em] text-white/80 outline-none"
              >
                <option
                  v-for="option in control.options"
                  :key="option.value"
                  :value="option.value"
                  class="bg-primary-comfy-ink-light"
                >
                  {{ option.label }}
                </option>
              </select>
              <svg
                class="pointer-events-none absolute top-1/2 right-[0.25em] size-[0.55em] -translate-y-1/2 text-white/50"
                viewBox="0 0 10 6"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path d="m1 1 4 4 4-4" />
              </svg>
            </span>
          </label>
        </div>
        <div class="flex items-center justify-around">
          <span class="text-[0.8125em] font-semibold text-[#e93d82]">
            {{ Math.round(azimuth) }}°
          </span>
          <span class="text-[0.8125em] font-semibold text-[#00ffd0]">
            {{ Math.round(elevation) }}°
          </span>
          <span class="text-[0.8125em] font-semibold text-[#ffb800]">
            {{ zoom.toFixed(1) }}
          </span>
          <button
            type="button"
            class="flex size-[1.25em] cursor-pointer items-center justify-center rounded-[0.25em] border border-[#e93d82]/40 text-[#e93d82] hover:bg-[#e93d82]/20"
            aria-label="Reset camera to defaults"
            @click="reset"
          >
            <RotateCcw class="size-[0.7em]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </GraphNode>
</template>
