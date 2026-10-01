<script setup lang="ts">
import { Move, SquareDashed } from '@lucide/vue'
import { useTemplateRef } from 'vue'

import type {
  MoveImage,
  MoveTool,
  MoveTray
} from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import type { MoveQuality } from '../../../lib/workshop/move-anything/mock-run'
import { MOVE_CREDITS } from '../../../lib/workshop/move-anything/mock-run'
import EditorChip from '../app-editor/EditorChip.vue'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorRun from '../app-editor/EditorRun.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const {
  image,
  tool,
  tray,
  quality,
  objectCount,
  movedCount,
  canGenerate,
  moving,
  locale = 'en'
} = defineProps<{
  image?: MoveImage
  tool: MoveTool
  tray?: MoveTray
  quality: MoveQuality
  objectCount: number
  movedCount: number
  canGenerate: boolean
  moving: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  tool: [tool: MoveTool]
  file: [file: File]
  tray: [tray: MoveTray]
  generate: []
  cancel: []
}>()

const input = useTemplateRef<HTMLInputElement>('input')
const locked = () => !image || moving

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
    :icon="Move"
    :label="mc('move.tool.move', locale)"
    :pressed="tool === 'move'"
    :disabled="locked()"
    @click="emit('tool', 'move')"
  />
  <EditorTool
    :icon="SquareDashed"
    :label="mc('move.tool.add', locale)"
    :pressed="tool === 'add'"
    :disabled="locked()"
    @click="emit('tool', 'add')"
  />
  <EditorDivider />
  <EditorChip
    :value="image?.name ?? mc('move.image', locale)"
    :disabled="moving"
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
  <EditorChip
    :label="mc('move.quality', locale)"
    :value="
      mc(quality === 'fast' ? 'move.quality.fast' : 'move.quality.best', locale)
    "
    :expanded="tray === 'quality'"
    :disabled="locked()"
    @click="emit('tray', 'quality')"
  />
  <EditorDivider />
  <EditorRun
    :label="
      canGenerate
        ? mc('move.generate', locale, { n: movedCount })
        : mc('move.generate.idle', locale)
    "
    :credits="mc('move.credits', locale, { n: MOVE_CREDITS })"
    :cancel-label="mc('move.cancel', locale)"
    :running="moving"
    :disabled="!canGenerate"
    data-testid="move-generate"
    @run="emit('generate')"
    @cancel="emit('cancel')"
  />
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
