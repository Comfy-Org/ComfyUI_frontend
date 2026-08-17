<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchAudioGallery } from './types'

import ModelLaunchAudioSampleCard from './ModelLaunchAudioSampleCard.vue'

const { locale, audioGallery } = defineProps<{
  audioGallery: ModelLaunchAudioGallery
  locale: Locale
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 py-16 lg:px-20 lg:py-24">
    <div
      class="mx-auto grid max-w-7xl grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2"
    >
      <ModelLaunchAudioSampleCard
        v-for="card in audioGallery.cards"
        :key="card.id"
        :card
        :locale
      />
    </div>
  </section>
</template>
