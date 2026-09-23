<script setup lang="ts">
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import GlassCard from '../common/GlassCard.vue'
import VideoPlayer from '../common/VideoPlayer.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)
</script>

<template>
  <section
    class="mx-auto max-w-9xl bg-primary-comfy-ink px-4 py-20 lg:px-20 lg:py-24"
  >
    <GlassCard
      class="flex flex-col gap-12 lg:flex-row lg:items-stretch lg:gap-8"
    >
      <!-- Left: video -->
      <div class="relative aspect-video w-full lg:min-w-0 lg:flex-1">
        <VideoPlayer
          src="https://media.comfy.org/website/customers/blackmath/video.webm"
          poster="https://media.comfy.org/website/customers/blackmath/poster.webp"
          minimal
          :tracks="[
            {
              src: 'https://media.comfy.org/website/customers/blackmath/video.vtt',
              kind: 'subtitles',
              srclang: 'en',
              label: 'English'
            }
          ]"
          :locale
          class="absolute inset-0 aspect-auto h-full"
        />
      </div>

      <!-- Right: content -->
      <div
        data-testid="case-study-content"
        class="flex flex-col justify-center p-4 lg:min-w-0 lg:flex-1 lg:p-6"
      >
        <div>
          <p
            class="text-sm font-bold tracking-widest text-primary-comfy-yellow uppercase"
          >
            {{ t('caseStudy.label', locale) }}
          </p>
          <h2
            class="mt-7 text-3xl leading-[135%] font-medium whitespace-pre-line text-primary-comfy-canvas"
          >
            {{ t('caseStudy.heading', locale) }}
          </h2>
          <p
            class="mt-5 text-[17px] leading-[160%] font-light text-primary-comfy-canvas"
          >
            {{ t('caseStudy.subheading', locale) }}
          </p>
        </div>

        <div class="mt-10 flex flex-col items-start gap-3 sm:flex-row">
          <BrandButton
            :href="routes.customerVideoBlackMath"
            variant="solid"
            class="font-bold"
          >
            {{ t('caseStudy.watchStory', locale) }}
          </BrandButton>
          <BrandButton
            :href="routes.customers"
            variant="outline"
            class="font-bold"
          >
            {{ t('caseStudy.seeAll', locale) }}
          </BrandButton>
        </div>
      </div>
    </GlassCard>
  </section>
</template>
