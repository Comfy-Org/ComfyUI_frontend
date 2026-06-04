<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="bg-secondary-mauve/30 mt-12 border-t border-primary-comfy-canvas/10 px-6 py-24 text-center md:py-32"
    data-testid="drops-footer-cta"
  >
    <h2
      class="mx-auto max-w-5xl text-4xl/tight font-light tracking-tight uppercase md:text-6xl/tight lg:text-7xl/tight"
    >
      <span class="block text-primary-comfy-canvas">
        {{ t('drops-landing.footerCta.line1', locale) }}
      </span>
      <span class="text-primary-comfy-yellow block font-bold">
        {{ t('drops-landing.footerCta.line2', locale) }}
      </span>
    </h2>
  </section>
</template>
