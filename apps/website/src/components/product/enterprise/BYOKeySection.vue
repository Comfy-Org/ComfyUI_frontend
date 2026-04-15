<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'
import CardGridSection from '../shared/CardGridSection.vue'
import IsometricGrid from '../shared/IsometricGrid.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const cards = [
  {
    titleKey: 'enterprise.byoKey.card1.title' as const,
    descriptionKey: 'enterprise.byoKey.card1.description' as const
  },
  {
    titleKey: 'enterprise.byoKey.card2.title' as const,
    descriptionKey: 'enterprise.byoKey.card2.description' as const
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
      class="bg-primary-comfy-ink flex aspect-square flex-col rounded-3xl border border-white/10 p-6"
    >
      <IsometricGrid />

      <!-- Card content -->
      <h3 class="text-primary-comfy-canvas mt-2 text-xl font-semibold">
        {{ t(card.titleKey, locale) }}
      </h3>
      <p class="mt-3 text-sm text-smoke-700">
        {{ t(card.descriptionKey, locale) }}
      </p>
    </div>
  </CardGridSection>
</template>
