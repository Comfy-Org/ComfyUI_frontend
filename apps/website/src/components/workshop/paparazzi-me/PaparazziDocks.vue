<script setup lang="ts">
import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import PaparazziChips from './PaparazziChips.vue'
import PaparazziResultDock from './PaparazziResultDock.vue'

const {
  paparazzi,
  panel,
  locale = 'en'
} = defineProps<{
  paparazzi: PaparazziMe
  /** In the side panel layout the settings live in the panel. */
  panel: boolean
  locale?: Locale
}>()

const { phase } = paparazzi
</script>

<template>
  <PaparazziResultDock v-if="phase.kind === 'done'" :paparazzi :locale />
  <PaparazziChips v-else-if="!panel" :paparazzi :locale />
</template>
