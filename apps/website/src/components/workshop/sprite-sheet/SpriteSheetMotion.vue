<script setup lang="ts">
import { computed } from 'vue'

import type { SpriteSheet } from '@/composables/useSpriteSheet'
import type { Locale } from '@/i18n/translations'
import { spc } from '@/lib/workshop/sprite-sheet/copy'
import type { SpriteMotion } from '@/lib/workshop/sprite-sheet/options'
import {
  MOTION_LABELS,
  SPRITE_GRID,
  SPRITE_MOTIONS
} from '@/lib/workshop/sprite-sheet/options'
import { framePose } from '@/lib/workshop/sprite-sheet/poses'
import EditorTiles from '@/components/workshop/app-editor/EditorTiles.vue'
import SpriteSheetDraftFrame from './SpriteSheetDraftFrame.vue'
import SpriteSheetTile from './SpriteSheetTile.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { image, setup, playback } = sprite
const { frame } = playback
const options = SPRITE_MOTIONS.map((id) => ({
  id,
  label: spc(MOTION_LABELS[id], locale)
}))
const motion = computed({
  get: () => setup.value.motion,
  set: (next?: SpriteMotion) => next && sprite.change({ motion: next })
})
</script>

<template>
  <EditorTiles v-model="motion" :label="spc('sprite.motion', locale)" :options>
    <template #tile="{ option }">
      <SpriteSheetTile v-if="image">
        <SpriteSheetDraftFrame
          :url="image.url"
          :pose="framePose(option.id, frame, SPRITE_GRID.frames, setup.seed)"
        />
      </SpriteSheetTile>
    </template>
  </EditorTiles>
</template>
