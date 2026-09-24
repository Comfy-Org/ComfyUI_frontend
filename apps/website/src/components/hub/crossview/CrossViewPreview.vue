<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch
} from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Keyframe, Pose } from './camera'
import { focalPx, invertPose, orbitPose, sourceAim, zoneOf } from './camera'
import { copy } from './copy'
import type { Geometry } from './cvgeo'
import { WarpRenderer } from './warp-renderer'

// The live warp: the frame the generation will be guided by, re-drawn on the
// GPU as the camera moves. Dragging the picture orbits; the wheel dollies.
const {
  geometry,
  pose,
  hfov,
  keepSourceAim,
  keyframes,
  disabled = false
} = defineProps<{
  geometry: Geometry
  /** The pose at the playhead, pivot included. */
  pose: Pose
  hfov: number
  keepSourceAim: boolean
  keyframes: readonly Keyframe[]
  disabled?: boolean
}>()

const frame = defineModel<number>('frame', { required: true })

const emit = defineEmits<{
  orbit: [az: number, el: number]
  dolly: [step: number]
  key: []
}>()

const canvas = ref<HTMLCanvasElement>()
const renderer = shallowRef<WarpRenderer>()
const bitmaps = shallowRef<ImageBitmap[]>([])
const failure = ref<string>()
const playing = ref(false)
/** The hint stays until the preview has been dragged or scrolled once. */
const touched = ref(false)

const onKey = computed(() => keyframes.some((k) => k.f === frame.value))
const zone = computed(() => zoneOf(wrap(pose.az), pose.el))
// A held keyframed pose can carry an unwrapped azimuth (-315 for 45).
const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180
const shownAz = computed(() => wrap(pose.az).toFixed(0))

function draw() {
  const r = renderer.value
  const bitmap = bitmaps.value[frame.value - 1]
  if (!r || !bitmap) return
  const { width, height } = geometry
  const pivot = [pose.px, pose.py, pose.pz] as const
  const target = orbitPose(
    pose.az,
    pose.el,
    pose.dist,
    pivot,
    keepSourceAim ? sourceAim(pivot) : undefined
  )
  r.render({
    inverseTarget: invertPose(target),
    fx: focalPx(width, hfov),
    cx: width / 2,
    cy: height / 2 + pose.vs * height
  })
}

let loadedFrame = 0
function show() {
  const r = renderer.value
  const i = frame.value - 1
  const bitmap = bitmaps.value[i]
  if (!r || !bitmap) return
  if (loadedFrame !== frame.value) {
    r.setFrame(bitmap, geometry.depthHalf[i], geometry.depth[i])
    loadedFrame = frame.value
  }
  draw()
}

onMounted(async () => {
  try {
    renderer.value = new WarpRenderer(
      canvas.value!,
      geometry.width,
      geometry.height
    )
  } catch {
    failure.value = copy.noWebgl
    return
  }
  bitmaps.value = await Promise.all(
    geometry.jpegs.map((jpeg) => createImageBitmap(jpeg))
  )
  show()
})

onBeforeUnmount(() => {
  playing.value = false
  renderer.value?.dispose()
  for (const b of bitmaps.value) b.close()
})

watch(frame, show)
watch(
  () => [pose, hfov, keepSourceAim],
  () => draw(),
  { deep: true }
)

// --- orbit by dragging the picture, as the node's own preview does
const DRAG_SENS = 0.35
let drag: { x: number; y: number; az: number; el: number } | undefined

function onPointerDown(event: PointerEvent) {
  if (disabled) return
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  touched.value = true
  drag = { x: event.clientX, y: event.clientY, az: pose.az, el: pose.el }
}
function onPointerMove(event: PointerEvent) {
  if (!drag) return
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v))
  emit(
    'orbit',
    Math.round(
      clamp(drag.az + (event.clientX - drag.x) * DRAG_SENS, -180, 180)
    ),
    Math.round(clamp(drag.el - (event.clientY - drag.y) * DRAG_SENS, -90, 90))
  )
}
function onPointerUp() {
  drag = undefined
}
function onWheel(event: WheelEvent) {
  if (disabled) return
  event.preventDefault()
  touched.value = true
  emit('dolly', Math.sign(event.deltaY) * 0.05)
}

