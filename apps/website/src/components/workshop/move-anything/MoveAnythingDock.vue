<script setup lang="ts">
import { useTemplateRef } from 'vue'

import type {
  MoveImage,
  MoveTool,
  MoveTray,
  useMoveAnything
} from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import EditorChip from '../app-editor/EditorChip.vue'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorTool from '../app-editor/EditorTool.vue'
import MoveAnythingHistory from './MoveAnythingHistory.vue'
import MoveAnythingQuality from './MoveAnythingQuality.vue'
import MoveAnythingRun from './MoveAnythingRun.vue'
import { MOVE_TOOLS } from './tools'

const {
  move,
  image,
  tool,
  tray,
  objectCount,
  locale = 'en'
} = defineProps<{
  move: ReturnType<typeof useMoveAnything>
  image?: MoveImage
  tool: MoveTool
  tray?: MoveTray
  objectCount: number
  locale?: Locale
}>()

const emit = defineEmits<{
  tool: [tool: MoveTool]
  file: [file: File]
  tray: [tray: MoveTray]
}>()

const { quality } = move
const input = useTemplateRef<HTMLInputElement>('input')
const moving = () => move.phase.value.kind === 'moving'
const locked = () => !image || moving()

function onChange(event: Event) {
  const file =
    event.target instanceof HTMLInputElement
      ? event.target.files?.[0]
      : undefined
  if (file?.type.startsWith('image/')) emit('file', file)
}
</script>

<template>
  <EditorTool
    v-for="option in MOVE_TOOLS"
    :key="option.id"
    :icon="option.icon"
    :label="mc(option.label, locale)"
    :pressed="tool === option.id"
    :disabled="locked()"
    @click="emit('tool', option.id)"
  />
  <EditorDivider />
  <MoveAnythingHistory :move :locale />
  <EditorDivider />
  <EditorChip
    :value="image?.name ?? mc('move.image', locale)"
    :disabled="moving()"
    :aria-label="mc('move.change', locale)"
    class="max-sm:hidden"
    @click="input?.click()"
  >
    <img
      v-if="image"
      :src="image.url"
      alt=""
      class="-ml-1 size-5 rounded-full object-cover"
    />
  </EditorChip>
  <EditorChip
    :label="mc('move.objects', locale)"
    :value="String(objectCount)"
    :expanded="tray === 'objects'"
    :disabled="locked()"
    @click="emit('tray', 'objects')"
  />
  <MoveAnythingQuality
    v-model="quality"
    :locale
    :disabled="locked()"
    composer
  />
  <EditorDivider />
  <MoveAnythingRun :move :locale />
  <input
    ref="input"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    class="sr-only"
    tabindex="-1"
    aria-hidden="true"
    @change="onChange"
  />
</template>
