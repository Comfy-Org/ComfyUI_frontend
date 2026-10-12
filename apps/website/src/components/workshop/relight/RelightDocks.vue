<script setup lang="ts">
import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import EditorDivider from '@/components/workshop/app-editor/EditorDivider.vue'
import EditorResultDock from '@/components/workshop/app-editor/EditorResultDock.vue'
import type { EditorView } from '@/components/workshop/app-editor/view'
import RelightDock from './RelightDock.vue'
import RelightTools from './RelightTools.vue'
import RelightViewMenu from './RelightViewMenu.vue'

const {
  relight,
  panel,
  locale = 'en'
} = defineProps<{
  relight: Relight
  /** In the side panel layout the editing controls live in the panel. */
  panel: boolean
  locale?: Locale
}>()

const view = defineModel<EditorView>('view', { required: true })
const { image, phase } = relight
const labels = {
  compare: lc('relight.view.compare', locale),
  result: lc('relight.view.result', locale),
  original: lc('relight.view.original', locale),
  edit: lc('relight.edit', locale),
  again: lc('relight.again', locale)
}
</script>

<template>
  <EditorResultDock
    v-if="image && phase.kind === 'done'"
    v-model:view="view"
    :labels
    @edit="relight.edit"
    @again="relight.relight"
  />
  <template v-else-if="panel">
    <RelightTools :relight :locale />
    <EditorDivider />
    <RelightViewMenu :relight :locale />
  </template>
  <template v-else>
    <RelightViewMenu :relight :locale />
    <EditorDivider />
    <RelightDock :relight :locale />
  </template>
</template>
