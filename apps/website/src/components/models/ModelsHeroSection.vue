<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'

const {
  locale = 'en',
  modelName,
  ctaHref,
  videoSrc,
  videoAriaLabel = ''
} = defineProps<{
  locale?: Locale
  modelName: string
  ctaHref: string
  videoSrc: string
  videoAriaLabel?: string
}>()
</script>

<template>
  <section class="flex flex-col items-center px-6 pt-16 text-center lg:pt-36">
    <h1
      class="text-primary-comfy-canvas max-w-4xl text-4xl font-light tracking-tight lg:text-6xl"
    >
      {{ modelName }} in <span class="text-primary-comfy-yellow">ComfyUI</span>
    </h1>
    <p
      class="text-primary-comfy-canvas mt-6 max-w-2xl text-sm text-pretty lg:text-base"
    >
      {{ t('hero.subtitle', locale) }}
    </p>
    <BrandButton
      :href="ctaHref"
      variant="solid"
      size="lg"
      class="mt-10 px-8 py-4 uppercase"
    >
      {{ t('models.list.heroCta', locale).replace('{name}', modelName) }}
    </BrandButton>
    <div class="mt-16 w-full max-w-5xl">
      <video
        :src="videoSrc"
        :aria-label="videoAriaLabel"
        autoplay
        loop
        muted
        playsinline
        preload="metadata"
        class="rounded-4.5xl size-full object-cover"
      />
    </div>
  </section>
</template>
