<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { DEFAULT_POSE } from './cameraVocabulary'
import { resolveAsset } from './assetResolver'
import HeroGraph from './HeroGraph.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const defaultAsset = resolveAsset(DEFAULT_POSE)
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 pt-8 pb-16 lg:px-10">
    <h1 class="sr-only">{{ t('hero.title', locale) }}</h1>

    <div class="hidden md:block">
      <HeroGraph />
    </div>

    <figure class="mx-auto max-w-md md:hidden">
      <img
        :src="defaultAsset.src"
        alt="Generated image of the scene from the front at eye level"
        :width="defaultAsset.width"
        :height="defaultAsset.height"
        class="w-full rounded-3xl border border-white/10"
      />
    </figure>
  </section>
</template>
