<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import SectionLabel from '../common/SectionLabel.vue'
import VideoStoryCard from './VideoStoryCard.vue'

interface WatchStoryCard {
  slug: string
  company: string
  category: string
  title: string
  description: string
  poster: string
  posterWidth: number
  posterHeight: number
  duration?: string
}

const { stories, locale = 'en' } = defineProps<{
  stories: WatchStoryCard[]
  locale?: Locale
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 pt-4 pb-8 lg:px-16">
    <SectionLabel>{{ t('customers.group.watch', locale) }}</SectionLabel>
    <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <VideoStoryCard
        v-for="story in stories"
        :key="story.slug"
        :story="story"
        :locale="locale"
      />
    </div>
  </section>
</template>
