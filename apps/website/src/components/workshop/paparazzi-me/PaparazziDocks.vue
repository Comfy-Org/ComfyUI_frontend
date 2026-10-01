<script setup lang="ts">
import { Dices } from '@lucide/vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorHistory from '../app-editor/EditorHistory.vue'
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

const { phase, canUndo, canRedo } = paparazzi
const historyLabels = {
  group: pc('paparazzi.history', locale),
  undo: pc('paparazzi.tool.undo', locale),
  redo: pc('paparazzi.tool.redo', locale)
}
</script>

<template>
  <PaparazziResultDock
    v-if="phase.kind === 'done'"
    :paparazzi
    :result="phase.result"
    :locale
  />
  <template v-else>
    <EditorHistory
      :can-undo
      :can-redo
      :disabled="phase.kind === 'running'"
      :labels="historyLabels"
      @undo="paparazzi.undo"
      @redo="paparazzi.redo"
    />
    <EditorDivider />
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
