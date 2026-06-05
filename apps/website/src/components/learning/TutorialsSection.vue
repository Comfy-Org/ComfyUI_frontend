<script setup lang="ts">
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'

import {
  getTutorialPosterSrc,
  learningTutorials
} from '../../data/learningTutorials'
import { t } from '../../i18n/translations'
import Badge from '../common/Badge.vue'
import MaskRevealButton from '../common/MaskRevealButton.vue'
import TutorialDetailDialog from './TutorialDetailDialog.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const activeTutorialId = ref<string | null>(null)
const activeTutorial = () =>
  learningTutorials.find((tutorial) => tutorial.id === activeTutorialId.value)
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <h2
      class="mb-12 text-4xl font-light tracking-tight text-primary-comfy-canvas lg:mb-16 lg:text-6xl"
    >
      {{ t('learning.tutorials.heading', locale) }}
    </h2>

    <ul
      class="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-8"
    >
      <li
        v-for="tutorial in learningTutorials"
        :key="tutorial.id"
        class="bg-transparency-white-t4 flex flex-col gap-4 overflow-hidden rounded-3xl border-0 p-2"
      >
        <button
          type="button"
          class="group relative block aspect-video cursor-pointer overflow-hidden rounded-3xl"
          :aria-label="`${t('learning.tutorials.titlePrefix', locale)} ${tutorial.title[locale]}`"
          @click="activeTutorialId = tutorial.id"
        >
          <video
            :src="getTutorialPosterSrc(tutorial)"
            :poster="tutorial.poster"
            class="size-full object-cover"
            preload="metadata"
            playsinline
            muted
          ></video>
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
          <div class="flex items-center justify-between gap-4">
            <h3
              class="text-sm/snug text-primary-comfy-canvas lg:text-base/snug"
            >
              {{ t('learning.tutorials.titlePrefix', locale) }}<br />
              {{ tutorial.title[locale] }}
            </h3>
            <MaskRevealButton
              v-if="tutorial.href"
              :href="tutorial.href"
              icon-position="right"
              class="shrink-0"
              variant="ghost"
              size="sm"
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
            </MaskRevealButton>
          </div>

          <ul class="flex flex-wrap gap-2">
            <li v-for="tag in tutorial.tags" :key="tag">
              <Badge>{{ t(tag, locale) }}</Badge>
            </li>
          </ul>
        </div>
      </li>
    </ul>

    <TutorialDetailDialog
      v-if="activeTutorial()"
      :tutorial="activeTutorial()!"
      :locale="locale"
      @close="activeTutorialId = null"
    />
  </section>
</template>
