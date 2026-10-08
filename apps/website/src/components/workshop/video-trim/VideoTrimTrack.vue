<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { TrimLimits, TrimRange } from '@/lib/workshop/video-trim/range'
import {
  trimEndTo,
  trimSlideTo,
  trimStartTo
} from '@/lib/workshop/video-trim/range'

/**
 * A filmstrip timeline with a selected range: two handles to resize it, the
 * range itself to slide it, and a playhead to scrub. It knows nothing of the
 * video beyond its length; the parent seeks and plays.
 */
const {
  duration,
  limits,
  tiles,
  disabled = false,
  labels
} = defineProps<{
  /** The whole video's length in seconds. */
  duration: number
  limits: TrimLimits
  /** Stills across the whole video, in order; gaps are still loading. */
  tiles: readonly (string | undefined)[]
  disabled?: boolean
  labels: {
    readonly start: string
    readonly end: string
    readonly seek: string
    /** How a time in seconds is read out. */
    readonly time: (seconds: number) => string
  }
}>()

const range = defineModel<TrimRange>('range', { required: true })
const playhead = defineModel<number>('playhead', { required: true })

const emit = defineEmits<{
  /** A handle or the playhead moved here; show this moment. */
  seek: [time: number]
}>()

const HANDLE_PX = 16
const KEY_STEP = 0.1
const KEY_STEP_LARGE = 1
const CONTENT = `(100% - ${HANDLE_PX * 2}px)`

const track = useTemplateRef<HTMLElement>('track')
const share = (time: number) => (duration > 0 ? time / duration : 0)
const inset = (time: number) =>
  `calc(${share(time)} * ${CONTENT} + ${HANDLE_PX}px)`

const selectionStyle = computed(() => ({
  left: `calc(${share(range.value.start)} * ${CONTENT})`,
  width: `calc(${share(range.value.end - range.value.start)} * ${CONTENT} + ${HANDLE_PX * 2}px)`
}))
const beforeStyle = computed(() => ({
  width: `calc(${share(range.value.start)} * ${CONTENT} + ${HANDLE_PX}px)`
}))
const afterStyle = computed(() => ({
  width: `calc(${1 - share(range.value.end)} * ${CONTENT} + ${HANDLE_PX}px)`
}))

function timeAt(clientX: number): number {
  const box = track.value?.getBoundingClientRect()
  const width = (box?.width ?? 0) - HANDLE_PX * 2
  if (!box || width <= 0) return 0
  const along = (clientX - box.left - HANDLE_PX) / width
  return Math.min(1, Math.max(0, along)) * duration
}

type Grip = 'start' | 'end' | 'slide' | 'scrub'
let drag: { grip: Grip; offset: number } | undefined

// The models update on the next tick, so what is emitted comes from the value
// just worked out, not from one read back.
function apply(grip: Grip, time: number) {
  if (grip === 'scrub') {
    const at = Math.min(range.value.end, Math.max(range.value.start, time))
    playhead.value = at
    emit('seek', at)
    return
  }
  const next =
    grip === 'start'
      ? trimStartTo(range.value, time, duration, limits)
      : grip === 'end'
        ? trimEndTo(range.value, time, duration, limits)
        : trimSlideTo(range.value, time, duration)
  range.value = next
  emit('seek', grip === 'end' ? next.end : next.start)
}

function grab(event: PointerEvent, grip: Grip) {
  if (disabled || !(event.currentTarget instanceof HTMLElement)) return
  event.currentTarget.setPointerCapture(event.pointerId)
  const at = timeAt(event.clientX)
  // a slide keeps the point that was grabbed under the pointer
  drag = { grip, offset: grip === 'slide' ? at - range.value.start : 0 }
  if (grip === 'scrub') apply(grip, at)
}

function pull(event: PointerEvent) {
  if (drag) apply(drag.grip, timeAt(event.clientX) - drag.offset)
}

function release() {
  drag = undefined
}

function nudge(event: KeyboardEvent, grip: Grip) {
  const direction =
    event.key === 'ArrowRight' || event.key === 'ArrowUp'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? -1
        : 0
  if (!direction || disabled) return
  event.preventDefault()
  const from =
    grip === 'start'
      ? range.value.start
      : grip === 'end'
        ? range.value.end
        : playhead.value
  apply(grip, from + direction * (event.shiftKey ? KEY_STEP_LARGE : KEY_STEP))
}

