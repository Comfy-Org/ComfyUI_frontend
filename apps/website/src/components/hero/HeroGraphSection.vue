<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { DEFAULT_POSE } from './cameraVocabulary'
import { resolveAsset } from './assetResolver'
import HeroHeadline from './HeroHeadline.vue'
import HeroGraph from './HeroGraph.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const defaultAsset = resolveAsset(DEFAULT_POSE)
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col items-center px-6 pt-6 pb-16 lg:px-10"
  >
    <div class="hidden w-full md:block">
      <HeroGraph :locale />
    </div>

    <div class="flex flex-col items-center gap-8 md:hidden">
      <HeroHeadline :locale class="text-3xl" />
      <figure class="w-full max-w-md">
        <img
          :src="defaultAsset.src"
          alt="Generated image rendered from the selected camera angle"
          :width="defaultAsset.width"
          :height="defaultAsset.height"
          class="w-full rounded-3xl border border-white/10"
        />
      </figure>
    </div>
  </section>
</template>
