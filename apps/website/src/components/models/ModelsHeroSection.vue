<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import { I18nT } from 'vue-i18n'

import { translationsFor } from '@/i18n/translations'
import BrandButton from '@/components/common/BrandButton.vue'

const {
  locale = 'en',
  modelName,
  ctaHref,
  videoSrc,
  videoAriaLabel
} = defineProps<{
  locale?: Locale
  modelName: string
  ctaHref: string
  videoSrc: string
  videoAriaLabel?: string
}>()
const i18n = translationsFor(locale)
const { t } = i18n
</script>

<template>
  <section class="flex flex-col items-center px-6 pt-16 text-center lg:pt-36">
    <I18nT
      keypath="models.list.heroTitle"
      tag="h1"
      :i18n
      class="max-w-4xl text-4xl font-light tracking-tight text-primary-comfy-canvas lg:text-6xl"
    >
      <template #name>{{ modelName }}</template>
      <template #comfyui>
        <span class="text-primary-comfy-yellow">ComfyUI</span>
      </template>
    </I18nT>
    <p
      class="mt-6 max-w-2xl text-sm text-pretty text-primary-comfy-canvas lg:text-base"
    >
      {{ t('hero.subtitle') }}
    </p>
    <BrandButton
      :href="ctaHref"
      variant="solid"
      size="lg"
      class="mt-10 px-8 py-4 uppercase"
    >
      {{ t('models.list.heroCta', { name: modelName }) }}
    </BrandButton>
    <div class="mt-16 w-full max-w-5xl">
      <video
        :src="videoSrc"
        :aria-label="videoAriaLabel || undefined"
        :aria-hidden="videoAriaLabel ? undefined : true"
        autoplay
        loop
        muted
        playsinline
        preload="metadata"
        class="size-full rounded-4.5xl object-cover"
      />
    </div>
  </section>
</template>
