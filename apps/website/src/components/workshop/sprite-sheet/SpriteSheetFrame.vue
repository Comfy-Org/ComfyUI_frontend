<script setup lang="ts">
import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import { SPRITE_GRID } from '../../../lib/workshop/sprite-sheet/options'
import { framePose } from '../../../lib/workshop/sprite-sheet/poses'
import SpriteSheetCell from './SpriteSheetCell.vue'
import SpriteSheetDraftFrame from './SpriteSheetDraftFrame.vue'

const { sprite, index } = defineProps<{ sprite: SpriteSheet; index: number }>()

const { image, setup, phase } = sprite
</script>

<template>
  <SpriteSheetCell
    v-if="phase.kind === 'done'"
    :result="phase.result"
    :index
    :pixel="setup.style === 'pixel'"
  />
  <SpriteSheetDraftFrame
    v-else-if="image"
    :url="image.url"
    :pose="framePose(setup.motion, index, SPRITE_GRID.frames, setup.seed)"
  />
</template>
