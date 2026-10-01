<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import { CHECKER } from './checker'
import SpriteSheetFrame from './SpriteSheetFrame.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { playback } = sprite
const { frame, previous, total, onion, fps } = playback
</script>

<template>
  <figure
    class="pointer-events-none z-10 m-0 flex w-36 shrink-0 flex-col gap-1.5 rounded-2xl border border-transparency-white-t8 bg-primary-comfy-ink-light/90 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:absolute sm:right-4 sm:bottom-20 sm:w-44 sm:p-2"
    data-testid="sprite-preview"
  >
    <div
      :class="
        cn(
          'relative aspect-square overflow-hidden rounded-xl bg-primary-comfy-ink',
          CHECKER
        )
      "
    >
      <span v-if="onion && total > 1" class="absolute inset-0 opacity-35">
        <SpriteSheetFrame :sprite :index="previous" />
      </span>
      <SpriteSheetFrame :sprite :index="frame" />
    </div>
    <figcaption
      class="flex items-center justify-between gap-2 px-1 text-[11px] text-primary-warm-gray"
    >
      <span class="truncate text-primary-warm-white">{{
        spc('sprite.preview', locale)
      }}</span>
      <span class="tabular-nums max-sm:hidden">{{
        spc('sprite.preview.frame', locale, { n: frame + 1, total })
      }}</span>
      <span class="tabular-nums">{{
        spc('sprite.fps', locale, { n: fps })
      }}</span>
    </figcaption>
  </figure>
</template>
