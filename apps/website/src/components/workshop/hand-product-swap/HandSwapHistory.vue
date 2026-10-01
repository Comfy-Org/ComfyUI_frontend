<script setup lang="ts">
import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import EditorHistory from '../app-editor/EditorHistory.vue'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { canUndo, canRedo, phase } = swap
const labels = {
  group: hc('swap.history', locale),
  undo: hc('swap.tool.undo', locale),
  redo: hc('swap.tool.redo', locale)
}
</script>

<template>
  <EditorHistory
    :can-undo
    :can-redo
    :disabled="phase.kind === 'running'"
    :labels
    @undo="swap.undo"
    @redo="swap.redo"
  />
</template>
