<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import FeatureCard from './FeatureCard.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const cards = [
  {
    title: t('platform.modelsFeatures.1.title', locale),
    description: t('platform.modelsFeatures.1.description', locale)
  },
  {
    title: t('platform.modelsFeatures.3.title', locale),
    description: t('platform.modelsFeatures.3.description', locale)
  },
  {
    title: t('platform.modelsFeatures.5.title', locale),
    description: t('platform.modelsFeatures.5.description', locale)
  },
  {
    title: t('platform.modelsFeatures.6.title', locale),
    description: t('platform.modelsFeatures.6.description', locale)
  }
]
</script>

<template>
  <section
    class="max-w-9xl mx-auto px-6 py-10 lg:py-14"
    :aria-label="t('platform.products.models.title', locale)"
  >
    <h2
      class="mb-8 text-center text-3xl/none font-light text-primary-comfy-canvas lg:text-4xl/none"
    >
      {{ t('platform.modelsFeatures.heading', locale) }}
    </h2>
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <FeatureCard
        v-for="card in cards"
        :key="card.title"
        :title="card.title"
        :description="card.description"
      />
    </div>
  </section>
</template>
