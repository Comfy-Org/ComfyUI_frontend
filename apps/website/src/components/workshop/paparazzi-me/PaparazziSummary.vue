<script setup lang="ts">
import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import { useSceneThumbnails } from '../../../composables/useSceneThumbnails'
import type { Locale } from '../../../i18n/translations'
import PaparazziSceneArt from './PaparazziSceneArt.vue'
import { setupSummary } from './sections'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { setup } = paparazzi
const thumbnails = useSceneThumbnails()
</script>

<template>
  <span
    class="block h-9 w-14 shrink-0 overflow-hidden rounded-md ring-1 ring-transparency-white-t8"
    aria-hidden="true"
  >
    <PaparazziSceneArt :scene="setup.scene" :src="thumbnails[setup.scene]" />
  </span>
  <span class="min-w-0 flex-1 truncate text-[13px] text-primary-warm-white">{{
    setupSummary(paparazzi, locale)
  }}</span>
</template>
