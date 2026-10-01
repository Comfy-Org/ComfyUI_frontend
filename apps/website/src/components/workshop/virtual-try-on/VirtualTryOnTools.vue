<script setup lang="ts">
import { Shirt } from '@lucide/vue'

import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorHistory from '../app-editor/EditorHistory.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { canUndo, canRedo, phase, guide, garment } = tryOn
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
  <EditorDivider />
  <EditorTool
    :icon="Shirt"
    :label="vc('tryOn.tool.guide', locale)"
    :pressed="guide"
    :disabled="phase.kind === 'running' || !garment"
    @click="guide = !guide"
  />
</template>
