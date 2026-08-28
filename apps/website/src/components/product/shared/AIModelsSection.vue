<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'
import CardArrow from '../../common/CardArrow.vue'
import type { AiModelCard } from './aiModelCards'
import { defaultAiModelCards } from './aiModelCards'

const { locale = 'en', cards = defaultAiModelCards } = defineProps<{
  locale?: Locale
  cards?: AiModelCard[]
}>()

const badgeClass =
  'bg-white/20 text-white backdrop-blur-sm group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink rounded-2xl'

const cardClass =
  'group relative h-72 cursor-pointer overflow-hidden rounded-3xl bg-black/40 lg:col-span-4 lg:aspect-square lg:h-auto'
</script>

<template>
  <section
    class="max-w-9xl mx-auto bg-primary-comfy-ink px-4 py-16 lg:px-20 lg:py-40"
  >
    <div class="mx-auto flex w-full max-w-7xl flex-col items-center">
      <p
        class="text-primary-comfy-yellow text-center text-sm font-bold tracking-widest uppercase"
      >
        {{ t('cloud.aiModels.label', locale) }}
      </p>

      <h2
        class="text-3.5xl/tight mt-8 max-w-4xl text-center font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ t('cloud.aiModels.heading', locale) }}
      </h2>

      <p
        class="mt-8 max-w-xl text-center text-sm font-light text-primary-comfy-canvas lg:text-base/snug"
      >
        {{ t('cloud.aiModels.subtitle', locale) }}
      </p>

      <div class="mt-16 w-full lg:mt-24">
        <div class="rounded-4xl bg-white/8 p-2 lg:p-1.5">
          <div class="grid grid-cols-1 gap-2 lg:grid-cols-12">
            <a
              v-for="card in cards"
              :key="card.titleKey"
              :href="externalLinks.workflows"
              :class="cardClass"
            >
              <video
                v-if="card.imageSrc.endsWith('.webm')"
                :src="card.imageSrc"
                :aria-label="t(card.titleKey, locale)"
                class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                autoplay
                loop
                muted
                playsinline
              >
                <track
                  v-if="card.trackSrc"
                  kind="descriptions"
                  :src="card.trackSrc"
                  srclang="en"
                  default
                />
              </video>
              <img
                v-else
                :src="card.imageSrc"
                :alt="t(card.titleKey, locale)"
                class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
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
                    badgeClass
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
                class="absolute right-20 bottom-6 left-6 text-2xl/tight font-light whitespace-pre-line text-primary-warm-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] lg:top-6 lg:right-auto lg:bottom-auto lg:text-3xl"
              >
                {{ t(card.titleKey, locale) }}
              </p>

              <CardArrow
                class="absolute right-5 bottom-5 lg:right-6 lg:bottom-6"
              />
            </a>
          </div>
        </div>
      </div>

      <BrandButton
        :href="externalLinks.workflows"
        variant="outline"
        size="lg"
        class="mt-4 w-full max-w-md px-8 py-4 text-center lg:mt-8 lg:w-auto"
      >
        <!-- <span class="lg:hidden"> -->
        {{ t('cloud.aiModels.ctaMobile', locale) }}
        <!-- </span> -->
        <!-- <span class="hidden lg:inline">{{
          t('cloud.aiModels.ctaDesktop', locale)
        }}</span> -->
      </BrandButton>
    </div>
  </section>
</template>
