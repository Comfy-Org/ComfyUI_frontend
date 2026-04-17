<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <div
    class="relative aspect-video overflow-hidden rounded-4xl border border-white/10 bg-black"
  >
    <div class="size-full" />

    <!-- Bottom control bar -->
    <div
      class="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4 lg:px-6 lg:py-5"
    >
      <!-- Play button -->
      <button
        class="bg-primary-comfy-yellow flex size-8 shrink-0 items-center justify-center rounded-full lg:size-10"
        :aria-label="locale === 'zh-CN' ? '播放' : 'Play'"
      >
        <svg class="ml-0.5 size-3 lg:size-4" viewBox="0 0 24 24" fill="#211927">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>

      <!-- Progress bar -->
      <div class="flex flex-1 items-center">
        <div class="h-1 w-full rounded-full bg-white/20">
          <div class="bg-primary-comfy-yellow h-full w-1/6 rounded-full" />
        </div>
      </div>

      <!-- Timestamp -->
      <span class="shrink-0 text-xs text-white/80 lg:text-sm">00:13</span>

      <!-- Fullscreen button -->
      <button
        class="bg-primary-comfy-yellow flex size-8 shrink-0 items-center justify-center rounded-lg lg:size-10"
        :aria-label="locale === 'zh-CN' ? '全屏' : 'Fullscreen'"
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

      <!-- Mute button -->
      <button
        class="bg-primary-comfy-yellow flex size-8 shrink-0 items-center justify-center rounded-lg lg:size-10"
        :aria-label="locale === 'zh-CN' ? '静音' : 'Mute'"
      >
        <svg
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
      </button>
    </div>
  </div>
</template>
