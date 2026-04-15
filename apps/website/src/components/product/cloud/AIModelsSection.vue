<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'

type ModelCard = {
  titleKey:
    | 'cloud.aiModels.card.grokImagine'
    | 'cloud.aiModels.card.nanoBananaPro'
    | 'cloud.aiModels.card.ltx23'
    | 'cloud.aiModels.card.qwenImageEdit'
    | 'cloud.aiModels.card.wan22TextToVideo'
  imageSrc: string
  badgeIcon: string
  badgeClass: string
  layoutClass: string
}

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const modelCards: ModelCard[] = [
  {
    titleKey: 'cloud.aiModels.card.grokImagine',
    imageSrc: '/images/cloud/ai-models/grok-imagine.webp',
    badgeIcon: '/icons/ai-models/grok.svg',
    badgeClass:
      'bg-white/20 text-white rounded-2xl backdrop-blur-sm group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink',
    layoutClass: 'lg:col-span-6 lg:aspect-[16/7]'
  },
  {
    titleKey: 'cloud.aiModels.card.nanoBananaPro',
    imageSrc: '/images/cloud/ai-models/nano-banana-pro.webp',
    badgeIcon: '/icons/ai-models/gemini.svg',
    badgeClass:
      'bg-white/20 text-white rounded-full backdrop-blur-sm group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink',
    layoutClass: 'lg:col-span-6 lg:aspect-[16/7]'
  },
  {
    titleKey: 'cloud.aiModels.card.ltx23',
    imageSrc: '/images/cloud/ai-models/ltx-23.webp',
    badgeIcon: '/icons/ai-models/ltx.svg',
    badgeClass:
      'bg-white/20 text-white rounded-full backdrop-blur-sm group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink',
    layoutClass: 'lg:col-span-4 lg:aspect-[4/3]'
  },
  {
    titleKey: 'cloud.aiModels.card.qwenImageEdit',
    imageSrc: '/images/cloud/ai-models/qwen-image-edit.webp',
    badgeIcon: '/icons/ai-models/qwen.svg',
    badgeClass:
      'bg-white/20 text-white rounded-full backdrop-blur-sm group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink',
    layoutClass: 'lg:col-span-4 lg:aspect-[4/3]'
  },
  {
    titleKey: 'cloud.aiModels.card.wan22TextToVideo',
    imageSrc: '/images/cloud/ai-models/wan-22.webp',
    badgeIcon: '/icons/ai-models/wan.svg',
    badgeClass:
      'bg-white/20 text-white rounded-full backdrop-blur-sm group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink',
    layoutClass: 'lg:col-span-4 lg:aspect-[4/3]'
  }
]

function getCardClass(layoutClass: string): string {
  return cn(
    layoutClass,
    'group relative h-72 cursor-pointer overflow-hidden rounded-4xl bg-black/40 lg:h-auto'
  )
}
</script>

<template>
  <section class="bg-primary-comfy-ink px-4 py-24 lg:px-20 lg:py-40">
    <div class="mx-auto flex w-full max-w-7xl flex-col items-center">
      <p
        class="text-primary-comfy-yellow text-center text-sm font-bold tracking-widest uppercase"
      >
        {{ t('cloud.aiModels.label', locale) }}
      </p>

      <h2
        class="text-primary-comfy-canvas text-3.5xl/tight mt-8 max-w-4xl text-center font-light lg:text-5xl"
      >
        {{ t('cloud.aiModels.heading', locale) }}
      </h2>

      <p
        class="text-primary-comfy-canvas mt-8 max-w-xl text-center text-sm font-light lg:text-base/snug"
      >
        {{ t('cloud.aiModels.subtitle', locale) }}
      </p>

      <div class="mt-24 w-full">
        <div class="rounded-4xl border border-white/12 p-2 lg:p-1.5">
          <div class="grid grid-cols-1 gap-2 lg:grid-cols-12">
            <a
              v-for="card in modelCards"
              :key="card.titleKey"
              :href="externalLinks.workflows"
              :class="getCardClass(card.layoutClass)"
            >
              <img
                :src="card.imageSrc"
                alt=""
                class="size-full object-cover"
                loading="lazy"
                decoding="async"
              />

              <div
                class="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-black/15"
              />

              <div
                :class="
                  cn(
                    'absolute top-5 right-5 flex h-12 min-w-12 items-center justify-center px-3 lg:top-6 lg:right-6',
                    card.badgeClass
                  )
                "
              >
                <span
                  class="inline-block size-6 bg-current"
                  :style="{
                    maskImage: `url(${card.badgeIcon})`,
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center'
                  }"
                />
              </div>

              <p
                class="text-primary-warm-white absolute inset-x-6 bottom-6 text-5xl/tight font-light whitespace-pre-line lg:top-6 lg:right-auto lg:bottom-auto lg:text-4xl"
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
        class-name="mt-4 lg:mt-8 w-full max-w-md text-center text-sm lg:w-auto"
      >
        <span class="lg:hidden">{{
          t('cloud.aiModels.ctaMobile', locale)
        }}</span>
        <span class="hidden lg:inline">{{
          t('cloud.aiModels.ctaDesktop', locale)
        }}</span>
      </BrandButton>
    </div>
  </section>
</template>
