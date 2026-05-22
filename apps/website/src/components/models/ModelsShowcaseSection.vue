<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import ShowcaseCard from './ShowcaseCard.vue'

export type ModelCard = {
  titleKey: TranslationKey
  slug: string
  imageSrc: string
  badgeIcon?: string
  badgeText?: string
  layoutClass: string
  objectPosition?: string
}

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const modelCards: ModelCard[] = [
  {
    titleKey: 'models.showcase.card.grokImagine',
    slug: 'grok-image',
    imageSrc: 'https://media.comfy.org/website/cloud/ai-models/grok-video.webm',
    badgeIcon: '/icons/ai-models/grok.svg',
    layoutClass: 'lg:col-span-6'
  },
  {
    titleKey: 'models.showcase.card.nanoBananaPro',
    slug: 'nano-banana',
    imageSrc:
      'https://media.comfy.org/website/cloud/ai-models/nano-banana-pro.webp',
    badgeIcon: '/icons/ai-models/gemini.svg',
    layoutClass: 'lg:col-span-6',
    objectPosition: 'center 20%'
  },
  {
    titleKey: 'models.showcase.card.ltx23',
    slug: 'ltxv-api',
    imageSrc: 'https://media.comfy.org/website/gallery/desert.webp',
    badgeText: 'ltx',
    layoutClass: 'lg:col-span-4'
  },
  {
    titleKey: 'models.showcase.card.qwenAdvancedEdit',
    slug: 'qwen-image-fp8-e4m3fn',
    imageSrc:
      'https://media.comfy.org/website/cloud/ai-models/qwen-image-edit.webp',
    badgeIcon: '/icons/ai-models/qwen.svg',
    layoutClass: 'lg:col-span-4'
  },
  {
    titleKey: 'models.showcase.card.wan22TextToVideo',
    slug: 'wan-api',
    imageSrc: 'https://media.comfy.org/website/cloud/ai-models/wan-22.webm',
    badgeIcon: '/icons/ai-models/wan.svg',
    layoutClass: 'lg:col-span-4'
  }
]

function modelHref(slug: string): string {
  return `${routes.models}/${slug}`
}
</script>

<template>
  <section class="px-4 py-24 lg:px-20 lg:py-40">
    <div class="mx-auto flex w-full max-w-7xl flex-col items-center">
      <p
        class="text-primary-comfy-yellow text-center text-sm font-bold tracking-widest uppercase"
      >
        {{ t('models.showcase.label', locale) }}
      </p>

      <h2
        class="text-primary-comfy-canvas text-3.5xl/tight mt-8 max-w-4xl text-center font-light whitespace-pre-line lg:text-5xl"
      >
        {{ t('models.showcase.heading', locale) }}
      </h2>

      <p
        class="text-primary-comfy-canvas mt-8 max-w-xl text-center text-sm font-light lg:text-base/snug"
      >
        {{ t('models.showcase.subtitle', locale) }}
      </p>

      <div class="mt-24 w-full">
        <div class="bg-transparency-white-t4 rounded-4xl p-2 lg:p-1.5">
          <div class="grid grid-cols-1 gap-2 lg:grid-cols-12">
            <ShowcaseCard
              v-for="card in modelCards"
              :key="card.titleKey"
              :card="card"
              :href="modelHref(card.slug)"
              :locale="locale"
              :class="card.layoutClass"
            />
          </div>
        </div>
      </div>

      <BrandButton
        :href="externalLinks.workflows"
        variant="outline"
        class="mt-8 w-full max-w-md text-center lg:w-auto"
      >
        {{ t('models.showcase.cta', locale) }}
      </BrandButton>
    </div>
  </section>
</template>
