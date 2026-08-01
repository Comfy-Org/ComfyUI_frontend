<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import VideoPlayer from '../../components/common/VideoPlayer.vue'
import { minimaxH3Workflows } from '../../data/minimaxH3'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-12 lg:px-20 lg:py-16">
    <div class="flex flex-col items-center text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t('minimaxH3.workflows.heading', locale) }}
      </h2>
      <p
        class="mt-6 max-w-xl text-sm font-light text-primary-comfy-canvas/70 lg:text-base"
      >
        {{ t('minimaxH3.workflows.subtitle', locale) }}
      </p>
    </div>

    <ul class="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <li
        v-for="workflow in minimaxH3Workflows"
        :key="workflow.id"
        class="flex flex-col gap-5"
      >
        <VideoPlayer
          :locale
          :src="workflow.videoSrc"
          :aria-label="workflow.title[locale]"
          minimal
          autoplay
          loop
        />
        <div class="flex flex-col gap-2">
          <h3 class="text-xl font-semibold text-primary-comfy-canvas">
            {{ workflow.title[locale] }}
          </h3>
          <p class="text-sm/relaxed font-light text-primary-comfy-canvas/70">
            {{ workflow.description[locale] }}
          </p>
          <a
            :href="workflow.href"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 mt-1 w-fit rounded-sm text-sm font-semibold underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
          >
            {{ t('minimaxH3.workflows.cta', locale) }}
          </a>
        </div>
      </li>
    </ul>
  </section>
</template>
