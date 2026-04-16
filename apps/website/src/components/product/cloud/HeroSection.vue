<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'
import ProductHeroBadge from '../../common/ProductHeroBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="flex flex-col items-center px-4 pb-24 lg:px-20 lg:pb-24">
    <ProductHeroBadge text="CLOUD" />

    <h1
      class="text-primary-comfy-canvas text-3.5xl mt-8 text-center font-light whitespace-pre-line lg:text-5xl"
    >
      {{ t('cloud.hero.heading', locale) }}
    </h1>

    <p
      class="mt-8 max-w-md text-center text-base/relaxed text-white/60 lg:mt-20 lg:max-w-lg"
    >
      {{ t('cloud.hero.subtitle', locale) }}
    </p>

    <BrandButton
      :href="externalLinks.cloud"
      :label="t('cloud.hero.cta', locale)"
      class="mt-12 w-full text-center lg:mt-8 lg:w-auto"
    />

    <div class="mt-12 w-full max-w-2xl lg:mt-16">
      <img
        src="/images/cloud/hero-cube.svg"
        alt="ComfyUI Cloud — 3D node cube illustration"
        class="w-full"
      />
    </div>
  </section>
</template>
