<script setup lang="ts">
import type { SpriteSheet } from '@/composables/useSpriteSheet'
import type { Locale } from '@/i18n/translations'
import { spc } from '@/lib/workshop/sprite-sheet/copy'
import EditorPicker from '@/components/workshop/app-editor/EditorPicker.vue'
import { SPRITE_TRAYS } from './sections'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { tray } = sprite
</script>

<template>
  <template v-for="section in SPRITE_TRAYS" :key="section.id">
    <EditorPicker
      v-if="tray === section.id"
      :title="spc(section.title, locale)"
      :close-label="spc('sprite.close', locale)"
      @close="tray = undefined"
    >
      <component :is="section.content" :sprite :locale />
    </EditorPicker>
  </template>
</template>
