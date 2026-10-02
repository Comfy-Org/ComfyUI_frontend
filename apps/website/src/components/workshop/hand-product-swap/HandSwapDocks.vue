<script setup lang="ts">
import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import HandSwapComposer from './HandSwapComposer.vue'
import HandSwapResultDock from './HandSwapResultDock.vue'
import HandSwapTools from './HandSwapTools.vue'

const {
  swap,
  panel,
  locale = 'en'
} = defineProps<{
  swap: HandProductSwap
  /** In the side panel layout the settings live in the panel. */
  panel: boolean
  locale?: Locale
}>()

const { hand, phase } = swap
</script>

<template>
  <HandSwapResultDock v-if="hand && phase.kind === 'done'" :swap :locale />
  <HandSwapTools v-else-if="panel" :swap :locale />
  <HandSwapComposer v-else :swap :locale />
</template>
