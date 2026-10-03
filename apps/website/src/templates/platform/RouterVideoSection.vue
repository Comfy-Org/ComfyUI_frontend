<script setup lang="ts">
import { translationsFor } from '../../i18n/translations'
import VideoPlayer from '../../components/common/VideoPlayer.vue'
import type { Locale } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-10 lg:px-20 lg:py-14">
    <VideoPlayer
      :locale="locale"
      :aria-label="t('platform.router.video.alt')"
      src="https://media.comfy.org/website/router/router-animatic-v019.mp4"
      poster="https://media.comfy.org/website/router/router-animatic-v019-poster.webp"
      autoplay
      mute-only
    />
  </section>
</template>
