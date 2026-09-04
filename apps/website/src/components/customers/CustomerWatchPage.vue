<script setup lang="ts">
import { getRoutes } from '../../config/routes'
import type { CustomerVideoStory } from '../../data/customerVideos'
import { customerVideoPath, formatDuration } from '../../data/customerVideos'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { WatchRelatedItem } from '../blocks/WatchRelatedCard.vue'
import WatchPageLayout from '../blocks/WatchPageLayout.vue'
import WatchRelatedStrip from '../blocks/WatchRelatedStrip.vue'
import VideoPlayer from '../common/VideoPlayer.vue'

const {
  story,
  otherStories,
  relatedStoryHref,
  transcript = [],
  locale = 'en'
} = defineProps<{
  story: CustomerVideoStory
  otherStories: readonly CustomerVideoStory[]
  /** Href of the reciprocal written story, when one exists for this video. */
  relatedStoryHref?: string
  transcript?: readonly string[]
  locale?: Locale
}>()

const routes = getRoutes(locale)

const breadcrumbs = [
  { label: t('breadcrumb.home', locale), href: '/' },
  { label: t('nav.customerStories', locale), href: routes.customers },
  { label: story.title }
]

const related: WatchRelatedItem[] = otherStories.map((item) => ({
  id: item.slug,
  label: item.company,
  title: item.title,
  href: customerVideoPath(item.slug),
  poster: item.poster
}))

const duration = formatDuration(story.durationSeconds)
</script>

<template>
  <WatchPageLayout
    :breadcrumbs
    :breadcrumbs-label="t('ui.breadcrumb', locale)"
    :eyebrow="story.company"
    :eyebrow-detail="story.category"
    :title="story.title"
    :description="story.description"
  >
    <VideoPlayer
      :locale
      :src="story.videoSrc"
      :poster="story.poster"
      :tracks="story.captions"
      :aria-label="story.title"
      class="w-full"
    />

    <div v-if="transcript.length" class="mt-10 max-w-3xl">
      <h2
        class="text-sm font-extrabold tracking-wider text-primary-warm-white uppercase"
      >
        {{ t('customers.watch.transcript', locale) }}
      </h2>
      <div class="mt-4 flex flex-col gap-4">
        <p
          v-for="(paragraph, index) in transcript"
          :key="index"
          class="text-base/relaxed font-light text-primary-warm-gray"
        >
          {{ paragraph }}
        </p>
      </div>
    </div>

    <template v-if="duration" #actions>
      <span class="text-sm font-light text-primary-warm-gray">
        {{ duration }}
      </span>
    </template>

    <template #chapters>
      <div class="flex flex-col gap-6">
        <a
          v-if="relatedStoryHref"
          :href="relatedStoryHref"
          class="text-primary-comfy-yellow text-sm font-semibold tracking-wide uppercase hover:underline"
        >
          {{ t('customers.watch.readWrittenStory', locale) }}
        </a>
        <WatchRelatedStrip
          v-if="related.length"
          :heading="t('customers.watch.moreStories', locale)"
          :items="related"
        />
        <a
          :href="routes.customers"
          class="text-primary-comfy-yellow text-sm font-semibold tracking-wide uppercase hover:underline"
        >
          {{ t('customers.watch.browseAll', locale) }}
        </a>
      </div>
    </template>
  </WatchPageLayout>
</template>
