<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const headingParts = t('cloud.audience.heading', locale).split('{creators}')

const cards = [
  {
    labelKey: 'cloud.audience.creators.label' as const,
    titleKey: 'cloud.audience.creators.title' as const,
    descriptionKey: 'cloud.audience.creators.description' as const,
    image: '/images/cloud/audience-creator.webp'
  },
  {
    labelKey: 'cloud.audience.teams.label' as const,
    titleKey: 'cloud.audience.teams.title' as const,
    descriptionKey: 'cloud.audience.teams.description' as const,
    image: '/images/cloud/audience-team.webp'
  }
]
</script>

<template>
  <section class="px-4 pt-24 lg:px-20 lg:pt-40">
    <h2
      class="text-primary-comfy-canvas text-3.5xl/tight mx-auto max-w-3xl text-center font-light lg:text-5xl/tight"
    >
      {{ headingParts[0]
      }}<span class="text-white">{{
        t('cloud.audience.headingHighlight', locale)
      }}</span
      >{{ headingParts[1] }}
    </h2>

    <div
      class="rounded-5xl bg-transparency-white-t4 mt-12 grid grid-cols-1 gap-6 p-2 lg:mt-20 lg:grid-cols-2"
    >
      <div
        v-for="card in cards"
        :key="card.labelKey"
        class="bg-primary-comfy-ink rounded-4.5xl overflow-hidden"
      >
        <img
          :src="card.image"
          :alt="t(card.titleKey, locale)"
          class="aspect-4/3 w-full rounded-4xl object-cover"
          loading="lazy"
          decoding="async"
        />

        <div class="mt-8 p-6">
          <p
            class="text-primary-comfy-yellow text-sm font-bold tracking-widest uppercase"
          >
            {{ t(card.labelKey, locale) }}
          </p>

          <h3
            class="text-primary-comfy-canvas mt-8 text-3xl/tight font-light whitespace-pre-line"
          >
            {{ t(card.titleKey, locale) }}
          </h3>

          <p class="text-primary-comfy-canvas mt-8 text-base/normal">
            {{ t(card.descriptionKey, locale) }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
