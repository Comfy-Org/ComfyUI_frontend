<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { DEFAULT_POSE } from './cameraVocabulary'
import { resolveAsset } from './assetResolver'
import HeadlineChips from './HeadlineChips.vue'
import HeroGraph from './HeroGraph.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const defaultAsset = resolveAsset(DEFAULT_POSE)
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col items-center px-6 pt-8 pb-16 lg:px-10"
  >
    <div class="hidden w-full md:block">
      <HeroGraph />
    </div>

    <figure class="w-full max-w-md md:hidden">
      <img
        :src="defaultAsset.src"
        alt="Generated image rendered from the selected camera angle"
        :width="defaultAsset.width"
        :height="defaultAsset.height"
        class="w-full rounded-3xl border border-white/10"
      />
    </figure>

    <HeadlineChips :locale class="mt-10" />
  </section>
</template>
