<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { SpriteSheet } from '@/composables/useSpriteSheet'
import { useStyleThumbnails } from '@/composables/useStyleThumbnails'
import type { Locale } from '@/i18n/translations'
import { spc } from '@/lib/workshop/sprite-sheet/copy'
import { SPRITE_GRID } from '@/lib/workshop/sprite-sheet/options'
import { framePose } from '@/lib/workshop/sprite-sheet/poses'
import EditorPickerRow from '@/components/workshop/app-editor/EditorPickerRow.vue'
import SpriteSheetDraftFrame from './SpriteSheetDraftFrame.vue'
import SpriteSheetMotion from './SpriteSheetMotion.vue'
import SpriteSheetStyle from './SpriteSheetStyle.vue'
import SpriteSheetTile from './SpriteSheetTile.vue'
import { sectionMeta } from './sections'

const {
  sprite,
  inline = false,
  locale = 'en'
} = defineProps<{
  sprite: SpriteSheet
  /** Unfolds each grid below its row, for the phone sheet. */
  inline?: boolean
  locale?: Locale
}>()

const { image, setup, tray, playback } = sprite
const { frame } = playback
const thumbnails = useStyleThumbnails(() => image.value?.url)
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <EditorPickerRow
      :label="spc('sprite.style', locale)"
      :value="sectionMeta('style', sprite, locale)"
      :expanded="tray === 'style'"
      :popup="!inline"
      data-testid="sprite-picker-style"
      @toggle="sprite.toggleTray('style')"
    >
      <SpriteSheetTile>
        <img
          :src="thumbnails[setup.style] ?? image?.url"
          alt=""
          :class="
            cn(
              'size-full object-contain',
              setup.style === 'pixel' && '[image-rendering:pixelated]'
            )
          "
        />
      </SpriteSheetTile>
    </EditorPickerRow>
    <div v-if="inline && tray === 'style'" class="pt-1 pb-2">
      <SpriteSheetStyle :sprite :locale />
    </div>
    <EditorPickerRow
      :label="spc('sprite.motion', locale)"
      :value="sectionMeta('motion', sprite, locale)"
      :expanded="tray === 'motion'"
      :popup="!inline"
      data-testid="sprite-picker-motion"
      @toggle="sprite.toggleTray('motion')"
    >
      <SpriteSheetTile v-if="image">
        <SpriteSheetDraftFrame
          :url="image.url"
          :pose="framePose(setup.motion, frame, SPRITE_GRID.frames, setup.seed)"
        />
      </SpriteSheetTile>
    </EditorPickerRow>
    <div v-if="inline && tray === 'motion'" class="pt-1 pb-2">
      <SpriteSheetMotion :sprite :locale />
    </div>
  </div>
</template>
