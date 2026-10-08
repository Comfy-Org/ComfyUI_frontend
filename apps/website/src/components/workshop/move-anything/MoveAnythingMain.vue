<script setup lang="ts">
import { computed } from 'vue'

import type { MoveView, useMoveAnything } from '@/composables/useMoveAnything'
import type { Locale } from '@/i18n/translations'
import { mc } from '@/lib/workshop/move-anything/copy'
import { MOVE_EXAMPLE } from '@/lib/workshop/move-anything/mock-run'
import EditorEmpty from '@/components/workshop/app-editor/EditorEmpty.vue'
import EditorResult from '@/components/workshop/app-editor/EditorResult.vue'
import MoveAnythingWorkspace from './MoveAnythingWorkspace.vue'

const {
  move,
  view,
  locale = 'en'
} = defineProps<{
  move: ReturnType<typeof useMoveAnything>
  view: MoveView
  locale?: Locale
}>()

const { image, phase } = move
const labels = computed(() => ({
  resultAlt: mc('move.alt.result', locale),
  originalAlt:
    image.value?.url === MOVE_EXAMPLE.url
      ? mc('move.alt.example', locale)
      : (image.value?.name ?? ''),
  original: mc('move.view.original', locale),
  result: mc('move.view.result', locale),
  slider: mc('move.compare', locale)
}))
</script>

<template>
  <EditorEmpty
    v-if="!image"
    :title="mc('move.empty.title', locale)"
    :meta="mc('move.empty.meta', locale)"
    :upload-label="mc('move.empty.upload', locale)"
    :example-label="mc('move.empty.example', locale)"
    :example-image="MOVE_EXAMPLE.url"
    data-testid="move-empty"
    @file="move.useFile"
    @example="move.useExample"
  />
  <EditorResult
    v-else-if="phase.kind === 'done'"
    :before="image.url"
    :after="phase.result.url"
    :view
    :width="image.width"
    :height="image.height"
    :labels
  />
  <MoveAnythingWorkspace v-else :image :move :locale />
</template>
