<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'
import type { WatchStoryCard } from '../../utils/customers'
import SectionLabel from '../common/SectionLabel.vue'
import VideoStoryCard from './VideoStoryCard.vue'

const { stories, locale = 'en' } = defineProps<{
  stories: WatchStoryCard[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 pt-4 pb-8 lg:px-16">
    <SectionLabel>{{ t('customers.group.watch') }}</SectionLabel>
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
