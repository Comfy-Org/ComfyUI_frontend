<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { DEFAULT_POSE } from './cameraVocabulary'
import { resolveAsset } from './assetResolver'
import HeroGraph from './HeroGraph.vue'
import PromptWords from './PromptWords.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const defaultAsset = resolveAsset(DEFAULT_POSE)
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 pt-8 pb-16 lg:px-10">
    <h1 class="sr-only">{{ t('hero.title', locale) }}</h1>

    <div class="hidden md:block">
      <HeroGraph />
    </div>

    <div class="flex flex-col items-center gap-6 md:hidden">
      <figure class="w-full max-w-md">
        <img
          :src="defaultAsset.src"
          alt="Generated image rendered from the selected camera angle"
          :width="defaultAsset.width"
          :height="defaultAsset.height"
          class="w-full rounded-3xl border border-white/10"
        />
      </figure>
      <PromptWords
        :azimuth="DEFAULT_POSE.azimuth"
        :elevation="DEFAULT_POSE.elevation"
        :zoom="DEFAULT_POSE.zoom"
      />
    </div>
  </section>
</template>
