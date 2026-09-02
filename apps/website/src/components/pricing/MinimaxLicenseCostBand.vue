<script setup lang="ts">
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const licenseHref = getRoutes(locale).minimaxLicense
</script>

<template>
  <div
    class="bg-transparency-white-t4 mx-auto mt-4 flex max-w-6xl flex-col gap-4 rounded-4xl px-5 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8"
  >
    <div>
      <p
        class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
      >
        {{ t('pricing.resourceCosts.minimaxLicense.eyebrow', locale) }}
      </p>
      <p class="mt-2 text-sm text-primary-warm-white">
        {{ t('pricing.resourceCosts.minimaxLicense.description', locale) }}
      </p>
    </div>
    <a
      :href="licenseHref"
      class="text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 shrink-0 rounded-sm text-sm underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
    >
      {{ t('pricing.resourceCosts.minimaxLicense.cta', locale) }}
    </a>
  </div>
</template>
