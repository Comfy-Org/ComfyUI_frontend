<script setup lang="ts">
import type { useMoveAnything } from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import EditorHistory from '../app-editor/EditorHistory.vue'

const { move, locale = 'en' } = defineProps<{
  move: ReturnType<typeof useMoveAnything>
  locale?: Locale
}>()

const { canUndo, canRedo, phase } = move
const labels = {
  group: mc('move.history', locale),
  undo: mc('move.tool.undo', locale),
  redo: mc('move.tool.redo', locale)
}
</script>

<template>
  <EditorHistory
    :can-undo
    :can-redo
    :disabled="phase.kind === 'moving'"
    :labels
    @undo="move.undo"
    @redo="move.redo"
  />
</template>
