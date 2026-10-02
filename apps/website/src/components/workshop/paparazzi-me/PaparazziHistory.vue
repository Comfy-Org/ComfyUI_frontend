<script setup lang="ts">
import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import EditorHistory from '../app-editor/EditorHistory.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { canUndo, canRedo, phase } = paparazzi
const labels = {
  group: pc('paparazzi.history', locale),
  undo: pc('paparazzi.tool.undo', locale),
  redo: pc('paparazzi.tool.redo', locale)
}
</script>

<template>
  <EditorHistory
    :can-undo
    :can-redo
    :disabled="phase.kind === 'running'"
    :labels
    @undo="paparazzi.undo"
    @redo="paparazzi.redo"
  />
</template>
