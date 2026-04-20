<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'
import CardGridSection from '../shared/CardGridSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const cards = [
  {
    titleKey: 'enterprise.byoKey.card1.title' as const,
    descriptionKey: 'enterprise.byoKey.card1.description' as const,
    image: 'https://media.comfy.org/website/api/logo-purple.webp'
  },
  {
    titleKey: 'enterprise.byoKey.card2.title' as const,
    descriptionKey: 'enterprise.byoKey.card2.description' as const,
    image: 'https://media.comfy.org/website/api/logo-yellow.webp'
  }
]
</script>

<template>
  <CardGridSection
    :heading="t('enterprise.byoKey.heading', locale)"
    :subtitle="t('enterprise.byoKey.subtitle', locale)"
    :columns="2"
  >
    <div
      v-for="(card, i) in cards"
      :key="i"
      class="bg-primary-comfy-ink flex flex-col justify-between rounded-3xl border border-white/10"
    >
      <img
        :src="card.image"
        :alt="t(card.titleKey, locale)"
        class="w-full rounded-t-3xl object-contain p-8"
      />
      <div class="p-6 pt-0">
        <h3 class="text-primary-comfy-canvas text-3xl font-medium">
          {{ t(card.titleKey, locale) }}
        </h3>
        <p class="text-primary-comfy-canvas mt-3 text-sm">
          {{ t(card.descriptionKey, locale) }}
        </p>
      </div>
    </div>
  </CardGridSection>
</template>
