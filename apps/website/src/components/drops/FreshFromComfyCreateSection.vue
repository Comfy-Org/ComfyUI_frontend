<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import { captureDropClick } from './useDropClickCapture'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

interface FreshCard {
  id: string
  titleKey: TranslationKey
  bodyKey: TranslationKey
  ctaKey: TranslationKey
  href: string
  imageUrl: string
}

const cards: FreshCard[] = [
  {
    id: 'all-latest-drops',
    titleKey: 'drops-landing.fresh.card1.title',
    bodyKey: 'drops-landing.fresh.card1.body',
    ctaKey: 'drops-landing.fresh.card1.cta',
    href: externalLinks.liveDemoEvent,
    imageUrl: '/drops/fresh-drops.svg'
  },
  {
    id: 'comfy-originals',
    titleKey: 'drops-landing.fresh.card2.title',
    bodyKey: 'drops-landing.fresh.card2.body',
    ctaKey: 'drops-landing.fresh.card2.cta',
    href: externalLinks.blog,
    imageUrl: '/drops/fresh-originals.svg'
  }
]
</script>

<template>
  <section
    class="border-t border-primary-comfy-canvas/10 px-6 py-20 md:px-20 md:py-28"
    data-testid="drops-fresh"
  >
    <div class="mx-auto max-w-6xl text-center">
      <p
        class="text-sm tracking-widest text-primary-comfy-canvas/60 uppercase md:text-base"
      >
        {{ t('drops-landing.fresh.eyebrow', locale) }}
      </p>
      <h2
        class="text-primary-comfy-yellow mt-2 text-4xl font-bold tracking-tight uppercase md:text-6xl"
      >
        {{ t('drops-landing.fresh.headingAccent', locale) }}
      </h2>
    </div>

    <ul class="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2">
      <li
        v-for="card in cards"
        :key="card.id"
        class="bg-transparency-white-t4 flex flex-col overflow-hidden rounded-4xl border border-primary-comfy-canvas/10"
        :data-testid="`drops-fresh-${card.id}`"
      >
        <div
          class="flex aspect-video items-center justify-center overflow-hidden bg-primary-comfy-ink/40 p-6"
        >
          <img
            :src="card.imageUrl"
            :alt="t(card.titleKey, locale)"
            class="max-h-full max-w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div class="flex flex-1 flex-col gap-4 p-8">
          <h3 class="text-2xl font-light text-primary-comfy-canvas md:text-3xl">
            {{ t(card.titleKey, locale) }}
          </h3>
          <p class="text-base text-primary-comfy-canvas/70">
            {{ t(card.bodyKey, locale) }}
          </p>
          <div class="mt-auto pt-4">
            <BrandButton
              :href="card.href"
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="md"
              :data-testid="`drops-fresh-${card.id}-cta`"
              class="px-6 py-3 text-sm"
              @click="
                captureDropClick('fresh', {
                  card_id: card.id,
                  href: card.href
                })
              "
            >
              {{ t(card.ctaKey, locale) }}
            </BrandButton>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
