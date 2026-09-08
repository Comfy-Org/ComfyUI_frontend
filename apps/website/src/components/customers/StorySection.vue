<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { StoryCard as StoryCardType } from '../../utils/customers'
import SectionLabel from '../common/SectionLabel.vue'
import StoryCard from './StoryCard.vue'

const { stories, locale = 'en' } = defineProps<{
  stories: StoryCardType[]
  locale?: Locale
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:px-16 lg:py-24">
    <SectionLabel>{{ t('customers.group.read', locale) }}</SectionLabel>
    <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <StoryCard
        v-for="story in stories"
        :key="story.slug"
        :story="story"
        :locale="locale"
      />
    </div>
  </section>
</template>
