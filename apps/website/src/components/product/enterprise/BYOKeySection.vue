<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'
import CardGridSection from '../shared/CardGridSection.vue'

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
      <!-- Isometric illustration area -->
      <div class="flex flex-1 items-center justify-center" aria-hidden="true">
        <div
          class="grid grid-cols-5 gap-0.5"
          style="transform: rotateX(55deg) rotateZ(45deg)"
        >
          <span
            v-for="j in 15"
            :key="j"
            class="block size-5 rounded-sm"
            :class="[
              j === 3 || j === 8 || j === 13
                ? 'bg-primary-comfy-yellow'
                : j % 3 === 0
                  ? 'bg-primary-comfy-plum'
                  : 'bg-secondary-mauve'
            ]"
          />
        </div>
      </div>

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
