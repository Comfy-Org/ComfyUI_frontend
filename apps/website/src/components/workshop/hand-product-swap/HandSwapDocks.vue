<script setup lang="ts">
import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import EditorDivider from '../app-editor/EditorDivider.vue'
import HandSwapComposer from './HandSwapComposer.vue'
import HandSwapHistory from './HandSwapHistory.vue'
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
  <HandSwapResultDock
    v-if="hand && phase.kind === 'done'"
    :swap
    :href="phase.result.url"
    :file-name="`swapped-${hand.name}`"
    :locale
  />
  <template v-else-if="panel">
    <HandSwapTools :swap :locale />
    <EditorDivider />
    <HandSwapHistory :swap :locale />
  </template>
  <HandSwapComposer v-else :swap :locale />
</template>