const handleClass =
  'pointer-events-auto flex shrink-0 cursor-ew-resize touch-none items-center justify-center bg-primary-comfy-yellow outline-none focus-visible:ring-2 focus-visible:ring-primary-warm-white disabled:cursor-default'
</script>

<template>
  <div
    ref="track"
    :class="
      cn(
        'relative h-16 w-full min-w-0 touch-none rounded-lg bg-transparency-white-t8 select-none',
        disabled && 'opacity-50'
      )
    "
    data-testid="video-trim-track"
  >
    <div
      class="pointer-events-none absolute inset-y-2 flex overflow-hidden"
      :style="{ left: `${HANDLE_PX}px`, right: `${HANDLE_PX}px` }"
      aria-hidden="true"
    >
      <div
        v-for="(tile, index) in tiles"
        :key="index"
        class="h-full min-w-0 flex-1 bg-transparency-white-t4 bg-cover bg-center"
        :style="tile ? { backgroundImage: `url(${tile})` } : undefined"
      />
    </div>

    <div
      class="pointer-events-none absolute inset-y-0 left-0 rounded-l-lg bg-primary-comfy-ink/70"
      :style="beforeStyle"
    />
    <div
      class="pointer-events-none absolute inset-y-0 right-0 rounded-r-lg bg-primary-comfy-ink/70"
      :style="afterStyle"
    />

    <div
      role="slider"
      :tabindex="disabled ? -1 : 0"
      :aria-label="labels.seek"
      :aria-valuemin="range.start.toFixed(2)"
      :aria-valuemax="range.end.toFixed(2)"
      :aria-valuenow="playhead.toFixed(2)"
      :aria-valuetext="labels.time(playhead)"
      :aria-disabled="disabled"
      class="absolute inset-y-0 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-warm-white"
      :style="{ left: `${HANDLE_PX}px`, right: `${HANDLE_PX}px` }"
      @pointerdown="grab($event, 'scrub')"
      @pointermove="pull"
      @pointerup="release"
      @pointercancel="release"
      @keydown="nudge($event, 'scrub')"
    />

    <div
      class="pointer-events-none absolute inset-y-0 flex"
      :style="selectionStyle"
    >
      <button
        type="button"
        :disabled
        :aria-label="labels.start"
        :title="labels.time(range.start)"
        :class="cn(handleClass, 'rounded-l-lg')"
        :style="{ width: `${HANDLE_PX}px` }"
        data-testid="video-trim-start"
        @pointerdown="grab($event, 'start')"
        @pointermove="pull"
        @pointerup="release"
        @pointercancel="release"
        @keydown="nudge($event, 'start')"
      >
        <span class="h-5 w-0.5 rounded-full bg-primary-comfy-ink" />
      </button>
      <div class="flex min-w-0 flex-1 flex-col justify-between">
        <div
          class="pointer-events-auto h-2 cursor-grab bg-primary-comfy-yellow active:cursor-grabbing"
          @pointerdown="grab($event, 'slide')"
          @pointermove="pull"
          @pointerup="release"
          @pointercancel="release"
        />
        <div
          class="pointer-events-auto h-2 cursor-grab bg-primary-comfy-yellow active:cursor-grabbing"
          @pointerdown="grab($event, 'slide')"
          @pointermove="pull"
          @pointerup="release"
          @pointercancel="release"
        />
      </div>
      <button
        type="button"
        :disabled
        :aria-label="labels.end"
        :title="labels.time(range.end)"
        :class="cn(handleClass, 'rounded-r-lg')"
        :style="{ width: `${HANDLE_PX}px` }"
        data-testid="video-trim-end"
        @pointerdown="grab($event, 'end')"
        @pointermove="pull"
        @pointerup="release"
        @pointercancel="release"
        @keydown="nudge($event, 'end')"
      >
        <span class="h-5 w-0.5 rounded-full bg-primary-comfy-ink" />
      </button>
    </div>

    <div
      class="pointer-events-none absolute inset-y-1 z-10 w-0.5 -translate-x-1/2 rounded-full bg-primary-warm-white shadow-sm"
      :style="{ left: inset(playhead) }"
      data-testid="video-trim-playhead"
    />
  </div>
</template>
