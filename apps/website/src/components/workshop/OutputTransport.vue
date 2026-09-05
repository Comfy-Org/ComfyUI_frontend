<script setup lang="ts">
import { Pause, Play, Volume2, VolumeX } from '@lucide/vue'
import { useIntervalFn } from '@vueuse/core'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

// Router returns an animated still for every result, so a run that should
// carry sound has no track to play. The transport stands in for the one the
// finished product will have: the clip loops on its own and this says where it
// is, so the shape of the control can be judged before the media is real.
const { seconds = 10, locale = 'en' } = defineProps<{
  seconds?: number
  locale?: Locale
}>()

const playing = ref(true)
const elapsed = ref(0)
const muted = ref(true)

useIntervalFn(() => {
  if (playing.value) elapsed.value = (elapsed.value + 0.25) % seconds
}, 250)

const progress = computed(() => `${(elapsed.value / seconds) * 100}%`)

const clock = (value: number) =>
  `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`

const buttonClass =
  'focus-visible:ring-primary-comfy-yellow/50 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-primary-warm-white transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-2'
</script>

<template>
  <div
    class="flex items-center gap-3 bg-linear-to-t from-primary-comfy-ink/90 to-transparent px-3 pt-8 pb-3"
    data-testid="output-transport"
  >
    <button
      type="button"
      :aria-pressed="playing"
      :aria-label="
        t(playing ? 'workshop.output.pause' : 'workshop.output.play', locale)
      "
      :class="buttonClass"
      data-testid="output-play"
      @click="playing = !playing"
    >
      <Pause v-if="playing" class="size-4" aria-hidden="true" />
      <Play v-else class="size-4" aria-hidden="true" />
    </button>

    <div
      class="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-transparency-white-t20"
      role="progressbar"
      :aria-valuenow="Math.round(elapsed)"
      :aria-valuemin="0"
      :aria-valuemax="seconds"
    >
      <span
        class="bg-primary-comfy-yellow absolute inset-y-0 left-0 rounded-full"
        :style="{ width: progress }"
      />
    </div>

    <span
      class="shrink-0 text-2xs text-primary-warm-white tabular-nums"
      data-testid="output-time"
    >
      {{ clock(elapsed) }} / {{ clock(seconds) }}
    </span>

    <button
      type="button"
      :aria-pressed="!muted"
      :aria-label="
        t(
          muted ? 'workshop.output.soundOn' : 'workshop.output.soundOff',
          locale
        )
      "
      :class="cn(buttonClass, !muted && 'text-primary-comfy-yellow')"
      data-testid="output-sound"
      @click="muted = !muted"
    >
      <VolumeX v-if="muted" class="size-4" aria-hidden="true" />
      <Volume2 v-else class="size-4" aria-hidden="true" />
    </button>
  </div>
</template>
