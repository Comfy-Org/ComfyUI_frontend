<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

// A clip and what the workflow made of it, laid over each other and split
// where the reader drags, the way the catalogue cards show a workflow's two
// stills. Stacked one above the other they read as two results; over each
// other, with the seam in hand, they read as one change.
const { before, after, beforeLabel, afterLabel, label } = defineProps<{
  before: string
  after: string
  /** Named in the corner each one holds, so neither has to be guessed. */
  beforeLabel: string
  afterLabel: string
  /** What the seam is, for anyone moving it by keyboard. */
  label: string
}>()

const split = defineModel<number>('split', { default: 50 })

const frame = useTemplateRef<HTMLElement>('frame')
const lead = useTemplateRef<HTMLVideoElement>('lead')
const follow = useTemplateRef<HTMLVideoElement>('follow')

const still = prefersReducedMotion()

// The two are the same take from two cameras, so the seam only tells the truth
// while both stand on the same moment.
const DRIFT_SECONDS = 0.15
function keepTogether() {
  const first = lead.value
  const second = follow.value
  if (!first || !second) return
  if (Math.abs(second.currentTime - first.currentTime) > DRIFT_SECONDS)
    second.currentTime = first.currentTime
}

const held = (at: number) => Math.min(100, Math.max(0, at))

function moveTo(clientX: number) {
  const box = frame.value?.getBoundingClientRect()
  if (!box?.width) return
  split.value = held(((clientX - box.left) / box.width) * 100)
}

function grab(event: PointerEvent) {
  const on = event.currentTarget
  if (on instanceof HTMLElement) on.setPointerCapture(event.pointerId)
  moveTo(event.clientX)
}

function drag(event: PointerEvent) {
  if (event.buttons === 0) return
  moveTo(event.clientX)
}

const STEP = 4
function nudge(by: number) {
  split.value = held(split.value + by)
}
</script>

<template>
  <div
    ref="frame"
    class="relative aspect-video w-full touch-none overflow-hidden rounded-xl bg-black select-none"
    data-testid="hub-video-compare"
    @pointerdown="grab"
    @pointermove="drag"
  >
    <video
      ref="lead"
      :src="before"
      :autoplay="!still"
      muted
      loop
      playsinline
      preload="metadata"
      class="size-full object-cover"
      data-testid="hub-video-compare-before"
      @timeupdate="keepTogether"
    />
    <video
      ref="follow"
      :src="after"
      :autoplay="!still"
      aria-hidden="true"
      muted
      loop
      playsinline
      preload="metadata"
      class="absolute inset-0 size-full object-cover"
      :style="{ clipPath: `inset(0 ${100 - split}% 0 0)` }"
      data-testid="hub-video-compare-after"
    />

    <span
      class="pointer-events-none absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-primary-warm-white backdrop-blur-sm"
    >
      {{ beforeLabel }}
    </span>
    <span
      class="pointer-events-none absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-primary-warm-white backdrop-blur-sm"
    >
      {{ afterLabel }}
    </span>

    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-0 w-0.5 bg-white/70"
      :style="{ left: `${split}%` }"
    />
    <button
      type="button"
      role="slider"
      :aria-label="label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(split)"
      class="absolute top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-white/70 bg-black/60 backdrop-blur-sm outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      :style="{ left: `${split}%` }"
      data-testid="hub-video-compare-seam"
      @keydown.left.prevent="nudge(-STEP)"
      @keydown.right.prevent="nudge(STEP)"
      @keydown.home.prevent="split = 0"
      @keydown.end.prevent="split = 100"
    />
  </div>
</template>
