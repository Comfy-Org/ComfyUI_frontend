<script setup lang="ts">
import { Move, Redo2, SquareDashed, Undo2 } from '@lucide/vue'
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
import EditorTool from '../app-editor/EditorTool.vue'

const {
  image,
  tool,
  tray,
  quality,
  objectCount,
  movedCount,
  canUndo,
  canRedo,
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
  canUndo: boolean
  canRedo: boolean
  canGenerate: boolean
  moving: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  tool: [tool: MoveTool]
  undo: []
  redo: []
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
  <span
    class="mx-1 h-4.5 w-px shrink-0 bg-transparency-white-t20"
    aria-hidden="true"
  />
  <EditorTool
    :icon="Undo2"
    :label="mc('move.tool.undo', locale)"
    icon-only
    :disabled="locked() || !canUndo"
    @click="emit('undo')"
  />
  <EditorTool
    :icon="Redo2"
    :label="mc('move.tool.redo', locale)"
    icon-only
    :disabled="locked() || !canRedo"
    @click="emit('redo')"
  />
  <span
    class="mx-1 h-4.5 w-px shrink-0 bg-transparency-white-t20"
    aria-hidden="true"
  />
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
  <span
    class="mx-1 h-4.5 w-px shrink-0 bg-transparency-white-t20"
    aria-hidden="true"
  />
  <button
    v-if="moving"
    type="button"
    class="flex h-8 shrink-0 items-center gap-2 rounded-full bg-transparency-white-t8 px-3.5 text-xs font-medium text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
    @click="emit('cancel')"
  >
    <span
      class="size-3 rounded-full border-2 border-transparency-white-t20 border-t-primary-comfy-yellow motion-safe:animate-spin"
      aria-hidden="true"
    />
    {{ mc('move.cancel', locale) }}
  </button>
  <button
    v-else
    type="button"
    :disabled="!canGenerate"
    data-testid="move-generate"
    class="flex h-8 shrink-0 items-center gap-2 rounded-full bg-primary-comfy-yellow pr-1.5 pl-3.5 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
    @click="emit('generate')"
  >
    {{
      canGenerate
        ? mc('move.generate', locale, { n: movedCount })
        : mc('move.generate.idle', locale)
    }}
    <span
      class="rounded-full bg-primary-comfy-ink/10 px-2 py-0.5 text-[11px] font-medium"
      >{{ mc('move.credits', locale, { n: MOVE_CREDITS }) }}</span
    >
  </button>
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
