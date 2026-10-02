<script setup lang="ts">
import type { useMoveAnything } from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import EditorTool from '../app-editor/EditorTool.vue'
import { MOVE_TOOLS } from './tools'

const { move, locale = 'en' } = defineProps<{
  move: ReturnType<typeof useMoveAnything>
  locale?: Locale
}>()

const { tool, phase } = move
</script>

<template>
  <EditorTool
    v-for="option in MOVE_TOOLS"
    :key="option.id"
    :icon="option.icon"
    :label="mc(option.label, locale)"
    icon-only
    :pressed="tool === option.id"
    :disabled="phase.kind === 'moving'"
    @click="tool = option.id"
  />
</template>
