<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { SHOW_FREE_TIER } from '../../../config/features'
import { getRoutes } from '../../../config/routes'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto mt-4 mb-24 px-4 lg:mt-8 lg:mb-40 lg:px-20">
    <div class="bg-transparency-white-t4 rounded-5xl p-2">
      <div
        class="bg-primary-comfy-yellow flex flex-col gap-24 rounded-4xl p-8 lg:flex-row lg:items-end lg:justify-between"
      >
        <div class="max-w-2xl">
          <h2
            class="text-2xl/tight font-medium text-primary-comfy-ink lg:text-3xl/tight"
          >
            {{ t('cloud.pricing.title', locale) }}
          </h2>

          <p class="mt-4 text-base text-primary-comfy-ink">
            {{ t('cloud.pricing.description', locale) }}
          </p>

          <p
            v-if="SHOW_FREE_TIER"
            class="mt-4 text-base font-bold text-primary-comfy-ink"
          >
            {{ t('cloud.pricing.tagline', locale) }}
          </p>
        </div>

        <a
          :href="getRoutes(locale).cloudPricing"
          class="text-primary-comfy-yellow inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary-comfy-ink px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          <span class="ppformula-text-center">
            {{ t('cloud.pricing.cta', locale) }}
          </span>
        </a>
      </div>
    </div>
  </section>
</template>
