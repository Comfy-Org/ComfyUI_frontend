<script setup lang="ts">
import type {
  MoveImage,
  useMoveAnything
} from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { MAX_OBJECTS } from '../../../lib/workshop/move-anything/arrange'
import { mc } from '../../../lib/workshop/move-anything/copy'
import EditorCollapsible from '../app-editor/EditorCollapsible.vue'
import EditorNumberField from '../app-editor/EditorNumberField.vue'
import EditorTextArea from '../app-editor/EditorTextArea.vue'
import MoveAnythingImageRow from './MoveAnythingImageRow.vue'
import MoveAnythingObjectList from './MoveAnythingObjectList.vue'
import MoveAnythingQualityPicker from './MoveAnythingQualityPicker.vue'

const {
  image,
  move,
  locale = 'en'
} = defineProps<{
  image: MoveImage
  move: ReturnType<typeof useMoveAnything>
  locale?: Locale
}>()

const { objects, selected, quality, seed, prompt, phase } = move
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'moving' || phase.kind === 'done'"
    class="min-w-0"
    data-testid="move-panel"
  >
    <MoveAnythingImageRow :image :locale @file="move.useFile" />
    <EditorCollapsible
      :title="mc('move.objects', locale)"
      :meta="
        mc('move.objects.count', locale, {
          n: objects.length,
          max: MAX_OBJECTS
        })
      "
      initially-open
    >
      <MoveAnythingObjectList
        :objects
        :selected
        :locale
        @select="(id) => (selected = id)"
        @remove="move.remove"
        @rename="move.rename"
      />
      <p v-if="objects.length" class="px-1 text-xs text-primary-warm-gray">
        {{
          objects.length >= MAX_OBJECTS
            ? mc('move.objects.full', locale, { max: MAX_OBJECTS })
            : mc('move.objects.add', locale)
        }}
      </p>
    </EditorCollapsible>
    <EditorCollapsible
      :title="mc('move.quality', locale)"
      :meta="
        mc(
          quality === 'fast' ? 'move.quality.fast' : 'move.quality.best',
          locale
        )
      "
      initially-open
    >
      <MoveAnythingQualityPicker v-model="quality" :locale />
    </EditorCollapsible>
    <EditorCollapsible
      :title="mc('move.advanced', locale)"
      :meta="mc('move.advanced.summary', locale, { n: seed })"
    >
      <EditorTextArea
        v-model="prompt"
        :label="mc('move.prompt', locale)"
        :placeholder="mc('move.prompt.placeholder', locale)"
      />
      <EditorNumberField v-model="seed" :label="mc('move.seed', locale)" />
    </EditorCollapsible>
  </fieldset>
</template>
