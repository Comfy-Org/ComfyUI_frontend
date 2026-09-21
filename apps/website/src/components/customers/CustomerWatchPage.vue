<script setup lang="ts">
import { getRoutes } from '../../config/routes'
import type { CustomerVideoStory } from '../../data/customerVideos'
import { formatDuration } from '../../data/customerVideos'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import SectionLabel from '../common/SectionLabel.vue'
import VideoPlayer from '../common/VideoPlayer.vue'
import Button from '../ui/button/Button.vue'

const {
  story,
  relatedStoryHref,
  transcript = [],
  locale = 'en'
} = defineProps<{
  story: CustomerVideoStory
  /** Href of the reciprocal written story, when one exists for this video. */
  relatedStoryHref?: string
  transcript?: readonly string[]
  locale?: Locale
}>()

const routes = getRoutes(locale)
const duration = formatDuration(story.durationSeconds)
</script>

<template>
  <!-- Hero: mirrors DetailHeroSection.vue (the written customer-story hero),
       with the video standing in for the hero image. -->
  <section class="pt-16 lg:px-20 lg:pt-40 lg:pb-8">
    <div class="mx-auto flex max-w-4xl flex-col items-center text-center">
      <SectionLabel>{{ story.category }}</SectionLabel>

      <h1
        class="mt-4 text-3xl/tight font-light text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ story.title }}
      </h1>

      <p
        class="mt-6 max-w-xl text-sm/relaxed text-primary-warm-gray lg:text-base/relaxed"
      >
        {{ story.description }}
      </p>
    </div>

    <div class="mt-12 overflow-hidden px-6 lg:mt-16 lg:px-20">
      <VideoPlayer
        :locale
        :src="story.videoSrc"
        :poster="story.poster"
        :tracks="story.captions"
        :aria-label="story.title"
        class="w-full rounded-3xl"
      />
      <p
        v-if="duration"
        class="mt-3 text-center text-xs text-primary-comfy-canvas"
      >
        {{ duration }}
      </p>
    </div>
  </section>

  <!-- Body: mirrors CustomerArticle.astro's content column and typography
       (Section.astro / Paragraph.astro), with the caption transcript
       standing in for article body copy. -->
  <section class="max-w-9xl mx-auto px-4 pt-8 pb-24 lg:px-20 lg:pt-24 lg:pb-40">
    <div class="mx-auto max-w-3xl">
      <div
        v-if="transcript.length"
        id="transcript"
        class="mb-16 scroll-mt-24 lg:scroll-mt-36"
      >
        <h2 class="mb-6 text-2xl font-light text-primary-comfy-canvas">
          {{ t('customers.watch.transcript', locale) }}
        </h2>
        <p
          v-for="(paragraph, index) in transcript"
          :key="index"
          class="mt-4 text-sm/relaxed text-primary-comfy-canvas"
        >
          {{ paragraph }}
        </p>
      </div>

      <div class="flex flex-col items-center gap-4">
        <Button
          v-if="relatedStoryHref"
          as="a"
          :href="relatedStoryHref"
          variant="default"
          size="lg"
        >
          {{ t('customers.watch.readWrittenStory', locale) }}
        </Button>
        <Button as="a" :href="routes.customers" variant="outline" size="lg">
          {{ t('customers.watch.browseAll', locale) }}
        </Button>
      </div>
    </div>
  </section>
</template>
