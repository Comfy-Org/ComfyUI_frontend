<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import Button from '../../components/ui/button/Button.vue'
import { BRAND_ASSETS_ZIP, BRAND_GUIDELINES_PDF } from '../../data/brandAssets'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="max-w-9xl mx-auto px-6 pt-4 pb-10 text-center lg:px-20 lg:pb-12"
  >
    <p
      class="text-primary-comfy-yellow text-sm font-extrabold tracking-[0.7px] uppercase"
    >
      {{ t('brand.hero.label', locale) }}
    </p>
    <h1
      class="lg:text-6.5xl mx-auto mt-6 max-w-4xl text-4xl leading-[1.3] font-light tracking-[-0.03em] text-primary-comfy-canvas md:text-5xl"
    >
      {{ t('brand.hero.heading', locale) }}
    </h1>
    <p
      class="mx-auto mt-6 max-w-2xl text-[17px] leading-[1.6] font-light text-primary-comfy-canvas/80"
    >
      {{ t('brand.hero.subheading', locale) }}
    </p>

    <div
      class="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
    >
      <Button
        as="a"
        :href="BRAND_GUIDELINES_PDF"
        target="_blank"
        rel="noopener noreferrer"
        variant="default"
        class="h-12 w-full px-5 text-sm font-extrabold sm:w-auto"
      >
        {{ t('brand.hero.viewGuidelines', locale) }}
      </Button>
      <Button
        as="a"
        :href="BRAND_ASSETS_ZIP"
        download
        variant="outline"
        class="h-12 w-full px-5 text-sm font-extrabold sm:w-auto"
      >
        {{ t('brand.hero.downloadLogos', locale) }}
      </Button>
    </div>
  </section>
</template>
