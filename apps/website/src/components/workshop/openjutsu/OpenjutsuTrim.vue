<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SwapWindow } from '@/lib/workshop/openjutsu/clip'
import {
  FPS,
  MIN_WINDOW_SECONDS,
  WINDOW_STEP_SECONDS,
  maxWindowSeconds
} from '@/lib/workshop/openjutsu/clip'

const {
  range,
  clipSeconds,
  frames,
  disabled = false,
  locale = 'en'
} = defineProps<{
  range: SwapWindow
  clipSeconds: number
  /** The frames the run will really use, which the readout is made from. */
  frames: number
  disabled?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ change: [range: SwapWindow] }>()

/** Past this the LoRA's author saw framing and timing drift. */
const STEADY_SECONDS = 6
const KEY_STEP = 0.25

const track = ref<HTMLElement>()
const usedSeconds = computed(() => frames / FPS)
const left = computed(() => `${(range.start / clipSeconds) * 100}%`)
const width = computed(() => `${(usedSeconds.value / clipSeconds) * 100}%`)
const stamp = (seconds: number) => seconds.toFixed(1)

function secondsPerPixel() {
  const pixels = track.value?.getBoundingClientRect().width ?? 0
  return pixels > 0 ? clipSeconds / pixels : 0
}

type Drag = { x: number; from: SwapWindow; edge: 'move' | 'end' }
let drag: Drag | undefined

function grab(event: PointerEvent, edge: Drag['edge']) {
  if (disabled || !(event.currentTarget instanceof HTMLElement)) return
  event.currentTarget.setPointerCapture(event.pointerId)
  drag = { x: event.clientX, from: { ...range }, edge }
}

function pull(event: PointerEvent) {
  if (!drag) return
  const moved = (event.clientX - drag.x) * secondsPerPixel()
  emit(
    'change',
    drag.edge === 'move'
      ? { start: drag.from.start + moved, seconds: drag.from.seconds }
      : { start: drag.from.start, seconds: drag.from.seconds + moved }
  )
}

function release() {
  drag = undefined
}

function nudge(event: KeyboardEvent, edge: Drag['edge']) {
  const direction =
    event.key === 'ArrowRight' || event.key === 'ArrowUp'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? -1
        : 0
  if (!direction || disabled) return
  event.preventDefault()
  emit(
    'change',
    edge === 'move'
      ? { start: range.start + direction * KEY_STEP, seconds: range.seconds }
      : {
          start: range.start,
          seconds: range.seconds + direction * WINDOW_STEP_SECONDS
        }
  )
}
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="openjutsu-trim">
    <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <p class="text-sm font-semibold text-primary-warm-white">
        {{ t('openjutsu.trim.label') }}
      </p>
      <p
        class="font-mono text-xs text-primary-comfy-canvas tabular-nums"
        data-testid="openjutsu-trim-readout"
      >
        {{
          t('openjutsu.trim.readout', {
            from: stamp(range.start),
            to: stamp(range.start + usedSeconds),
            seconds: stamp(usedSeconds)
          })
        }}
      </p>
    </div>
    <div
      ref="track"
      class="relative h-10 touch-none rounded-lg bg-transparency-white-t8 select-none"
    >
      <div
        role="slider"
        :tabindex="disabled ? -1 : 0"
        :aria-label="t('openjutsu.trim.start')"
        aria-valuemin="0"
        :aria-valuemax="Math.max(0, clipSeconds - usedSeconds).toFixed(2)"
        :aria-valuenow="range.start.toFixed(2)"
        :aria-valuetext="
          t('openjutsu.trim.seconds', { seconds: stamp(range.start) })
        "
        :aria-disabled="disabled"
        class="absolute inset-y-0 cursor-grab rounded-lg bg-primary-comfy-yellow/25 ring-2 ring-primary-comfy-yellow outline-none ring-inset focus-visible:bg-primary-comfy-yellow/40 active:cursor-grabbing aria-disabled:cursor-default aria-disabled:opacity-50"
        :style="{ left, width }"
        @pointerdown="grab($event, 'move')"
        @pointermove="pull"
        @pointerup="release"
        @pointercancel="release"
        @keydown="nudge($event, 'move')"
      >
        <div
          role="slider"
          :tabindex="disabled ? -1 : 0"
          :aria-label="t('openjutsu.trim.length')"
          :aria-valuemin="MIN_WINDOW_SECONDS.toFixed(2)"
          :aria-valuemax="maxWindowSeconds(clipSeconds).toFixed(2)"
          :aria-valuenow="usedSeconds.toFixed(2)"
          :aria-valuetext="
            t('openjutsu.trim.seconds', { seconds: stamp(usedSeconds) })
          "
          :aria-disabled="disabled"
          class="absolute inset-y-0 -right-1 flex w-5 cursor-ew-resize items-center justify-center outline-none"
          @pointerdown.stop="grab($event, 'end')"
          @pointermove="pull"
          @pointerup="release"
          @pointercancel="release"
          @keydown.stop="nudge($event, 'end')"
        >
          <span
            class="h-5 w-1.5 rounded-full bg-primary-comfy-yellow ring-primary-warm-white in-focus-visible:ring-2"
          />
        </div>
      </div>
    </div>
    <div class="flex justify-between gap-3 text-xs text-primary-warm-gray">
      <span>
        {{
          usedSeconds > STEADY_SECONDS
            ? t('openjutsu.trim.long')
            : t('openjutsu.trim.help')
        }}
      </span>
      <span class="shrink-0 font-mono tabular-nums">
        {{ t('openjutsu.trim.seconds', { seconds: stamp(clipSeconds) }) }}
      </span>
    </div>
  </div>
</template>
