<script setup lang="ts">
import { LoaderCircle, Minus, Move3d, Plus } from '@lucide/vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DepthState } from '../../../../composables/useReshoot'
import type { ReshootCamera } from '../../../../lib/workshop/cinematic-studio/reshoot'
import {
  cameraZone,
  clampAxis,
  viewTransform
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { ReshootRunPhase } from '../../../../lib/workshop/cinematic-studio/reshoot-engine/run'
import type { Locale } from '../../../../i18n/translations'
import type { Pose } from '../../../../lib/workshop/cinematic-studio/reshoot-engine/camera'
import type { Geometry } from '../../../../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import ReshootWarp from './ReshootWarp.vue'
import ReshootZone from './ReshootZone.vue'

const {
  clip,
  camera,
  depth,
  stage,
  notice,
  aimable,
  geometry,
  pose,
  keepAim = true,
  frame = 0,
  generated = false,
  locale = 'en'
} = defineProps<{
  clip: string
  camera: Readonly<ReshootCamera>
  depth: DepthState
  stage?: ReshootRunPhase
  notice?: string
  aimable: boolean
  /** The analysed clip; with it, the view is the real warp, not a tilt. */
  geometry?: Geometry
  pose?: Pose
  keepAim?: boolean
  frame?: number
  /** Whether any take of the visitor's own has been generated. */
  generated?: boolean
  locale?: Locale
}>()

const noWebgl = ref(false)
const live = computed(
  () => ready.value && !!geometry && !!pose && !noWebgl.value
)

const emit = defineEmits<{ aim: [patch: Partial<ReshootCamera>] }>()

const ready = computed(() => aimable && depth === 'ready')
const transform = computed(() =>
  ready.value && !live.value ? viewTransform(camera) : undefined
)
const analyzing = computed(() =>
  rc(
    stage === 'starting'
      ? 'reshoot.stage.starting'
      : stage === 'queued'
        ? 'reshoot.stage.queued'
        : 'reshoot.analyzing',
    locale
  )
)

const frameLabel = computed(() =>
  rc(
    live.value ? 'reshoot.frameLabel.preview' : 'reshoot.frameLabel.original',
    locale
  )
)

const dragFrom = ref<{ x: number; y: number; tilts: boolean }>()

function startDrag(event: PointerEvent) {
  if (!ready.value) return
  dragFrom.value = {
    x: event.clientX,
    y: event.clientY,
    tilts: event.pointerType !== 'touch'
  }
  if (event.target instanceof Element)
    event.target.setPointerCapture?.(event.pointerId)
}

function drag(event: PointerEvent) {
  if (!dragFrom.value) return
  const dx = event.clientX - dragFrom.value.x
  const dy = event.clientY - dragFrom.value.y
  dragFrom.value = { ...dragFrom.value, x: event.clientX, y: event.clientY }
  emit('aim', {
    azimuth: clampAxis('azimuth', Math.round(camera.azimuth + dx * 0.3)),
    ...(dragFrom.value.tilts
      ? {
          elevation: clampAxis(
            'elevation',
            Math.round(camera.elevation - dy * 0.3)
          )
        }
      : {})
  })
}

function dolly(step: number) {
  const next = camera.distance + step * 0.05
  emit('aim', { distance: Number(clampAxis('distance', next).toFixed(2)) })
}

function zoom(event: WheelEvent) {
  if (!ready.value) return
  event.preventDefault()
  dolly(Math.sign(event.deltaY))
}

const DOLLY_BUTTONS = [
  { step: -1, label: 'reshoot.dolly.in', icon: Plus },
  { step: 1, label: 'reshoot.dolly.out', icon: Minus }
] as const
</script>

<template>
  <div
    :class="
      cn(
        'relative grid size-full touch-pan-y place-items-center overflow-hidden rounded-md bg-primary-comfy-ink select-none',
        ready && 'cursor-grab active:cursor-grabbing'
      )
    "
    data-testid="reshoot-viewport"
    @pointerdown="startDrag"
    @pointermove="drag"
    @pointerup="dragFrom = undefined"
    @pointercancel="dragFrom = undefined"
    @wheel="zoom"
  >
    <ReshootWarp
      v-if="live && geometry && pose"
      :geometry
      :pose
      :hfov="camera.fov"
      :keep-aim="keepAim"
      :frame
      @unsupported="noWebgl = true"
    />
    <video
      v-else
      :src="clip"
      autoplay
      muted
      loop
      playsinline
      class="max-h-full max-w-full transition-transform duration-150 ease-out"
      :style="{ transform }"
    />
    <p
      class="absolute top-3 left-3 z-10 flex max-w-[calc(100%-4.5rem)] items-center gap-1.5 truncate rounded-full bg-primary-comfy-ink/80 px-3 py-1.5 text-xs text-primary-warm-white"
      data-testid="reshoot-frame-label"
    >
      {{ frameLabel }}
      <span v-if="!generated" class="text-primary-warm-gray">
        · {{ rc('reshoot.frameLabel.nothingYet', locale) }}
      </span>
    </p>
    <div
      v-if="depth === 'analyzing'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-primary-comfy-ink/70 px-6 text-center"
      role="status"
    >
      <span class="flex items-center gap-2.5 text-sm text-primary-warm-white">
        <LoaderCircle
          class="size-4 text-primary-comfy-yellow motion-safe:animate-spin"
          aria-hidden="true"
        />
        {{ analyzing }}
      </span>
      <span class="text-xs text-primary-warm-gray">
        {{ rc('reshoot.pending.depthTime', locale) }}
      </span>
    </div>
    <p
      v-else-if="notice"
      class="absolute inset-x-4 bottom-4 mx-auto w-fit rounded-full border border-transparency-white-t8 bg-primary-comfy-ink/80 px-3.5 py-2 text-center text-xs text-primary-comfy-canvas"
    >
      {{ notice }}
    </p>
    <div
      v-else-if="ready"
      class="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 text-xs text-primary-warm-white"
    >
      <span
        class="flex min-w-0 items-center gap-2 rounded-full bg-primary-comfy-ink/80 px-3 py-1.5 whitespace-nowrap"
        data-testid="reshoot-drag-hint"
      >
        <Move3d class="size-3.5 shrink-0" aria-hidden="true" />
        <span class="truncate pointer-coarse:hidden">
          {{ rc('reshoot.dragHint', locale) }}
        </span>
        <span class="hidden truncate pointer-coarse:inline">
          {{ rc('reshoot.dragHint.touch', locale) }}
        </span>
      </span>
      <span
        class="flex shrink-0 items-center gap-2 rounded-full bg-primary-comfy-ink/80 px-3 py-1.5 font-mono whitespace-nowrap tabular-nums"
        data-testid="reshoot-angle-readout"
      >
        <ReshootZone :zone="cameraZone(camera)" dot-only />
        {{ camera.azimuth }}° · {{ camera.elevation }}°
      </span>
    </div>
    <div
      v-if="ready"
      class="absolute top-14 left-3 hidden flex-col gap-2 pointer-coarse:flex"
    >
      <button
        v-for="{ step, label, icon } in DOLLY_BUTTONS"
        :key="label"
        type="button"
        :aria-label="rc(label, locale)"
        class="grid size-9 place-items-center rounded-full bg-primary-comfy-ink/80 text-primary-warm-white"
        @pointerdown.stop
        @click="dolly(step)"
      >
        <component :is="icon" class="size-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
