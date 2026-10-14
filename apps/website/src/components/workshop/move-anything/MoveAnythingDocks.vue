<script setup lang="ts">
import type { MoveView, useMoveAnything } from '@/composables/useMoveAnything'
import type { Locale } from '@/i18n/translations'
import { mc } from '@/lib/workshop/move-anything/copy'
import EditorResultDock from '@/components/workshop/app-editor/EditorResultDock.vue'
import MoveAnythingDock from './MoveAnythingDock.vue'
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
const { image, phase, tool } = move
const labels = {
  compare: mc('move.view.compare', locale),
  result: mc('move.view.result', locale),
  original: mc('move.view.original', locale),
  edit: mc('move.edit', locale),
  again: mc('move.again', locale)
}
</script>

<template>
  <EditorResultDock
    v-if="image && phase.kind === 'done'"
    v-model:view="view"
    :labels
    @edit="move.edit"
    @again="move.generate"
  />
  <MoveAnythingTools v-else-if="panel" :move :locale />
  <MoveAnythingDock
    v-else
    :move
    :image
    :tool
    :locale
    @tool="(next) => (tool = next)"
    @file="move.useFile"
  />
</template>
