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

const { objects, selected, quality, seed, phase } = move
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'moving' || phase.kind === 'done'"
    class="min-w-0"
    data-testid="move-panel"
  >
    <MoveAnythingImageRow :image :locale @file="move.useFile" />
    <EditorCollapsible :title="mc('move.objects', locale)" initially-open>
      <MoveAnythingObjectList
        :objects
        :selected
        :locale
        @select="(id) => (selected = id)"
        @remove="move.remove"
      />
      <p
        class="flex justify-between gap-2 px-1 text-[11px] text-primary-warm-gray"
      >
        <span>{{
          objects.length >= MAX_OBJECTS
            ? mc('move.objects.full', locale, { max: MAX_OBJECTS })
            : mc('move.objects.add', locale)
        }}</span>
        <span class="tabular-nums">{{
          mc('move.objects.count', locale, {
            n: objects.length,
            max: MAX_OBJECTS
          })
        }}</span>
      </p>
    </EditorCollapsible>
    <EditorCollapsible :title="mc('move.quality', locale)" initially-open>
      <MoveAnythingQualityPicker v-model="quality" :locale />
    </EditorCollapsible>
    <EditorCollapsible :title="mc('move.advanced', locale)">
      <EditorNumberField v-model="seed" :label="mc('move.seed', locale)" />
    </EditorCollapsible>
  </fieldset>
</template>
