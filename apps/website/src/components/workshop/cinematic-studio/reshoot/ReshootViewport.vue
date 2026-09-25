<script setup lang="ts">
import { LoaderCircle, Move3d } from '@lucide/vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DepthState } from '../../../../composables/useReshootDemo'
import type { ReshootCamera } from '../../../../lib/workshop/cinematic-studio/reshoot'
import {
  cameraZone,
  clampAxis,
  viewTransform
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import ReshootZone from './ReshootZone.vue'

const {
  clip,
  camera,
  depth,
  locale = 'en'
} = defineProps<{
  clip: string
  camera: Readonly<ReshootCamera>
  depth: DepthState
  locale?: Locale
}>()

const emit = defineEmits<{ aim: [patch: Partial<ReshootCamera>] }>()

const ready = computed(() => depth === 'ready')
const transform = computed(() =>
  ready.value ? viewTransform(camera) : undefined
)
const notice = computed(() => {
  if (depth === 'stale') return rc('reshoot.stale', locale)
  if (depth === 'none') return rc('reshoot.needsDepth', locale)
  return undefined
})

const dragFrom = ref<{ x: number; y: number }>()

function startDrag(event: PointerEvent) {
  if (!ready.value) return
  dragFrom.value = { x: event.clientX, y: event.clientY }
  if (event.target instanceof Element)
    event.target.setPointerCapture?.(event.pointerId)
}

function drag(event: PointerEvent) {
  if (!dragFrom.value) return
  const dx = event.clientX - dragFrom.value.x
  const dy = event.clientY - dragFrom.value.y
  dragFrom.value = { x: event.clientX, y: event.clientY }
  emit('aim', {
    azimuth: clampAxis('azimuth', Math.round(camera.azimuth + dx * 0.3)),
    elevation: clampAxis('elevation', Math.round(camera.elevation - dy * 0.3))
  })
}

function zoom(event: WheelEvent) {
  if (!ready.value) return
  event.preventDefault()
  const next = camera.distance + Math.sign(event.deltaY) * 0.05
  emit('aim', { distance: Number(clampAxis('distance', next).toFixed(2)) })
}
</script>

<template>
  <div
    :class="
      cn(
        'relative grid size-full touch-none place-items-center overflow-hidden rounded-md bg-primary-comfy-ink select-none',
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
    <video
      :src="clip"
      autoplay
      muted
      loop
      playsinline
      class="max-h-full max-w-full transition-transform duration-150 ease-out"
      :style="{ transform }"
    />
    <div
      v-if="depth === 'analyzing'"
      class="absolute inset-0 grid place-items-center bg-primary-comfy-ink/70"
      role="status"
    >
      <span class="flex items-center gap-2.5 text-sm text-primary-warm-white">
        <LoaderCircle
          class="size-4 text-primary-comfy-yellow motion-safe:animate-spin"
          aria-hidden="true"
        />
        {{ rc('reshoot.analyzing', locale) }}
      </span>
    </div>
    <p
      v-else-if="notice"
      class="absolute inset-x-4 bottom-4 mx-auto w-fit rounded-full border border-transparency-white-t8 bg-primary-comfy-ink/80 px-3.5 py-2 text-center text-xs text-primary-comfy-canvas"
    >
      {{ notice }}
    </p>
    <div
      v-else
      class="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 text-xs text-primary-warm-white"
    >
      <span
        class="flex items-center gap-2 rounded-full bg-primary-comfy-ink/80 px-3 py-1.5"
      >
        <Move3d class="size-3.5" aria-hidden="true" />
        {{ rc('reshoot.dragHint', locale) }}
      </span>
      <span
        class="flex items-center gap-2 rounded-full bg-primary-comfy-ink/80 px-3 py-1.5 font-mono tabular-nums"
      >
        <ReshootZone :zone="cameraZone(camera)" dot-only />
        {{ camera.azimuth }}° · {{ camera.elevation }}°
      </span>
    </div>
  </div>
</template>
