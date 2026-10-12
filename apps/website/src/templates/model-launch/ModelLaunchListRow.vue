<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { useEventListener, useMediaControls } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import type { Locale } from '@/i18n/translations'
import type { ModelLaunchListItem } from './types'

import { translationsFor } from '@/i18n/translations'

const { locale = 'en', item } = defineProps<{
  item: ModelLaunchListItem
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const audioEl = useTemplateRef<HTMLAudioElement>('audioEl')
const { playing, duration } = useMediaControls(audioEl)

useEventListener(audioEl, 'play', () => {
  for (const el of document.querySelectorAll('audio')) {
    if (el !== audioEl.value) el.pause()
  }
})

const title = computed(() => item.title[locale] || item.title.en)

const durationLabel = computed(() => {
  if (!duration.value) return ''
  const secs = Math.floor(duration.value)
  const m = String(Math.floor(secs / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return `${m}:${s}`
})

const trailingLabels = computed(() => [
  ...item.meta.map((label) => label[locale] || label.en),
  ...(durationLabel.value ? [durationLabel.value] : [])
])
</script>

<template>
  <li class="flex items-start gap-5 py-8 lg:gap-8">
    <audio
      v-if="item.audioSources"
      ref="audioEl"
      :aria-label="title"
      preload="metadata"
    >
      <source
        v-for="source in item.audioSources"
        :key="source.src"
        :src="source.src"
        :type="source.type"
      />
    </audio>

    <button
      v-if="item.audioSources"
      type="button"
      :aria-label="playing ? t('player.pause') : t('player.play')"
      class="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-warm-white text-primary-comfy-ink transition-colors hover:bg-primary-comfy-yellow"
      @click="playing = !playing"
    >
      <svg
        v-if="playing"
        class="size-4"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
      </svg>
      <svg
        v-else
        class="ml-0.5 size-4"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>
    <a
      v-else
      :href="item.href"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="title"
      class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-warm-white text-primary-comfy-ink transition-colors hover:bg-primary-comfy-yellow"
    >
      <ArrowRight class="size-5" :stroke-width="2.5" />
    </a>

    <div class="min-w-0 flex-1">
      <h3 class="text-lg font-semibold text-primary-warm-white lg:text-xl">
        <a
          :href="item.href"
          target="_blank"
          rel="noopener noreferrer"
          class="transition-opacity hover:opacity-80"
        >
          {{ title }}
        </a>
      </h3>
      <p
        class="mt-2 max-w-3xl text-base/relaxed font-light text-primary-warm-gray"
      >
        {{ item.description[locale] || item.description.en }}
      </p>
      <p
        class="mt-3 flex flex-wrap gap-x-6 text-sm text-primary-warm-gray tabular-nums md:hidden"
      >
        <span v-for="label in trailingLabels" :key="label">{{ label }}</span>
      </p>
    </div>

    <div
      class="hidden shrink-0 items-start gap-12 pt-1.5 text-base text-primary-warm-gray tabular-nums md:flex lg:gap-20"
    >
      <span
        v-for="label in trailingLabels"
        :key="label"
        class="min-w-16 text-right"
      >
        {{ label }}
      </span>
    </div>
  </li>
</template>
