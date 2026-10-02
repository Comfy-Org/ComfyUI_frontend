<script setup lang="ts">
import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { brc } from '../../../lib/workshop/background-removal/copy'
import EditorHistory from '../app-editor/EditorHistory.vue'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { canUndo, canRedo, phase } = cutout
const labels = {
  group: brc('cutout.history', locale),
  undo: brc('cutout.undo', locale),
  redo: brc('cutout.redo', locale)
}
</script>

<template>
  <EditorHistory
    :can-undo
    :can-redo
    :disabled="phase.kind === 'running'"
    :labels
    @undo="cutout.undo"
    @redo="cutout.redo"
  />
</template>
