<script setup lang="ts">
import VideoPlayer from '../../components/common/VideoPlayer.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-10 lg:px-20 lg:py-14">
    <VideoPlayer
      :locale="locale"
      :aria-label="t('platform.router.video.alt', locale)"
      src="/videos/router/router-animatic.mp4"
      poster="/videos/router/router-animatic-poster.webp"
      autoplay
      lazy-autoplay
    />
  </section>
</template>
