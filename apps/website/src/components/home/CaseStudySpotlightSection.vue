<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)
</script>

<template>
  <section class="bg-primary-comfy-ink px-4 py-40 lg:px-20">
    <div
      class="bg-transparency-white-t4 rounded-5xl flex flex-col gap-12 p-2 lg:flex-row lg:items-stretch lg:gap-8"
    >
      <!-- Left: video / image placeholder -->
      <div class="bg-primary-comfy-canvas/20 aspect-4/3 flex-1 rounded-4xl" />

      <!-- Right: content -->
      <div class="flex flex-col justify-between p-6 lg:flex-1">
        <div class="flex flex-col gap-8">
          <p
            class="text-primary-comfy-yellow text-sm font-bold tracking-widest uppercase"
          >
            {{ t('caseStudy.label', locale) }}
          </p>
          <h2 class="text-primary-comfy-canvas text-5xl font-light">
            {{ t('caseStudy.heading', locale).split('\n')[0] }}<br />{{
              t('caseStudy.heading', locale).split('\n')[1]
            }}
          </h2>
          <p class="text-primary-warm-gray text-base">
            {{ t('caseStudy.subheading', locale) }}
          </p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row">
          <BrandButton
            :href="routes.videos"
            :label="t('caseStudy.watchVideos', locale)"
            variant="solid"
            class-name="flex-1 text-center"
          />
          <BrandButton
            :href="routes.caseStudies"
            :label="t('caseStudy.seeAll', locale)"
            variant="outline"
            class-name="flex-1 text-center"
          />
        </div>
      </div>
    </div>
  </section>
</template>
