<script setup lang="ts">
import VideoPlayer from '../../components/common/VideoPlayer.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-10 lg:px-20 lg:py-14">
    <VideoPlayer
      :locale
      :aria-label="t('platform.serverlessVideo.label', locale)"
      src="https://media.comfy.org/website/comfy-api/comfy-api-product-demo.mp4"
      autoplay
      lazy-autoplay
      persistent-controls
      fit="contain"
    />
  </section>
</template>
