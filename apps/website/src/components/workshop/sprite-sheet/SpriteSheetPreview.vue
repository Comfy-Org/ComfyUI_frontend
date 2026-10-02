<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import EditorFrame from '../app-editor/EditorFrame.vue'
import { CHECKER } from './checker'
import SpriteSheetFrame from './SpriteSheetFrame.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { playback } = sprite
const { frame, previous, total, onion } = playback
</script>

<template>
  <EditorFrame :width="1" :height="1">
    <div
      :class="
        cn(
          'relative size-full overflow-hidden rounded-sm bg-primary-comfy-ink/80 ring-1 ring-transparency-white-t8',
          CHECKER
        )
      "
      data-testid="sprite-preview"
    >
      <div
        role="img"
        :aria-label="spc('sprite.preview.alt', locale)"
        class="absolute inset-0"
      >
        <span v-if="onion && total > 1" class="absolute inset-0 opacity-35">
          <SpriteSheetFrame :sprite :index="previous" />
        </span>
        <SpriteSheetFrame :sprite :index="frame" />
      </div>
      <span
        class="absolute top-2 left-2.5 font-mono text-[11px] text-primary-warm-gray tabular-nums"
        data-testid="sprite-preview-frame"
        >{{
          spc('sprite.preview.frame', locale, { n: frame + 1, total })
        }}</span
      >
      <slot />
    </div>
  </EditorFrame>
</template>
