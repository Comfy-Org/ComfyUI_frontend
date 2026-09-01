<script setup lang="ts">
import { localizeHref } from '../../config/routes'
import type { LearningTutorial } from '../../data/learningTutorials'
import type { Locale } from '../../i18n/translations'

import {
  categoryChapters,
  categoryLabelKeys,
  learningCrumbs,
  recommendedFor,
  tutorialDescription,
  tutorialPath
} from '../../data/learningTutorials'
import { t } from '../../i18n/translations'
import WatchAuthorCard from '../blocks/WatchAuthorCard.vue'
import WatchRelatedStrip from '../blocks/WatchRelatedStrip.vue'
import WatchPageLayout from '../blocks/WatchPageLayout.vue'
import WatchRecommendedCard from '../blocks/WatchRecommendedCard.vue'
import Button from '../ui/button/Button.vue'
import VideoPlayer from '../common/VideoPlayer.vue'
import LearningVideoEmbed from './LearningVideoEmbed.vue'
import Badge from '../ui/badge/Badge.vue'

const { tutorial, locale = 'en' } = defineProps<{
  tutorial: LearningTutorial
  locale?: Locale
}>()

const breadcrumbs = [
  ...learningCrumbs(locale, tutorial.category).map((crumb) => ({
    label: crumb.name,
    href: localizeHref(crumb.path, locale)
  })),
  { label: tutorial.title[locale] || tutorial.title.en }
]

const chapters = categoryChapters(tutorial).map((item) => ({
  id: item.id,
  label: item.title[locale] || item.title.en,
  href: localizeHref(tutorialPath(item), locale),
  poster: item.poster
}))

const recommended = recommendedFor(tutorial).map((item) => ({
  id: item.id,
  title: item.title[locale] || item.title.en,
  tag: t(categoryLabelKeys[item.category], locale),
  href: localizeHref(tutorialPath(item), locale),
  poster: item.poster
}))
</script>

<template>
  <WatchPageLayout
    :breadcrumbs
    :breadcrumbs-label="t('ui.breadcrumb', locale)"
    :eyebrow="t('learning.watch.nowWatching', locale)"
    :title="tutorial.title[locale] || tutorial.title.en"
    :description="tutorialDescription(tutorial, locale)"
    :read-more-label="t('ui.readMore', locale)"
    :read-less-label="t('ui.readLess', locale)"
  >
    <LearningVideoEmbed
      v-if="tutorial.youtubeId"
      :key="tutorial.id"
      :youtube-id="tutorial.youtubeId"
      :title="tutorial.title[locale] || tutorial.title.en"
      class="w-full"
    />
    <VideoPlayer
      v-else
      :key="tutorial.id"
      :locale
      :src="tutorial.videoSrc"
      :poster="tutorial.poster"
      :tracks="tutorial.caption"
      :aria-label="tutorial.title[locale] || tutorial.title.en"
      autoplay
      autoplay-unmuted
      class="w-full"
    />

    <template v-if="tutorial.author" #author>
      <WatchAuthorCard
        :name="tutorial.author.name[locale] || tutorial.author.name.en"
        :detail="tutorial.author.detail?.[locale] || tutorial.author.detail?.en"
        :avatar="tutorial.author.avatar"
      />
    </template>

    <template #actions>
      <ul class="flex flex-wrap items-center gap-2">
        <li v-for="tag in tutorial.tags" :key="tag">
          <Badge variant="subtle" class="px-4 py-2 text-sm font-light">
            {{ t(tag, locale) }}
          </Badge>
        </li>
      </ul>
      <Button
        v-if="tutorial.href"
        variant="outline"
        size="sm"
        :href="tutorial.href"
        :target="tutorial.newTab ? '_blank' : undefined"
        :rel="tutorial.newTab ? 'noopener noreferrer' : undefined"
      >
        {{ t(tutorial.ctaLabelKey ?? 'cta.tryWorkflow', locale) }}
      </Button>
    </template>

    <template v-if="chapters.length" #chapters>
      <WatchRelatedStrip
        :heading="t('learning.watch.watchMore', locale)"
        :items="chapters"
      />
    </template>

    <template v-if="recommended.length" #sidebar>
      <h2 class="font-medium text-primary-warm-gray">
        {{ t('learning.watch.recommended', locale) }}
      </h2>
      <div class="mt-4 flex flex-col gap-10">
        <WatchRecommendedCard
          v-for="item in recommended"
          :key="item.id"
          :item
        />
      </div>
    </template>
  </WatchPageLayout>
</template>
