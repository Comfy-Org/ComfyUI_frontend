<script setup lang="ts">
import type { SpriteSheet } from '@/composables/useSpriteSheet'
import type { Locale } from '@/i18n/translations'
import { spc } from '@/lib/workshop/sprite-sheet/copy'
import { SPRITE_EXAMPLE } from '@/lib/workshop/sprite-sheet/mock-run'
import EditorEmpty from '@/components/workshop/app-editor/EditorEmpty.vue'
import SpriteSheetWorkspace from './SpriteSheetWorkspace.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { image } = sprite
</script>

<template>
  <EditorEmpty
    v-if="!image"
    :title="spc('sprite.empty.title', locale)"
    :examples="[
      {
        id: 'explorer',
        image: SPRITE_EXAMPLE.url,
        label: spc('sprite.empty.example', locale),
        fit: 'contain'
      }
    ]"
    data-testid="sprite-empty"
    @example="sprite.useExample"
  />
  <SpriteSheetWorkspace v-else :sprite :locale />
</template>
