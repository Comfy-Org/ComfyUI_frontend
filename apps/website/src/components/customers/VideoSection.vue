<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import VideoPlayer from '../common/VideoPlayer.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="px-6 py-16 lg:px-20 lg:py-40">
    <VideoPlayer
      src="https://media.comfy.org/website/customers/silverside/video.webm"
      poster="https://media.comfy.org/website/customers/silverside/poster.webp"
      :tracks="[
        {
          src: 'https://media.comfy.org/website/customers/silverside/video.vtt',
          kind: 'subtitles',
          srclang: 'en',
          label: 'English'
        }
      ]"
      :locale
    />
  </section>
</template>
