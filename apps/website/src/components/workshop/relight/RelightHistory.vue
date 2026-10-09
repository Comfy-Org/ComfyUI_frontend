<script setup lang="ts">
import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import EditorHistory from '@/components/workshop/app-editor/EditorHistory.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { canUndo, canRedo, phase } = relight
const labels = {
  group: lc('relight.history', locale),
  undo: lc('relight.tool.undo', locale),
  redo: lc('relight.tool.redo', locale)
}
</script>

<template>
  <EditorHistory
    :can-undo
    :can-redo
    :disabled="phase.kind === 'running'"
    :labels
    @undo="relight.undo"
    @redo="relight.redo"
  />
</template>
