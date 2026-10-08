<script setup lang="ts">
import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorHistory from '../app-editor/EditorHistory.vue'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { canUndo, canRedo, phase } = tryOn
const labels = {
  group: vc('tryOn.history', locale),
  undo: vc('tryOn.tool.undo', locale),
  redo: vc('tryOn.tool.redo', locale)
}
</script>

<template>
  <EditorHistory
    :can-undo
    :can-redo
    :disabled="phase.kind === 'running'"
    :labels
    @undo="tryOn.undo"
    @redo="tryOn.redo"
  />
</template>
