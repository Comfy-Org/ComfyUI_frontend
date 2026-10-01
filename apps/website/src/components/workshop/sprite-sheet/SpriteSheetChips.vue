<script setup lang="ts">
import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import EditorChip from '../app-editor/EditorChip.vue'
import EditorDivider from '../app-editor/EditorDivider.vue'
import SpriteSheetRun from './SpriteSheetRun.vue'
import { SPRITE_SECTIONS, sectionMeta } from './sections'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { tray, phase } = sprite
</script>

<template>
  <EditorChip
    v-for="section in SPRITE_SECTIONS"
    :key="section.id"
    :label="spc(section.title, locale)"
    :value="sectionMeta(section.id, sprite, locale)"
    :expanded="tray === section.id"
    :disabled="phase.kind === 'running'"
    compact
    @click="sprite.toggleTray(section.id)"
  />
  <EditorDivider class="max-sm:hidden" />
  <SpriteSheetRun :sprite :locale />
</template>