// --- playback, self-clocked at the clip's 24 fps
let timer: number | undefined
watch(playing, (on) => {
  window.clearInterval(timer)
  if (!on) return
  timer = window.setInterval(() => {
    frame.value = frame.value >= geometry.frames ? 1 : frame.value + 1
  }, 1000 / geometry.fps)
})

const markers = computed(() =>
  keyframes.map((k) => ({
    f: k.f,
    left: `${((k.f - 1) / Math.max(1, geometry.frames - 1)) * 100}%`
  }))
)

const zoneClass = {
  green: 'bg-success-background',
  yellow: 'bg-primary-comfy-yellow',
  red: 'bg-primary-comfy-red'
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="crossview-preview">
    <div
      :class="
        cn(
          'group relative overflow-hidden rounded-xl bg-black ring-primary-comfy-yellow/50 transition-shadow',
          !disabled && 'hover:ring-2'
        )
      "
      :style="{ aspectRatio: `${geometry.width} / ${geometry.height}` }"
    >
      <canvas
        ref="canvas"
        :class="
          cn(
            'size-full touch-none select-none',
            disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
          )
        "
        data-testid="crossview-canvas"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel="onWheel"
      />
      <p
        v-if="failure"
        class="absolute inset-0 grid place-items-center p-6 text-center text-sm text-primary-warm-gray"
      >
        {{ failure }}
      </p>
      <div
        class="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-primary-warm-white tabular-nums"
      >
        <span :class="cn('size-2 rounded-full', zoneClass[zone])" />
        az {{ shownAz }}° · el {{ pose.el.toFixed(0) }}° · dist
        {{ pose.dist.toFixed(2) }}
      </div>
      <div
        v-if="!disabled && !failure"
        :class="
          cn(
            'pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-1.5 text-xs font-bold text-primary-warm-white transition-opacity',
            touched ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
          )
        "
        data-testid="crossview-drag-hint"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"
          />
        </svg>
        {{ copy.dragHint }}
      </div>
      <!-- Whatever the page lays over the picture, e.g. a run in progress. -->
      <slot />
    </div>

    <p class="text-xs text-primary-warm-gray" data-testid="crossview-zone">
      {{ copy.zones[zone] }}
    </p>

    <div class="flex items-center gap-3">
      <button
        type="button"
        class="h-8 shrink-0 rounded-full border border-transparency-white-t20 px-3 text-xs font-bold text-primary-warm-white hover:border-primary-comfy-yellow"
        data-testid="crossview-play"
        @click="playing = !playing"
      >
        {{ playing ? copy.pause : copy.play }}
      </button>
      <div class="relative flex-1">
        <input
          v-model.number="frame"
          type="range"
          min="1"
          :max="geometry.frames"
          step="1"
          class="w-full accent-primary-comfy-yellow"
          :aria-label="copy.frame(frame, geometry.frames)"
          data-testid="crossview-scrub"
        />
        <span
          v-for="m in markers"
          :key="m.f"
          class="pointer-events-none absolute top-full mt-0.5 size-2 -translate-x-1/2 rotate-45 bg-primary-comfy-yellow"
          :style="{ left: m.left }"
        />
      </div>
      <button
        type="button"
        :disabled
        :class="
          cn(
            // one width for both labels, so the row does not jump on a key
            'h-8 w-28 shrink-0 rounded-full border px-3 text-center text-xs font-bold whitespace-nowrap disabled:opacity-50',
            onKey
              ? 'border-primary-comfy-yellow bg-primary-comfy-yellow text-primary-comfy-ink'
              : 'border-transparency-white-t20 text-primary-warm-white hover:border-primary-comfy-yellow'
          )
        "
        data-testid="crossview-key"
        @click="emit('key')"
      >
        {{ onKey ? copy.unkey : copy.key }}
      </button>
      <span
        class="w-28 shrink-0 text-right text-xs text-primary-warm-gray tabular-nums"
      >
        {{ copy.frame(frame, geometry.frames) }}
      </span>
    </div>
  </div>
</template>
