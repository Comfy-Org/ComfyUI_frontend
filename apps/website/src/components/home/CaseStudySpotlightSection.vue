<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import VideoPlayer from '../common/VideoPlayer.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)
</script>

<template>
  <section class="bg-primary-comfy-ink px-4 py-20 lg:px-20 lg:py-24">
    <div
      class="bg-transparency-white-t4 rounded-5xl flex flex-col gap-12 p-2 lg:flex-row lg:items-stretch lg:gap-8"
    >
      <!-- Left: video -->
      <div class="flex-1 overflow-hidden rounded-4xl">
        <VideoPlayer
          src="https://media.comfy.org/website/customers/blackmath/video.webm"
          poster="https://media.comfy.org/website/customers/blackmath/poster.webp"
          :tracks="[
            {
              src: 'https://media.comfy.org/website/customers/blackmath/video.vtt',
              kind: 'subtitles',
              srclang: 'en',
              label: 'English'
            }
          ]"
          :locale
        />
      </div>

      <!-- Right: content -->
      <div class="flex flex-col justify-between p-6 lg:flex-1">
        <div class="flex flex-col gap-8">
          <p
            class="text-primary-comfy-yellow text-sm font-bold tracking-widest uppercase"
          >
            {{ t('caseStudy.label', locale) }}
          </p>
          <h2
            class="text-primary-comfy-canvas text-5xl font-light whitespace-pre-line"
          >
            {{ t('caseStudy.heading', locale) }}
          </h2>
          <p class="text-primary-warm-gray text-base">
            {{ t('caseStudy.subheading', locale) }}
          </p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row">
          <BrandButton
            :href="routes.customers"
            variant="outline"
            class="flex-1 text-center"
          >
            {{ t('caseStudy.seeAll', locale) }}
          </BrandButton>
        </div>
      </div>
    </div>
  </section>
</template>
