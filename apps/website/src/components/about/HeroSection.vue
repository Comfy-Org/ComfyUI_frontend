<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="flex flex-col items-center pt-32 pb-16 lg:flex-row lg:items-center lg:pt-40 lg:pb-24"
  >
    <!-- Graphic -->
    <div class="order-2 mt-12 w-full lg:order-1 lg:mt-0 lg:w-1/2">
      <img
        src="/images/about/c.webp"
        alt="Comfy 3D logo"
        class="mx-auto w-full max-w-lg lg:max-w-none"
      />
    </div>

    <!-- Text -->
    <div
      class="order-1 flex flex-col items-center text-center lg:order-2 lg:w-1/2 lg:items-start lg:pl-12 lg:text-left"
    >
      <span
        class="text-primary-comfy-yellow text-xs font-semibold tracking-widest uppercase"
      >
        {{ t('about.hero.label', locale) }}
      </span>
      <h1
        class="text-primary-comfy-canvas mt-4 text-4xl/tight font-light lg:text-6xl"
      >
        {{ t('about.hero.heading', locale) }}
      </h1>
      <p class="text-primary-warm-gray mt-6 max-w-sm text-base">
        {{ t('about.hero.body', locale) }}
      </p>
      <BrandButton
        :href="locale === 'zh-CN' ? '/zh-CN/careers' : '/careers'"
        :label="t('about.hero.cta', locale)"
        variant="outline"
        class-name="mt-8 rounded-full"
      />
    </div>
  </section>
</template>
