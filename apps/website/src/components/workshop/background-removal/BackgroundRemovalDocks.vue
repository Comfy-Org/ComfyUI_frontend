<script setup lang="ts">
import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { brc } from '../../../lib/workshop/background-removal/copy'
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
const { image, phase } = cutout
const resultLabels = {
  compare: brc('cutout.view.compare', locale),
  result: brc('cutout.view.result', locale),
  original: brc('cutout.view.original', locale),
  edit: brc('cutout.edit', locale),
  again: brc('cutout.again', locale)
}
</script>

<template>
  <EditorResultDock
    v-if="image && phase.kind === 'done'"
    v-model:view="view"
    :labels="resultLabels"
    @edit="cutout.edit"
    @again="cutout.removeBackground"
  />
  <BackgroundRemovalDock v-else-if="!panel" :cutout :locale />
</template>
