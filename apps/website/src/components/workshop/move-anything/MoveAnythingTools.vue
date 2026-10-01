<script setup lang="ts">
import { Move, SquareDashed } from '@lucide/vue'

import type { useMoveAnything } from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import EditorTool from '../app-editor/EditorTool.vue'

const { move, locale = 'en' } = defineProps<{
  move: ReturnType<typeof useMoveAnything>
  locale?: Locale
}>()

const { tool, phase } = move
const TOOLS = [
  { id: 'move', icon: Move, label: 'move.tool.move' },
  { id: 'add', icon: SquareDashed, label: 'move.tool.add' }
] as const
</script>

<template>
  <EditorTool
    v-for="option in TOOLS"
    :key="option.id"
    :icon="option.icon"
    :label="mc(option.label, locale)"
    :pressed="tool === option.id"
    :disabled="phase.kind === 'moving'"
    @click="tool = option.id"
  />
</template>
