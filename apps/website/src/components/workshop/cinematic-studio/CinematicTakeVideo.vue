<script setup lang="ts">
import { Pause, Play, Volume2, VolumeX } from '@lucide/vue'
import { useMediaControls } from '@vueuse/core'
import { computed, onMounted, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

// A clip's controls sit on the picture, not behind a hover: a big play button
// while it is paused and a bar along the bottom, so a take reads as a video at
// a glance. The bar stays up while paused and shows on hover while playing.
const {
  src,
  height,
  pending = false,
  locale
} = defineProps<{
  src: string
  height: string
  /** Hidden until it has loaded, so the frame keeps its size meanwhile. */
  pending?: boolean
  locale: Locale
}>()
const emit = defineEmits<{ loaded: [] }>()

const video = useTemplateRef<HTMLVideoElement>('video')
const { playing, currentTime, muted } = useMediaControls(video)
// Read from the element too: a cached clip can report its length before the
// media listeners are attached, and the bar would then read 0:00 for good.
const seconds = ref(0)
function readLength() {
  const length = video.value?.duration
  seconds.value = length !== undefined && Number.isFinite(length) ? length : 0
}
onMounted(readLength)
const clock = (value: number) => {
  const whole = Math.max(0, Math.floor(value || 0))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
const time = computed(
  () => `${clock(currentTime.value)} / ${clock(seconds.value)}`
)

const buttonClass =
  'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-primary-warm-white/80 transition-colors outline-none hover:bg-transparency-white-t20 hover:text-primary-warm-white focus-visible:bg-transparency-white-t20 focus-visible:ring-2 focus-visible:ring-primary-warm-white/60'
</script>

<template>
  <div
    :class="
      cn(
        'group/clip relative max-w-full transition-opacity duration-300',
        pending && 'absolute opacity-0'
      )
    "
    data-testid="cinematic-take-video"
  >
    <video
      ref="video"
      :src
      :aria-label="tc('cinematic.video.preview', locale)"
      playsinline
      preload="metadata"
      class="block h-auto w-auto max-w-full cursor-pointer"
      :style="{ maxHeight: height }"
      @click="playing = !playing"
      @loadedmetadata="readLength"
      @durationchange="readLength"
      @loadeddata="emit('loaded')"
      @error="emit('loaded')"
    />
    <button
      v-if="!playing"
      type="button"
      :aria-label="t('workshop.output.play', locale)"
      class="absolute top-1/2 left-1/2 grid size-16 -translate-1/2 cursor-pointer place-items-center rounded-full bg-primary-comfy-ink/60 text-primary-warm-white ring-1 ring-transparency-white-t20 backdrop-blur-sm transition-colors ring-inset hover:bg-primary-comfy-ink/80 focus-visible:ring-2 focus-visible:ring-primary-warm-white/60 focus-visible:outline-none"
      data-testid="cinematic-video-play"
      @click="playing = true"
    >
      <Play class="size-7 translate-x-0.5 fill-current" aria-hidden="true" />
    </button>
    <div
      :class="
        cn(
          'absolute inset-x-0 bottom-0 flex items-center gap-2 bg-linear-to-t from-primary-comfy-ink/90 to-transparent px-3 pt-10 pb-2 transition-opacity',
          playing &&
            'opacity-0 group-focus-within/clip:opacity-100 group-hover/clip:opacity-100 pointer-coarse:opacity-100'
        )
      "
      data-testid="cinematic-video-controls"
    >
      <button
        type="button"
        :aria-label="
          t(playing ? 'workshop.output.pause' : 'workshop.output.play', locale)
        "
        :class="buttonClass"
        @click="playing = !playing"
      >
        <Pause v-if="playing" class="size-4" aria-hidden="true" />
        <Play v-else class="size-4" aria-hidden="true" />
      </button>
      <input
        v-model.number="currentTime"
        type="range"
        min="0"
        :max="seconds"
        step="0.01"
        :disabled="!seconds"
        :aria-label="t('player.seek', locale)"
        class="min-w-0 flex-1 cursor-pointer accent-primary-comfy-yellow"
      />
      <span
        class="shrink-0 text-xs text-primary-warm-white tabular-nums"
        data-testid="cinematic-video-time"
      >
        {{ time }}
      </span>
      <button
        type="button"
        :aria-label="
          t(
            muted ? 'workshop.output.soundOn' : 'workshop.output.soundOff',
            locale
          )
        "
        :class="buttonClass"
        @click="muted = !muted"
      >
        <VolumeX v-if="muted" class="size-4" aria-hidden="true" />
        <Volume2 v-else class="size-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
