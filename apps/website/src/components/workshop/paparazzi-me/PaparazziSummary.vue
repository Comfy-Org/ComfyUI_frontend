<script setup lang="ts">
import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { sceneThumb, setupSummary } from './sections'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()
</script>

<template>
  <img
    v-if="sceneThumb(paparazzi)"
    :src="sceneThumb(paparazzi)"
    alt=""
    class="h-9 w-14 shrink-0 rounded-md object-cover ring-1 ring-transparency-white-t8"
  />
  <span class="min-w-0 flex-1 truncate text-[13px] text-primary-warm-white">{{
    setupSummary(paparazzi, locale)
  }}</span>
</template>
