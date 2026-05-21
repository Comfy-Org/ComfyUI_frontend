<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale, TranslationKey } from '../../i18n/translations'

import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'

type ModelCard = {
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

const badgeBase =
  'bg-white/20 text-white backdrop-blur-sm group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink'

const modelCards: ModelCard[] = [
  {
    titleKey: 'models.showcase.card.grokImagine',
    slug: 'grok-image',
    imageSrc: 'https://media.comfy.org/website/cloud/ai-models/grok-video.webm',
    badgeIcon: '/icons/ai-models/grok.svg',
    layoutClass: 'lg:col-span-6 lg:aspect-[16/7]'
  },
  {
    titleKey: 'models.showcase.card.nanoBananaPro',
    slug: 'nano-banana',
    imageSrc:
      'https://media.comfy.org/website/cloud/ai-models/nano-banana-pro.webp',
    badgeIcon: '/icons/ai-models/gemini.svg',
    layoutClass: 'lg:col-span-6 lg:aspect-[16/7]',
    objectPosition: 'center 20%'
  },
  {
    titleKey: 'models.showcase.card.ltx23',
    slug: 'ltxv-api',
    imageSrc: 'https://media.comfy.org/website/gallery/desert.webp',
    badgeText: 'ltx',
    layoutClass: 'lg:col-span-4 lg:aspect-[4/3]'
  },
  {
    titleKey: 'models.showcase.card.qwenAdvancedEdit',
    slug: 'qwen-image-fp8-e4m3fn',
    imageSrc:
      'https://media.comfy.org/website/cloud/ai-models/qwen-image-edit.webp',
    badgeIcon: '/icons/ai-models/qwen.svg',
    layoutClass: 'lg:col-span-4 lg:aspect-[4/3]'
  },
  {
    titleKey: 'models.showcase.card.wan22TextToVideo',
    slug: 'wan-api',
    imageSrc: 'https://media.comfy.org/website/cloud/ai-models/wan-22.webm',
    badgeIcon: '/icons/ai-models/wan.svg',
    layoutClass: 'lg:col-span-4 lg:aspect-[4/3]'
  }
]

function getCardClass(layoutClass: string): string {
  return cn(
    layoutClass,
    'group relative h-72 cursor-pointer overflow-hidden rounded-4xl bg-black/40 lg:h-auto'
  )
}

function modelHref(slug: string): string {
  return `${routes.models}/${slug}`
}
</script>

<template>
  <section class="bg-primary-comfy-ink px-4 py-24 lg:px-20 lg:py-40">
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
        <div class="rounded-4xl border border-white/12 p-2 lg:p-1.5">
          <div class="grid grid-cols-1 gap-2 lg:grid-cols-12">
            <a
              v-for="card in modelCards"
              :key="card.titleKey"
              :href="modelHref(card.slug)"
              target="_blank"
              rel="noopener noreferrer"
              :class="getCardClass(card.layoutClass)"
            >
              <video
                v-if="card.imageSrc.endsWith('.webm')"
                :src="card.imageSrc"
                :aria-label="t(card.titleKey, locale)"
                :style="
                  card.objectPosition
                    ? { objectPosition: card.objectPosition }
                    : undefined
                "
                class="size-full object-cover transition-transform duration-600 ease-in-out group-hover:scale-105"
                autoplay
                loop
                muted
                playsinline
              />
              <img
                v-else
                :src="card.imageSrc"
                :alt="t(card.titleKey, locale)"
                :style="
                  card.objectPosition
                    ? { objectPosition: card.objectPosition }
                    : undefined
                "
                class="size-full object-cover transition-transform duration-600 ease-in-out group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />

              <div
                class="absolute inset-0 bg-linear-to-t from-black/50 via-black/5 to-black/35"
              />

              <div
                :class="
                  cn(
                    'absolute top-5 right-5 flex h-12 min-w-12 items-center justify-center px-3 lg:top-6 lg:right-6',
                    badgeBase,
                    'rounded-2xl'
                  )
                "
              >
                <span
                  v-if="card.badgeIcon"
                  class="inline-block size-6 bg-current"
                  :style="{
                    maskImage: `url(${card.badgeIcon})`,
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center'
                  }"
                />
                <span
                  v-else-if="card.badgeText"
                  class="text-xs font-bold tracking-wider lowercase"
                >
                  {{ card.badgeText }}
                </span>
              </div>

              <p
                class="text-primary-warm-white absolute inset-x-6 bottom-6 text-2xl/tight font-light whitespace-pre-line drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] lg:top-6 lg:right-auto lg:bottom-auto lg:text-3xl"
              >
                {{ t(card.titleKey, locale) }}
              </p>
            </a>
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
