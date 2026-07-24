<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'
import CardGridSection from '../shared/CardGridSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const cards = [
  {
    titleKey: 'enterprise.byoKey.card1.title' as const,
    descriptionKey: 'enterprise.byoKey.card1.description' as const,
    image: 'https://media.comfy.org/website/enterprise/enterprise_node_1.webp'
  },
  {
    titleKey: 'enterprise.byoKey.card2.title' as const,
    descriptionKey: 'enterprise.byoKey.card2.description' as const,
    image: 'https://media.comfy.org/website/enterprise/enterprise_node_2.webp'
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
      class="flex flex-col justify-between rounded-3xl border border-white/10 bg-primary-comfy-ink"
    >
      <img
        :src="card.image"
        :alt="t(card.titleKey, locale)"
        loading="lazy"
        decoding="async"
        class="w-full rounded-t-3xl object-contain p-8"
      />
      <div class="p-6 pt-0">
        <h3 class="text-3xl font-medium text-primary-comfy-canvas">
          {{ t(card.titleKey, locale) }}
        </h3>
        <p class="mt-3 text-sm text-primary-comfy-canvas">
          {{ t(card.descriptionKey, locale) }}
        </p>
      </div>
    </div>
  </CardGridSection>
</template>
