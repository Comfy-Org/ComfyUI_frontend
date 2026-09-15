<script setup lang="ts">
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import FeatureCard from './FeatureCard.vue'
import SectionHeader from '../../components/common/SectionHeader.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const learnMoreLink = {
  label: t('platform.router.roadmap.learnMore', locale),
  href: externalLinks.docsComfyRouter
}

const cards = [
  {
    title: t('platform.router.roadmap.1.title', locale),
    description: t('platform.router.roadmap.1.description', locale),
    link: learnMoreLink
  },
  {
    title: t('platform.router.roadmap.2.title', locale),
    description: t('platform.router.roadmap.2.description', locale),
    link: learnMoreLink
  },
  {
    title: t('platform.router.roadmap.3.title', locale),
    description: t('platform.router.roadmap.3.description', locale),
    link: learnMoreLink
  }
]
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-10 lg:py-14">
    <SectionHeader
      :label="t('platform.router.roadmap.eyebrow', locale)"
      max-width="xl"
      heading-size="compact"
    >
      {{ t('platform.router.roadmap.heading', locale) }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-primary-comfy-canvas/70">
          {{ t('platform.router.roadmap.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div class="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
      <FeatureCard
        v-for="card in cards"
        :key="card.title"
        :title="card.title"
        :description="card.description"
        :link="card.link"
      />
    </div>
  </section>
</template>
