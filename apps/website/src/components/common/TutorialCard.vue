<script setup lang="ts">
import { computed } from 'vue'

import type { VideoTrack } from './VideoPlayer.vue'
import type {
  Locale,
  LocalizedText,
  TranslationKey
} from '../../i18n/translations'

import { t } from '../../i18n/translations'
import Badge from '../ui/badge/Badge.vue'
import { ButtonMask } from '../ui/button-mask'

export interface Tutorial {
  id: string
  tags: readonly TranslationKey[]
  title: LocalizedText
  videoSrc: string
  href?: string
  poster?: string
  caption?: readonly VideoTrack[]
  posterTime?: number
  author?: { name: string; avatarSrc?: string }
}

const DEFAULT_POSTER_TIME_SECONDS = 1

const getTutorialPosterSrc = (tutorial: Tutorial): string =>
  tutorial.poster
    ? tutorial.poster
    : `${tutorial.videoSrc}#t=${tutorial.posterTime ?? DEFAULT_POSTER_TIME_SECONDS}`

const {
  tutorial,
  locale = 'en',
  titlePrefixKey,
  variant = 'default'
} = defineProps<{
  tutorial: Tutorial
  locale?: Locale
  titlePrefixKey?: TranslationKey
  variant?: 'default' | 'overlay'
}>()

const emit = defineEmits<{ play: [] }>()

const accessibleTitle = computed(() =>
  titlePrefixKey
    ? `${t(titlePrefixKey, locale)} ${tutorial.title[locale]}`
    : tutorial.title[locale]
)
</script>

<template>
  <article
    class="bg-transparency-white-t4 flex flex-col gap-4 overflow-hidden rounded-3xl border-0 p-2"
  >
    <button
      type="button"
      class="group relative block aspect-video cursor-pointer overflow-hidden rounded-3xl"
      :aria-label="accessibleTitle"
      @click="emit('play')"
    >
      <video
        :src="getTutorialPosterSrc(tutorial)"
        :poster="tutorial.poster"
        class="size-full object-cover"
        preload="metadata"
        playsinline
        muted
      ></video>
      <!-- Dim the thumbnail so the overlaid title stays legible. -->
      <span
        v-if="variant === 'overlay'"
        class="absolute inset-0 bg-black/30"
        aria-hidden="true"
      />
      <span
        v-if="variant === 'overlay'"
        class="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-black/60 to-transparent"
        aria-hidden="true"
      />
      <span
        v-if="variant === 'overlay'"
        class="pointer-events-none absolute inset-x-0 top-0 p-6 text-left text-2xl font-light text-primary-comfy-canvas lg:p-8 lg:text-3xl"
      >
        {{ tutorial.title[locale] }}
      </span>
      <span
        class="absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <span
          class="flex size-14 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm transition-transform group-hover:scale-105 lg:size-16"
        >
          <svg
            class="ml-1 size-5 text-white lg:size-6"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>

    <div class="flex flex-col space-y-3 p-4">
      <div
        v-if="variant === 'overlay'"
        class="flex items-center justify-between gap-4"
      >
        <span
          v-if="tutorial.author"
          class="flex min-w-0 items-center gap-3 text-sm text-primary-comfy-canvas lg:text-base"
        >
          <img
            v-if="tutorial.author.avatarSrc"
            :src="tutorial.author.avatarSrc"
            alt=""
            class="size-10 shrink-0 rounded-full object-cover"
          />
          <span class="truncate">{{ tutorial.author.name }}</span>
        </span>
        <ButtonMask
          v-if="tutorial.href"
          as="a"
          :href="tutorial.href"
          icon-position="left"
          :hide-label="false"
          class="ml-auto shrink-0 ps-12"
          variant="ghost"
          size="default"
        >
          {{ t('cta.tryWorkflow', locale) }}
        </ButtonMask>
      </div>

      <div v-else class="flex items-center justify-between gap-4">
        <h3 class="text-sm/snug text-primary-comfy-canvas lg:text-base/snug">
          <template v-if="titlePrefixKey"
            >{{ t(titlePrefixKey, locale) }}<br
          /></template>
          {{ tutorial.title[locale] }}
        </h3>
        <ButtonMask
          v-if="tutorial.href"
          as="a"
          :href="tutorial.href"
          icon-position="right"
          class="shrink-0"
          variant="ghost"
          size="default"
        >
          {{ t('cta.tryWorkflow', locale) }}
          <template #icon>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-4"
            >
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </template>
        </ButtonMask>
      </div>

      <ul class="flex flex-wrap gap-2">
        <li v-for="tag in tutorial.tags" :key="tag">
          <Badge>{{ t(tag, locale) }}</Badge>
        </li>
      </ul>
    </div>
  </article>
</template>
