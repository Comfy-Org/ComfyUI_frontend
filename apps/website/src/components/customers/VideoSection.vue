<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import VideoPlayer from '../common/VideoPlayer.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="px-6 py-16 lg:px-20 lg:py-40">
    <VideoPlayer
      src="/videos/customers/silverside.webm"
      poster="/videos/customers/silverside-poster.webp"
      :tracks="[
        {
          src: '/videos/customers/silverside.vtt',
          kind: 'subtitles',
          srclang: 'en',
          label: 'English'
        }
      ]"
      :locale
    />
  </section>
</template>
