<script setup lang="ts">
import type { SpriteSheet } from '@/composables/useSpriteSheet'
import type { Locale } from '@/i18n/translations'
import { spc } from '@/lib/workshop/sprite-sheet/copy'
import { SPRITE_EXAMPLES } from '@/lib/workshop/sprite-sheet/mock-run'
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
    :examples="
      SPRITE_EXAMPLES.map(({ id, image }) => ({
        id,
        image: image.url,
        label: spc(`sprite.examples.${id}` as const, locale),
        fit: 'contain' as const
      }))
    "
    data-testid="sprite-empty"
    @example="sprite.useExample"
  />
  <SpriteSheetWorkspace v-else :sprite :locale />
</template>
