<script setup lang="ts">
import type { SpriteSheet } from '@/composables/useSpriteSheet'
import type { Locale } from '@/i18n/translations'
import EditorPanelRow from '@/components/workshop/app-editor/EditorPanelRow.vue'
import SpriteSheetAnimation from './SpriteSheetAnimation.vue'
import SpriteSheetCharacter from './SpriteSheetCharacter.vue'
import SpriteSheetPickers from './SpriteSheetPickers.vue'
import SpriteSheetSeed from './SpriteSheetSeed.vue'

const {
  sprite,
  inline = false,
  locale = 'en'
} = defineProps<{
  sprite: SpriteSheet
  /** Unfolds the style and motion grids in the panel, for phones. */
  inline?: boolean
  locale?: Locale
}>()

const { image, phase } = sprite
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'running' || phase.kind === 'done'"
    class="min-w-0"
    data-testid="sprite-panel"
  >
    <SpriteSheetCharacter v-if="image" :image :locale @file="sprite.useFile" />
    <EditorPanelRow>
      <SpriteSheetAnimation :sprite :locale />
    </EditorPanelRow>
    <EditorPanelRow>
      <SpriteSheetPickers :sprite :inline :locale />
    </EditorPanelRow>
    <EditorPanelRow>
      <SpriteSheetSeed :sprite :locale />
    </EditorPanelRow>
  </fieldset>
</template>
