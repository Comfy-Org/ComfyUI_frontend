<script setup lang="ts">
import type {
  MoveView,
  useMoveAnything
} from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorResultDock from '../app-editor/EditorResultDock.vue'
import MoveAnythingDock from './MoveAnythingDock.vue'
import MoveAnythingHistory from './MoveAnythingHistory.vue'
import MoveAnythingTools from './MoveAnythingTools.vue'

const {
  move,
  panel,
  locale = 'en'
} = defineProps<{
  move: ReturnType<typeof useMoveAnything>
  /** In the side panel layout the settings live in the panel. */
  panel: boolean
  locale?: Locale
}>()

const view = defineModel<MoveView>('view', { required: true })
const { image, phase, objects, tool, tray, quality } = move
const labels = {
  compare: mc('move.view.compare', locale),
  result: mc('move.view.result', locale),
  original: mc('move.view.original', locale),
  edit: mc('move.edit', locale),
  again: mc('move.again', locale),
  download: mc('move.download', locale)
}
</script>

<template>
  <EditorResultDock
    v-if="image && phase.kind === 'done'"
    v-model:view="view"
    :href="phase.result.url"
    :file-name="`moved-${image.name}`"
    :labels
    @edit="move.edit"
    @again="move.generate"
  />
  <template v-else-if="panel">
    <MoveAnythingTools :move :locale />
    <EditorDivider />
    <MoveAnythingHistory :move :locale />
  </template>
  <MoveAnythingDock
    v-else
    :move
    :image
    :tool
    :tray
    :quality
    :object-count="objects.length"
    :locale
    @tool="(next) => (tool = next)"
    @file="move.useFile"
    @tray="move.toggleTray"
  />
</template>
