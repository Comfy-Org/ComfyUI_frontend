<script setup lang="ts">
import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorHistory from '../app-editor/EditorHistory.vue'
import SpriteSheetChips from './SpriteSheetChips.vue'
import SpriteSheetPlayback from './SpriteSheetPlayback.vue'
import SpriteSheetResultTools from './SpriteSheetResultTools.vue'

const {
  sprite,
  panel,
  locale = 'en'
} = defineProps<{
  sprite: SpriteSheet
  /** In the side panel layout the settings live in the panel. */
  panel: boolean
  locale?: Locale
}>()

const { phase, canUndo, canRedo, playback } = sprite
const history = {
  group: spc('sprite.history', locale),
  undo: spc('sprite.tool.undo', locale),
  redo: spc('sprite.tool.redo', locale)
}
</script>

<template>
  <template v-if="phase.kind === 'done'">
    <SpriteSheetPlayback :playback :locale />
    <EditorDivider class="max-sm:hidden" />
    <SpriteSheetResultTools :sprite :result="phase.result" :locale />
  </template>
  <template v-else>
    <EditorHistory
      :can-undo
      :can-redo
      :disabled="phase.kind === 'running'"
      :labels="history"
      @undo="sprite.undo"
      @redo="sprite.redo"
    />
    <EditorDivider />
    <SpriteSheetPlayback :playback :locale />
    <template v-if="!panel">
      <EditorDivider />
      <SpriteSheetChips :sprite :locale />
    </template>
  </template>
</template>
