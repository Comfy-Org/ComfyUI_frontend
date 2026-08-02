<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import BrandButton from '../../components/common/BrandButton.vue'
import VideoPlayer from '../../components/common/VideoPlayer.vue'
import Badge from '../../components/ui/badge/Badge.vue'
import { minimaxHeroVideo } from '../../data/minimax'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-12 lg:px-20 lg:py-16">
    <VideoPlayer :locale :src="minimaxHeroVideo" autoplay loop />

    <div class="mx-auto mt-10 flex max-w-2xl flex-col items-center text-center">
      <h1
        class="text-4xl font-light tracking-tight text-primary-comfy-canvas lg:text-6xl/tight"
      >
        {{ t('minimax.hero.title', locale) }}
      </h1>

      <p
        class="mt-6 text-base/relaxed font-light text-primary-comfy-canvas lg:text-lg/relaxed"
      >
        {{ t('minimax.hero.description', locale) }}
      </p>

      <div class="mt-8 flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
        <BrandButton
          :href="externalLinks.cloud"
          target="_blank"
          variant="solid"
          size="lg"
          class="w-full p-4 text-center lg:w-auto lg:min-w-52"
        >
          {{ t('minimax.hero.primaryCta', locale) }}
        </BrandButton>
        <BrandButton
          :href="externalLinks.workflows"
          target="_blank"
          variant="outline"
          size="lg"
          class="w-full p-4 text-center lg:w-auto lg:min-w-52"
        >
          {{ t('minimax.hero.secondaryCta', locale) }}
        </BrandButton>
      </div>

      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Badge variant="accent">{{
          t('minimax.hero.tagOpenWeights', locale)
        }}</Badge>
        <Badge variant="callout">{{
          t('minimax.hero.tagPartnerNodes', locale)
        }}</Badge>
      </div>

      <p class="text-primary-warm-gray mt-6 text-xs">
        {{ t('minimax.hero.footnote', locale) }}
      </p>
    </div>
  </section>
</template>
