<script setup lang="ts">
import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import EditorDivider from '../app-editor/EditorDivider.vue'
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

const { phase, playback } = sprite
</script>

<template>
  <template v-if="phase.kind === 'done'">
    <SpriteSheetPlayback :playback :locale />
    <EditorDivider class="max-sm:hidden" />
    <SpriteSheetResultTools :sprite :locale />
  </template>
  <template v-else>
    <SpriteSheetPlayback :playback :locale />
    <template v-if="!panel">
      <EditorDivider />
      <SpriteSheetChips :sprite :locale />
    </template>
  </template>
</template>
