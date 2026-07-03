<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'

import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import GlassCard from '../../common/GlassCard.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const headingParts = t('cloud.audience.heading', locale).split('{creators}')

const cards = [
  {
    labelKey: 'cloud.audience.creators.label' as const,
    titleKey: 'cloud.audience.creators.title' as const,
    descriptionKey: 'cloud.audience.creators.description' as const,
    image: 'https://media.comfy.org/website/cloud/audience-creator.webp'
  },
  {
    labelKey: 'cloud.audience.teams.label' as const,
    titleKey: 'cloud.audience.teams.title' as const,
    descriptionKey: 'cloud.audience.teams.description' as const,
    image: 'https://media.comfy.org/website/cloud/audience-team.webp'
  }
]
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 pt-24 lg:px-20 lg:pt-40">
    <h2
      class="text-3.5xl/tight mx-auto max-w-3xl text-center font-light text-primary-comfy-canvas lg:text-5xl/tight"
    >
      {{ headingParts[0]
      }}<span class="text-white">{{
        t('cloud.audience.headingHighlight', locale)
      }}</span
      >{{ headingParts[1] }}
    </h2>

    <GlassCard class="mt-12 grid grid-cols-1 gap-6 lg:mt-20 lg:grid-cols-2">
      <a
        v-for="card in cards"
        :key="card.labelKey"
        :href="externalLinks.cloud"
        class="rounded-4.5xl block overflow-hidden bg-primary-comfy-ink"
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
            class="mt-8 text-3xl/tight font-light whitespace-pre-line text-primary-comfy-canvas"
          >
            {{ t(card.titleKey, locale) }}
          </h3>

          <div class="mt-8 flex items-end justify-between gap-6">
            <p class="text-base/normal text-primary-comfy-canvas">
              {{ t(card.descriptionKey, locale) }}
            </p>

            <div
              class="hover:bg-primary-comfy-yellow flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-sm transition-colors hover:text-primary-comfy-ink"
            >
              <ChevronRight class="size-5" :stroke-width="2" />
            </div>
          </div>
        </div>
      </a>
    </GlassCard>
  </section>
</template>
