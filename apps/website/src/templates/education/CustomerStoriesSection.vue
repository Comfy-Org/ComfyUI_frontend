<script setup lang="ts">
import CustomerStories01 from '../../components/blocks/CustomerStories01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { StoryCard } from '../../utils/customers'

// Stories arrive as a prop because the customer content collection is async and
// only loadable in the Astro page (see edu.astro).
const { stories, locale = 'en' } = defineProps<{
  stories: StoryCard[]
  locale?: Locale
}>()
</script>

<template>
  <CustomerStories01
    :heading="t('education.customerStories.heading', locale)"
    :subtitle="t('education.customerStories.subheading', locale)"
    :stories="stories"
    :locale="locale"
  />
</template>
