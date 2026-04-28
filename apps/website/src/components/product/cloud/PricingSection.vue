<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { getRoutes } from '../../../config/routes'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="bg-transparency-white-t4 rounded-5xl mx-4 mt-4 mb-24 p-2 lg:mx-20 lg:mt-8 lg:mb-40"
  >
    <div
      class="bg-primary-comfy-yellow flex flex-col gap-24 rounded-4xl p-8 lg:flex-row lg:items-end lg:justify-between"
    >
      <div class="max-w-2xl">
        <h2
          class="text-primary-comfy-ink text-2xl/tight font-medium lg:text-3xl/tight"
        >
          {{ t('cloud.pricing.title', locale) }}
        </h2>

        <p class="text-primary-comfy-ink mt-4 text-base">
          {{ t('cloud.pricing.description', locale) }}
        </p>

        <p class="text-primary-comfy-ink mt-4 text-base font-bold">
          {{ t('cloud.pricing.tagline', locale) }}
        </p>
      </div>

      <a
        :href="getRoutes(locale).cloudPricing"
        class="bg-primary-comfy-ink text-primary-comfy-yellow shrink-0 rounded-2xl px-6 py-3 text-center text-sm font-semibold transition-opacity hover:opacity-90"
      >
        {{ t('cloud.pricing.cta', locale) }}
      </a>
    </div>
  </section>
</template>
