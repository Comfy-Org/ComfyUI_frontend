<script setup lang="ts">
import VideoPlayer from '../../components/common/VideoPlayer.vue'
import type { Locale } from '../../i18n/translations'
import { routerT } from './routerCopy'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-10 lg:px-20 lg:py-14">
    <VideoPlayer
      :locale="locale"
      :aria-label="routerT('platform.router.video.alt', locale)"
      src="https://media.comfy.org/website/router/router-animatic-v019.mp4"
      poster="https://media.comfy.org/website/router/router-animatic-v019-poster.webp"
      autoplay
    />
  </section>
</template>
