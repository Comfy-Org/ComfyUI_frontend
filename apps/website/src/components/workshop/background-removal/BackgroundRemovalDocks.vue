<script setup lang="ts">
import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { cutoutFileName } from '../../../lib/workshop/background-removal/contract'
import { brc } from '../../../lib/workshop/background-removal/copy'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorHistory from '../app-editor/EditorHistory.vue'
import EditorResultDock from '../app-editor/EditorResultDock.vue'
import type { EditorView } from '../app-editor/view'
import BackgroundRemovalDock from './BackgroundRemovalDock.vue'

const {
  cutout,
  panel,
  locale = 'en'
} = defineProps<{
  cutout: BackgroundRemoval
  /** In the side panel layout the settings live in the panel. */
  panel: boolean
  locale?: Locale
}>()

const view = defineModel<EditorView>('view', { required: true })
const { image, phase, canUndo, canRedo } = cutout
const resultLabels = {
  compare: brc('cutout.view.compare', locale),
  result: brc('cutout.view.result', locale),
  original: brc('cutout.view.original', locale),
  edit: brc('cutout.edit', locale),
  again: brc('cutout.again', locale),
  download: brc('cutout.download', locale)
}
const historyLabels = {
  group: brc('cutout.history', locale),
  undo: brc('cutout.undo', locale),
  redo: brc('cutout.redo', locale)
}
</script>

<template>
  <EditorResultDock
    v-if="image && phase.kind === 'done'"
    v-model:view="view"
    :href="phase.result.url"
    :file-name="cutoutFileName(image.name, phase.result.format)"
    :labels="resultLabels"
    @edit="cutout.edit"
    @again="cutout.removeBackground"
  />
  <template v-else>
    <EditorHistory
      :can-undo
      :can-redo
      :disabled="phase.kind === 'running'"
      :labels="historyLabels"
      @undo="cutout.undo"
      @redo="cutout.redo"
    />
    <template v-if="!panel">
      <EditorDivider />
      <BackgroundRemovalDock :cutout :locale />
    </template>
  </template>
</template>
