<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import type { Locale } from '../../i18n/translations'

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
  autoplay = false
} = defineProps<{
  locale?: Locale
  src?: string
  poster?: string
  tracks?: VideoTrack[]
  autoplay?: boolean
}>()

const videoEl = ref<HTMLVideoElement>()
const playing = ref(false)
const muted = ref(true)
const ccEnabled = ref(false)
const currentTime = ref(0)
const duration = ref(0)

const hasSubtitles = computed(() =>
  tracks.some((t) => t.kind === 'subtitles' || t.kind === 'captions')
)

const progress = computed(() =>
  duration.value ? currentTime.value / duration.value : 0
)

const timestamp = computed(() => {
  const t = Math.floor(currentTime.value)
  const m = String(Math.floor(t / 60)).padStart(2, '0')
  const s = String(t % 60).padStart(2, '0')
  return `${m}:${s}`
})

function togglePlay() {
  const v = videoEl.value
  if (!v) return
  if (v.paused) {
    v.play().catch(() => {})
  } else {
    v.pause()
  }
}

function toggleCC() {
  const v = videoEl.value
  if (!v) return
  ccEnabled.value = !ccEnabled.value
  for (const track of v.textTracks) {
    if (track.kind === 'subtitles' || track.kind === 'captions') {
      track.mode = ccEnabled.value ? 'showing' : 'hidden'
    }
  }
}

function toggleMute() {
  const v = videoEl.value
  if (!v) return
  v.muted = !v.muted
  muted.value = v.muted
}

function toggleFullscreen() {
  const v = videoEl.value
  if (!v) return
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  } else if (v.requestFullscreen) {
    v.requestFullscreen().catch(() => {})
  } else if ('webkitEnterFullscreen' in v) {
    ;(
      v as HTMLVideoElement & { webkitEnterFullscreen: () => void }
    ).webkitEnterFullscreen()
  }
}

function hideAllSubtitles() {
  const v = videoEl.value
  if (!v) return
  for (const track of v.textTracks) {
    if (track.kind === 'subtitles' || track.kind === 'captions') {
      track.mode = 'hidden'
    }
  }
}

function onTimeUpdate() {
  const v = videoEl.value
  if (!v) return
  currentTime.value = v.currentTime
  duration.value = v.duration || 0
}

function onLoadedMetadata() {
  onTimeUpdate()
  hideAllSubtitles()
}

function seek(value: number) {
  const v = videoEl.value
  if (!v) return
  v.currentTime = value
}
</script>

<template>
  <div
    class="relative aspect-video overflow-hidden rounded-4xl border border-white/10 bg-black"
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
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @play="playing = true"
      @pause="playing = false"
      @ended="playing = false"
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

    <!-- Bottom control bar -->
    <div
      v-if="src"
      class="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4 lg:px-6 lg:py-5"
    >
      <!-- Play / Pause button -->
      <button
        class="bg-primary-comfy-yellow flex size-8 shrink-0 items-center justify-center rounded-full lg:size-10"
        :aria-label="
          playing
            ? locale === 'zh-CN'
              ? '暂停'
              : 'Pause'
            : locale === 'zh-CN'
              ? '播放'
              : 'Play'
        "
        @click="togglePlay"
      >
        <!-- Pause icon -->
        <svg
          v-if="playing"
          class="size-3 lg:size-4"
          viewBox="0 0 24 24"
          fill="#211927"
        >
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
        <!-- Play icon -->
        <svg
          v-else
          class="ml-0.5 size-3 lg:size-4"
          viewBox="0 0 24 24"
          fill="#211927"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>

      <!-- Progress bar -->
      <input
        type="range"
        class="video-progress-range flex-1"
        :value="currentTime"
        :max="duration || 0"
        step="0.1"
        :aria-label="locale === 'zh-CN' ? '播放进度' : 'Seek'"
        :aria-valuemin="0"
        :aria-valuemax="duration || 0"
        :aria-valuenow="currentTime"
        :style="{
          background: `linear-gradient(to right, var(--color-primary-comfy-yellow) ${progress * 100}%, rgb(255 255 255 / 0.2) ${progress * 100}%)`
        }"
        @input="seek(Number(($event.target as HTMLInputElement).value))"
      />

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
        @click="toggleMute"
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

<!-- Native range pseudo-elements cannot be styled with Tailwind utilities -->
<style scoped>
.video-progress-range {
  appearance: none;
  height: 4px;
  border-radius: 9999px;
  cursor: pointer;
  outline: none;
}

.video-progress-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 9999px;
}

.video-progress-range::-webkit-slider-thumb {
  appearance: none;
  width: 0;
  height: 0;
}

.video-progress-range::-moz-range-thumb {
  width: 0;
  height: 0;
  border: none;
}

.video-progress-range::-moz-range-progress {
  height: 4px;
  border-radius: 9999px;
  background: var(--color-primary-comfy-yellow);
}
</style>
