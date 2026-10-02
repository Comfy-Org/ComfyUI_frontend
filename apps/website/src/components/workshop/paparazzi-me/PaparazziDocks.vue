<script setup lang="ts">
import { Dices } from '@lucide/vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import EditorTool from '../app-editor/EditorTool.vue'
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
  <template v-else>
    <EditorTool
      :icon="Dices"
      :label="pc('paparazzi.tool.shuffle', locale)"
      :icon-only="!panel"
      :disabled="phase.kind === 'running'"
      @click="paparazzi.shuffle"
    />
    <PaparazziChips v-if="!panel" :paparazzi :locale />
  </template>
</template>
