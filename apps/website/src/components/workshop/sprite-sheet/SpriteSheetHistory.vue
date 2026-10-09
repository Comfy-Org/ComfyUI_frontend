<script setup lang="ts">
import type { SpriteSheet } from '@/composables/useSpriteSheet'
import type { Locale } from '@/i18n/translations'
import { spc } from '@/lib/workshop/sprite-sheet/copy'
import EditorHistory from '@/components/workshop/app-editor/EditorHistory.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { canUndo, canRedo, phase } = sprite
const labels = {
  group: spc('sprite.history', locale),
  undo: spc('sprite.tool.undo', locale),
  redo: spc('sprite.tool.redo', locale)
}
</script>

<template>
  <EditorHistory
    :can-undo
    :can-redo
    :disabled="phase.kind === 'running'"
    :labels
    @undo="sprite.undo"
    @redo="sprite.redo"
  />
</template>
