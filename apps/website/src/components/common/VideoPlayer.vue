<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  refAutoReset,
  useElementHover,
  useEventListener,
  useFullscreen,
  useMediaControls,
  useMouseInElement,
  whenever
} from '@vueuse/core'
import { computed, shallowRef, useTemplateRef, watch } from 'vue'

import type { Locale } from '../../i18n/translations'
import PlayPauseButton from './PlayPauseButton.vue'

type VideoTrack = {
  src: string
  kind: 'subtitles' | 'captions' | 'descriptions'
  srclang: string
  label: string
}

const {
  locale = 'en',
  src,
  poster,
  tracks = [],
  autoplay = false,
  minimal = false
} = defineProps<{
  locale?: Locale
  src?: string
  poster?: string
  tracks?: VideoTrack[]
  autoplay?: boolean
  minimal?: boolean
}>()

const playerEl = useTemplateRef<HTMLDivElement>('playerEl')
const videoEl = useTemplateRef<HTMLVideoElement>('videoEl')
const scrubberEl = useTemplateRef<HTMLDivElement>('scrubberEl')

const {
  playing,
  currentTime,
  duration,
  muted,
  selectedTrack,
  enableTrack,
  disableTrack
} = useMediaControls(videoEl)

const { isSupported: fullscreenSupported, toggle: toggleFs } =
  useFullscreen(playerEl)

// Controls fade
const hovering = useElementHover(playerEl)
const recentActivity = refAutoReset(false, 800)

const controlsVisible = computed(
  () => !playing.value || hovering.value || recentActivity.value
)

function showControls() {
  recentActivity.value = true
}

whenever(playing, () => {
  showControls()
})

const nativeDuration = shallowRef(0)

function syncNativeDuration() {
  const elementDuration = videoEl.value?.duration

  nativeDuration.value =
    elementDuration && Number.isFinite(elementDuration) ? elementDuration : 0
}

watch(videoEl, syncNativeDuration)
useEventListener(videoEl, 'loadedmetadata', syncNativeDuration)
useEventListener(videoEl, 'durationchange', syncNativeDuration)

const effectiveDuration = computed(() => duration.value || nativeDuration.value)

// Scrubber (modeled after VueUse demo Scrubber.vue)
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
  if (!elementWidth.value || !effectiveDuration.value) return

  const nextTime =
    Math.max(0, Math.min(1, elementX.value / elementWidth.value)) *
    effectiveDuration.value

  pendingTime.value = nextTime

  if (scrubbing.value) {
    currentTime.value = nextTime
  }
})

const progress = computed(() =>
  effectiveDuration.value ? currentTime.value / effectiveDuration.value : 0
)

const displayTime = computed(() =>
  scrubbing.value ? pendingTime.value : currentTime.value
)

const timestamp = computed(() => {
  const t = Math.floor(displayTime.value)
  const m = String(Math.floor(t / 60)).padStart(2, '0')
  const s = String(t % 60).padStart(2, '0')
  return `${m}:${s}`
})

// Subtitles
const ccEnabled = computed(() => selectedTrack.value !== -1)

const hasSubtitles = computed(() =>
  tracks.some((t) => t.kind === 'subtitles' || t.kind === 'captions')
)

function toggleCC() {
  if (ccEnabled.value) {
    disableTrack()
  } else {
    enableTrack(0)
  }
}

// Fullscreen
function toggleFullscreen() {
  if (fullscreenSupported.value) {
    toggleFs()
    return
  }
  const v = videoEl.value as
    | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
    | null
  v?.webkitEnterFullscreen?.()
}
</script>

