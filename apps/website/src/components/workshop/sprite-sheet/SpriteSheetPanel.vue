<script setup lang="ts">
import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import EditorCollapsible from '../app-editor/EditorCollapsible.vue'
import SpriteSheetCharacter from './SpriteSheetCharacter.vue'
import { SPRITE_SECTIONS, sectionMeta } from './sections'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
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
    <EditorCollapsible
      v-for="section in SPRITE_SECTIONS"
      :key="section.id"
      :title="spc(section.title, locale)"
      :meta="sectionMeta(section.id, sprite, locale)"
      :initially-open="section.open"
    >
      <component :is="section.content" :sprite :locale />
    </EditorCollapsible>
  </fieldset>
</template>
