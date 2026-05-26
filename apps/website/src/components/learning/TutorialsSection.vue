<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { learningTutorials } from '../../data/learningTutorials'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 pb-16 lg:pb-24">
    <ul
      class="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-8"
    >
      <li
        v-for="tutorial in learningTutorials"
        :key="tutorial.id"
        class="flex flex-col gap-4"
      >
        <a
          :href="tutorial.href"
          class="group relative block aspect-video overflow-hidden rounded-3xl bg-black"
          :aria-label="`${t('learning.tutorials.titlePrefix', locale)} ${tutorial.title[locale]}`"
        >
          <video
            :src="tutorial.videoSrc"
            :poster="tutorial.poster"
            class="size-full object-cover"
            preload="metadata"
            playsinline
            muted
          />
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
        </a>

        <div class="flex items-center justify-between gap-4 px-1">
          <h3 class="text-primary-comfy-canvas text-sm/snug lg:text-base/snug">
            {{ t('learning.tutorials.titlePrefix', locale) }}
            {{ tutorial.title[locale] }}
          </h3>
          <a
            :href="tutorial.href"
            class="text-primary-comfy-yellow group flex shrink-0 items-center gap-2 text-xs font-medium tracking-wide uppercase lg:text-sm"
          >
            <span
              class="bg-primary-comfy-yellow flex size-6 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5 lg:size-7"
            >
              <svg
                class="text-primary-comfy-ink size-3 lg:size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </span>
            {{ t('cta.tryWorkflow', locale) }}
          </a>
        </div>

        <ul class="flex flex-wrap gap-2 px-1">
          <li
            v-for="tag in tutorial.tags"
            :key="tag"
            class="text-primary-warm-gray border-primary-warm-gray/40 rounded-full border px-3 py-1 text-xs"
          >
            {{ t(tag, locale) }}
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
