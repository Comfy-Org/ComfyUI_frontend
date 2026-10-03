<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'
import type { StoryCard as StoryCardType } from '../../utils/customers'
import SectionLabel from '../common/SectionLabel.vue'
import StoryCard from './StoryCard.vue'

const { stories, locale = 'en' } = defineProps<{
  stories: StoryCardType[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-16 lg:px-16 lg:py-24">
    <SectionLabel>{{ t('customers.group.read') }}</SectionLabel>
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
