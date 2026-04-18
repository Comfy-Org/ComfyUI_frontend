<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import VideoPlayer from '../common/VideoPlayer.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="px-6 py-16 lg:px-20 lg:py-40">
    <VideoPlayer :locale />
  </section>
</template>
