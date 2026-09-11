<script setup lang="ts">
import { Pause, Play, Volume2, VolumeX } from '@lucide/vue'
import { useMediaControls } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { src, locale = 'en' } = defineProps<{ src: string; locale?: Locale }>()
const audio = useTemplateRef<HTMLAudioElement>('audio')
const { playing, currentTime, duration, muted } = useMediaControls(audio)
const seconds = computed(() =>
  Number.isFinite(duration.value) ? duration.value : 0
)
const clock = computed(() => {
  const elapsed = Math.max(0, Math.floor(currentTime.value || 0))
  return `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
})
const buttonClass =
  'grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-primary-warm-white/80 transition-colors outline-none hover:bg-transparency-white-t20 hover:text-primary-warm-white focus-visible:bg-transparency-white-t20 focus-visible:ring-2 focus-visible:ring-primary-warm-white/60 active:bg-transparency-white-t8 sm:size-9'
</script>

<template>
  <div
    class="flex items-center gap-2 bg-linear-to-t from-primary-comfy-ink/90 to-transparent px-3 pt-10 pb-3 sm:gap-3 sm:px-4 sm:pb-4"
    data-testid="output-transport"
  >
    <audio
      ref="audio"
      :src
      preload="metadata"
      :aria-label="t('workshop.output.title', locale)"
      data-testid="output-audio"
    />
    <button
      type="button"
      :aria-label="
        t(playing ? 'workshop.output.pause' : 'workshop.output.play', locale)
      "
      :class="buttonClass"
      data-testid="output-play"
      @click="playing = !playing"
    >
      <Pause v-if="playing" class="size-5 sm:size-4" aria-hidden="true" />
      <Play v-else class="size-5 sm:size-4" aria-hidden="true" />
    </button>
    <input
      v-model.number="currentTime"
      type="range"
      min="0"
      :max="seconds"
      step="0.01"
      :disabled="!seconds"
      :aria-label="t('player.seek', locale)"
      class="accent-primary-comfy-yellow min-w-0 flex-1"
    />
    <span
      class="shrink-0 text-sm text-primary-warm-white tabular-nums sm:text-xs"
      data-testid="output-time"
      >{{ clock }}</span
    >
    <button
      type="button"
      :aria-label="
        t(
          muted ? 'workshop.output.soundOn' : 'workshop.output.soundOff',
          locale
        )
      "
      :class="cn(buttonClass, !muted && 'text-primary-warm-white')"
      data-testid="output-sound"
      @click="muted = !muted"
    >
      <VolumeX v-if="muted" class="size-5 sm:size-4" aria-hidden="true" />
      <Volume2 v-else class="size-5 sm:size-4" aria-hidden="true" />
    </button>
  </div>
</template>
