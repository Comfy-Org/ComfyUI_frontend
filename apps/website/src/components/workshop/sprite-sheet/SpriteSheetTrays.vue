<script setup lang="ts">
import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import EditorTray from '../app-editor/EditorTray.vue'
import { SPRITE_TRAYS, sectionMeta } from './sections'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { tray } = sprite
</script>

<template>
  <template v-for="section in SPRITE_TRAYS" :key="section.id">
    <EditorTray
      v-if="tray === section.id"
      :title="spc(section.title, locale)"
      :close-label="spc('sprite.close', locale)"
      :field-label="!section.oneField"
      class="max-w-100"
      @close="tray = undefined"
    >
      <template #actions>
        <span
          class="max-w-40 truncate text-[11px] text-primary-warm-gray tabular-nums"
          >{{ sectionMeta(section.id, sprite, locale) }}</span
        >
      </template>
      <component :is="section.content" :sprite :locale />
    </EditorTray>
  </template>
</template>
