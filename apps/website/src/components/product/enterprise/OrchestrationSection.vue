<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="px-4 py-24 lg:px-20">
    <div
      class="bg-transparency-white-t4 rounded-5xl flex flex-col gap-8 p-2 lg:flex-row lg:items-stretch lg:gap-16"
    >
      <!-- Image -->
      <div class="lg:w-1/2">
        <div
          class="aspect-square w-full rounded-4xl bg-smoke-200"
          :aria-label="t('enterprise.orchestration.heading', locale)"
        />
      </div>

      <!-- Text -->
      <div class="flex flex-col justify-between p-6 lg:w-1/2">
        <div>
          <h2
            class="text-primary-comfy-canvas text-3xl font-light lg:text-5xl/tight"
          >
            {{ t('enterprise.orchestration.heading', locale) }}
          </h2>

          <p
            class="text-primary-comfy-yellow mt-8 text-lg font-semibold lg:mt-10 lg:text-2xl"
          >
            {{ t('enterprise.orchestration.highlight', locale) }}
          </p>

          <p class="mt-6 text-sm text-smoke-700 lg:text-base">
            {{ t('enterprise.orchestration.description', locale) }}
          </p>

          <p class="mt-4 text-sm text-smoke-500 italic lg:text-base">
            {{ t('enterprise.orchestration.quote', locale) }}
          </p>
        </div>

        <div class="mt-10 lg:mt-0">
          <a
            href="/contact"
            class="bg-primary-comfy-yellow text-primary-comfy-ink inline-block rounded-full px-8 py-4 text-sm font-bold tracking-wider transition-opacity hover:opacity-90"
          >
            {{ t('enterprise.hero.contactSales', locale) }}
          </a>
          <p class="mt-4 text-xs text-smoke-500 lg:text-sm">
            {{ t('enterprise.orchestration.footer', locale) }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
