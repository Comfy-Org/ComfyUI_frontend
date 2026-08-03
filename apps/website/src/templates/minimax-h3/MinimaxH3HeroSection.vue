<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import BrandButton from '../../components/common/BrandButton.vue'
import VideoPlayer from '../../components/common/VideoPlayer.vue'
import { minimaxH3Ctas, minimaxH3HeroVideo } from '../../data/minimaxH3'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-12 lg:px-20 lg:py-16">
    <VideoPlayer
      :locale
      :src="minimaxH3HeroVideo"
      :aria-label="t('minimaxH3.hero.videoLabel', locale)"
      autoplay
      loop
    />

    <div class="mx-auto mt-10 flex max-w-2xl flex-col items-center text-center">
      <h1
        class="text-4xl font-light tracking-tight text-primary-comfy-canvas lg:text-6xl/tight"
      >
        {{ t('minimaxH3.hero.titleLead', locale) }}
        <span class="text-primary-comfy-canvas/50">
          {{ t('minimaxH3.hero.titleTrail', locale) }}
        </span>
      </h1>

      <p
        class="mt-6 text-base/relaxed font-light text-primary-comfy-canvas/80 lg:text-lg/relaxed"
      >
        {{ t('minimaxH3.hero.description', locale) }}
      </p>

      <div class="mt-8 flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
        <BrandButton
          :href="minimaxH3Ctas.tryForFree"
          target="_blank"
          variant="solid"
          size="lg"
          class="w-full p-4 text-center lg:w-auto lg:min-w-52"
        >
          {{ t('minimaxH3.hero.primaryCta', locale) }}
        </BrandButton>
        <BrandButton
          :href="minimaxH3Ctas.runModel"
          target="_blank"
          variant="outline"
          size="lg"
          class="w-full p-4 text-center lg:w-auto lg:min-w-52"
        >
          {{ t('minimaxH3.hero.secondaryCta', locale) }}
        </BrandButton>
      </div>
    </div>
  </section>
</template>
