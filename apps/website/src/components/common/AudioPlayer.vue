<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  useEventListener,
  useMediaControls,
  useMouseInElement
} from '@vueuse/core'
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import type { HTMLAttributes } from 'vue'

import { t } from '../../i18n/translations'
import type { Locale } from '../../i18n/translations'
import PlayPauseButton from './PlayPauseButton.vue'

type AudioSource = {
  src: string
  type: string
}

const {
  locale,
  sources,
  poster,
  ariaLabel,
  class: className
} = defineProps<{
  locale: Locale
  sources: readonly AudioSource[]
  poster: string
  ariaLabel?: string
  class?: HTMLAttributes['class']
}>()

const audioEl = useTemplateRef<HTMLAudioElement>('audioEl')
const scrubberEl = useTemplateRef<HTMLDivElement>('scrubberEl')

const { playing, currentTime, duration } = useMediaControls(audioEl)

// One track at a time: starting this player pauses any other on the page.
useEventListener(audioEl, 'play', () => {
  for (const el of document.querySelectorAll('audio')) {
    if (el !== audioEl.value) el.pause()
  }
})

// Scrubber (modeled after VideoPlayer.vue)
const scrubbing = shallowRef(false)
const pendingTime = shallowRef(0)
const { elementX, elementWidth } = useMouseInElement(scrubberEl)

function stopScrubbing() {
  scrubbing.value = false
}

useEventListener('mouseup', stopScrubbing, { passive: true })
useEventListener('touchend', stopScrubbing, { passive: true })
useEventListener('touchcancel', stopScrubbing, { passive: true })

watch([scrubbing, elementX], () => {
  if (!elementWidth.value || !duration.value) return

  const nextTime =
    Math.max(0, Math.min(1, elementX.value / elementWidth.value)) *
    duration.value

  pendingTime.value = nextTime

  if (scrubbing.value) {
    currentTime.value = nextTime
  }
})

const progress = computed(() =>
  duration.value ? currentTime.value / duration.value : 0
)

const displayTime = computed(() =>
  scrubbing.value ? pendingTime.value : currentTime.value
)

const timestamp = computed(() => {
  const secs = Math.floor(displayTime.value)
  const m = String(Math.floor(secs / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return `${m}:${s}`
})

function handleScrubberKeydown(e: KeyboardEvent) {
  if (!duration.value) return

  switch (e.key) {
    case 'ArrowRight':
      currentTime.value = Math.min(currentTime.value + 5, duration.value)
      break
    case 'ArrowLeft':
      currentTime.value = Math.max(currentTime.value - 5, 0)
      break
    case 'Home':
      currentTime.value = 0
      break
    case 'End':
      currentTime.value = duration.value
      break
    default:
      return
  }
  e.preventDefault()
}
</script>

<template>
  <div
    :class="
      cn(
        'relative aspect-video overflow-hidden rounded-4xl border border-white/10 bg-black',
        className
      )
    "
  >
    <img :src="poster" :alt="ariaLabel" class="size-full object-cover" />

    <audio ref="audioEl" :aria-label="ariaLabel" preload="metadata">
      <source
        v-for="source in sources"
        :key="source.src"
        :src="source.src"
        :type="source.type"
      />
    </audio>

    <div
      class="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4 lg:px-6 lg:py-5"
    >
      <PlayPauseButton
        :playing
        size="sm"
        :aria-label="
          playing ? t('player.pause', locale) : t('player.play', locale)
        "
        @click="playing = !playing"
      />

      <div
        ref="scrubberEl"
        class="relative h-1 flex-1 cursor-pointer rounded-full bg-white/20 select-none"
        role="slider"
        tabindex="0"
        :aria-label="t('player.seek', locale)"
        :aria-valuemin="0"
        :aria-valuemax="duration || 0"
        :aria-valuenow="displayTime"
        @keydown="handleScrubberKeydown"
        @mousedown="scrubbing = true"
        @touchstart.passive="scrubbing = true"
      >
        <div
          class="bg-primary-comfy-yellow h-full rounded-full"
          :style="{ width: `${progress * 100}%` }"
        />
      </div>

      <span class="shrink-0 text-xs text-white/80 lg:text-sm">{{
        timestamp
      }}</span>
    </div>
  </div>
</template>
