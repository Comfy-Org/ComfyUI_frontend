<script setup lang="ts">
import type {
  MoveImage,
  useMoveAnything
} from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import EditorCollapsible from '../app-editor/EditorCollapsible.vue'
import EditorPanelRow from '../app-editor/EditorPanelRow.vue'
import EditorSeedField from '../app-editor/EditorSeedField.vue'
import EditorTextArea from '../app-editor/EditorTextArea.vue'
import MoveAnythingImageRow from './MoveAnythingImageRow.vue'
import MoveAnythingQuality from './MoveAnythingQuality.vue'

const {
  image,
  move,
  locale = 'en'
} = defineProps<{
  image: MoveImage
  move: ReturnType<typeof useMoveAnything>
  locale?: Locale
}>()

const { quality, seed, prompt, phase } = move
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'moving' || phase.kind === 'done'"
    class="min-w-0"
    data-testid="move-panel"
  >
    <MoveAnythingImageRow :image :locale @file="move.useFile" />
    <EditorPanelRow>
      <MoveAnythingQuality v-model="quality" :locale />
      <EditorSeedField
        v-model="seed"
        :label="mc('move.seed', locale)"
        :shuffle-label="mc('move.seed.shuffle', locale)"
      />
    </EditorPanelRow>
    <EditorCollapsible :title="mc('move.advanced', locale)">
      <EditorTextArea
        v-model="prompt"
        :label="mc('move.prompt', locale)"
        :placeholder="mc('move.prompt.placeholder', locale)"
      />
    </EditorCollapsible>
  </fieldset>
</template>
