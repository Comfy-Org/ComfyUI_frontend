<script setup lang="ts">
import { useElementVisibility } from '@vueuse/core'
import { ref, useTemplateRef, watch } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import Button from '../ui/button/Button.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const videoRef = useTemplateRef<HTMLVideoElement>('videoRef')
const visible = useElementVisibility(videoRef)

const playing = ref(false)
const muted = ref(true)

// Plays only while on screen; the buttons override until it scrolls away.
watch(visible, (onScreen) => {
  const video = videoRef.value
  if (!video) return
  if (onScreen) {
    video.play().catch(() => {})
  } else {
    video.pause()
  }
})

function togglePlay() {
  const video = videoRef.value
  if (!video) return
  if (video.paused) {
    video.play().catch(() => {})
  } else {
    video.pause()
  }
}

function toggleMute() {
  muted.value = !muted.value
}
</script>

<template>
  <section class="max-w-9xl mx-auto w-full px-6 py-14 md:py-20 lg:px-12">
    <div
      class="bg-transparency-white-t4 lg:rounded-5xl flex flex-col gap-6 rounded-4xl p-2 lg:flex-row lg:gap-8"
    >
      <div class="relative aspect-video w-full lg:flex-1">
        <div
          class="lg:rounded-4.5xl absolute inset-0 aspect-auto h-full overflow-hidden rounded-3xl border-0 border-white/10 bg-black"
        >
          <video
            ref="videoRef"
            :aria-label="t('modelRelease.videoLabel', locale)"
            class="size-full object-cover"
            src="https://media.comfy.org/website/minimax/hero.mp4"
            poster="https://media.comfy.org/website/minimax/hero-fallback.jpg"
            preload="metadata"
            crossorigin="anonymous"
            playsinline
            loop
            :muted
            @play="playing = true"
            @pause="playing = false"
          />
          <div class="absolute top-4 right-4 flex gap-2 lg:top-6 lg:right-6">
            <button
              type="button"
              class="bg-primary-comfy-yellow flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg lg:size-10"
              :aria-label="playing ? 'Pause' : 'Play'"
              @click="togglePlay"
            >
              <svg
                v-if="playing"
                class="size-3 text-primary-comfy-ink lg:size-4"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              <svg
                v-else
                class="size-3 text-primary-comfy-ink lg:size-4"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <button
              type="button"
              class="bg-primary-comfy-yellow flex size-8 cursor-pointer items-center justify-center rounded-lg lg:size-10"
              :aria-label="muted ? 'Unmute' : 'Mute'"
              @click="toggleMute"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
                class="size-4 text-primary-comfy-ink"
              >
                <path
                  d="M11 5L6 9H2v6h4l5 4V5z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <template v-if="muted">
                  <line x1="23" y1="9" x2="17" y2="15" stroke-width="2.5" />
                  <line x1="17" y1="9" x2="23" y2="15" stroke-width="2.5" />
                </template>
                <path
                  v-else
                  d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"
                  fill="none"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        class="flex w-full flex-col justify-center gap-2 p-4 lg:flex-1 lg:p-6"
      >
        <p
          class="text-primary-comfy-yellow text-sm font-bold tracking-[0.7px] uppercase"
        >
          {{ t('modelRelease.eyebrow', locale) }}
        </p>
        <h2
          class="text-3xl leading-[135%] font-medium text-primary-comfy-canvas uppercase"
        >
          {{ t('modelRelease.title', locale) }}
        </h2>
        <p
          class="max-w-160 text-[17px] leading-[160%] font-light text-primary-comfy-canvas"
        >
          {{ t('modelRelease.body', locale) }}
        </p>
        <div class="mt-4">
          <!-- Absolute URL: this branch predates the /minimax page on main. -->
          <Button as="a" href="https://www.comfy.org/minimax">
            {{ t('modelRelease.cta', locale) }}
          </Button>
        </div>
      </div>
    </div>
  </section>
</template>
