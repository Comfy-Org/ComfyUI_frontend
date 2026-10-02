<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import { useStyleThumbnails } from '../../../composables/useStyleThumbnails'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import type { SpriteStyle } from '../../../lib/workshop/sprite-sheet/options'
import {
  SPRITE_STYLES,
  STYLE_LABELS
} from '../../../lib/workshop/sprite-sheet/options'
import EditorTiles from '../app-editor/EditorTiles.vue'
import SpriteSheetTile from './SpriteSheetTile.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { image, setup } = sprite
const thumbnails = useStyleThumbnails(() => image.value?.url)
const options = SPRITE_STYLES.map((id) => ({
  id,
  label: spc(STYLE_LABELS[id], locale)
}))
const style = computed({
  get: () => setup.value.style,
  set: (next?: SpriteStyle) => next && sprite.change({ style: next })
})
</script>

<template>
  <EditorTiles v-model="style" :label="spc('sprite.style', locale)" :options>
    <template #tile="{ option }">
      <SpriteSheetTile>
        <img
          :src="thumbnails[option.id] ?? image?.url"
          alt=""
          :class="
            cn(
              'size-full object-contain',
              option.id === 'pixel' && '[image-rendering:pixelated]'
            )
          "
        />
      </SpriteSheetTile>
    </template>
  </EditorTiles>
</template>