<template>
  <div
    ref="playerEl"
    class="relative aspect-video overflow-hidden rounded-4xl border border-white/10 bg-black"
    @pointermove="showControls"
    @pointerdown="showControls"
    @focusin="showControls"
  >
    <video
      v-if="src"
      ref="videoEl"
      class="size-full object-cover"
      :src
      :poster
      :preload="autoplay ? 'auto' : 'metadata'"
      crossorigin="anonymous"
      playsinline
      :autoplay
      muted
    >
      <track
        v-for="track in tracks"
        :key="track.src"
        :src="track.src"
        :kind="track.kind"
        :srclang="track.srclang"
        :label="track.label"
      />
    </video>

    <!-- Minimal centered play/pause button -->
    <div
      v-if="minimal && src"
      :class="
        cn(
          'absolute inset-0 flex items-center justify-center transition-opacity duration-300',
          playing && !hovering && 'pointer-events-none opacity-0'
        )
      "
    >
      <PlayPauseButton
        :playing
        :aria-label="
          playing
            ? locale === 'zh-CN'
              ? '暂停'
              : 'Pause'
            : locale === 'zh-CN'
              ? '播放'
              : 'Play'
        "
        @click="playing = !playing"
      />
    </div>

    <!-- Bottom control bar -->
    <div
      v-if="src && !minimal"
      :class="
        cn(
          'absolute inset-x-0 bottom-0 flex items-center gap-3 p-4 transition-opacity duration-300 lg:px-6 lg:py-5',
          !controlsVisible && 'pointer-events-none opacity-0'
        )
      "
    >
      <!-- Play / Pause button -->
      <PlayPauseButton
        :playing
        size="sm"
        :aria-label="
          playing
            ? locale === 'zh-CN'
              ? '暂停'
              : 'Pause'
            : locale === 'zh-CN'
              ? '播放'
              : 'Play'
        "
        @click="playing = !playing"
      />

      <!-- Progress scrubber -->
      <div
        ref="scrubberEl"
        class="relative h-1 flex-1 cursor-pointer rounded-full bg-white/20 select-none"
        role="slider"
        tabindex="0"
        :aria-label="locale === 'zh-CN' ? '播放进度' : 'Seek'"
        :aria-valuemin="0"
        :aria-valuemax="effectiveDuration || 0"
        :aria-valuenow="displayTime"
        @mousedown="scrubbing = true"
        @touchstart.passive="scrubbing = true"
      >
        <div
          class="bg-primary-comfy-yellow h-full rounded-full"
          :style="{ width: `${progress * 100}%` }"
        />
      </div>

      <!-- Timestamp -->
      <span class="shrink-0 text-xs text-white/80 lg:text-sm">{{
        timestamp
      }}</span>

      <!-- Fullscreen button -->
      <button
        class="bg-primary-comfy-yellow flex size-8 shrink-0 items-center justify-center rounded-lg lg:size-10"
        :aria-label="locale === 'zh-CN' ? '全屏' : 'Fullscreen'"
        @click="toggleFullscreen"
      >
        <svg
          class="size-3.5 lg:size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#211927"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      </button>

      <!-- CC button -->
      <button
        v-if="hasSubtitles"
        :class="
          cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold lg:size-10 lg:text-sm',
            ccEnabled
              ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
              : 'bg-white/20 text-white'
          )
        "
        :aria-label="
          ccEnabled
            ? locale === 'zh-CN'
              ? '关闭字幕'
              : 'Subtitles off'
            : locale === 'zh-CN'
              ? '开启字幕'
              : 'Subtitles on'
        "
        @click="toggleCC"
      >
        CC
      </button>

      <!-- Mute / Unmute button -->
      <button
        class="bg-primary-comfy-yellow flex size-8 shrink-0 items-center justify-center rounded-lg lg:size-10"
        :aria-label="
          muted
            ? locale === 'zh-CN'
              ? '取消静音'
              : 'Unmute'
            : locale === 'zh-CN'
              ? '静音'
              : 'Mute'
        "
        @click="muted = !muted"
      >
        <!-- Muted icon -->
        <svg
          v-if="muted"
          class="size-3.5 lg:size-4"
          viewBox="0 0 24 24"
          fill="#211927"
          stroke="#211927"
          stroke-width="1.5"
        >
          <path
            d="M11 5L6 9H2v6h4l5 4V5z"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <line x1="23" y1="9" x2="17" y2="15" stroke-width="2.5" />
          <line x1="17" y1="9" x2="23" y2="15" stroke-width="2.5" />
        </svg>
        <!-- Unmuted icon -->
        <svg
          v-else
          class="size-3.5 lg:size-4"
          viewBox="0 0 24 24"
          fill="#211927"
          stroke="#211927"
          stroke-width="1.5"
        >
          <path
            d="M11 5L6 9H2v6h4l5 4V5z"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M15.54 8.46a5 5 0 0 1 0 7.07"
            fill="none"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            d="M19.07 4.93a10 10 0 0 1 0 14.14"
            fill="none"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
