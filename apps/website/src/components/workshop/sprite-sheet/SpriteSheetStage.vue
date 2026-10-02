<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import {
  MOTION_LABELS,
  SPRITE_GRID,
  STYLE_LABELS
} from '../../../lib/workshop/sprite-sheet/options'
import EditorFrame from '../app-editor/EditorFrame.vue'
import { CHECKER } from './checker'
import SpriteSheetFrame from './SpriteSheetFrame.vue'
import SpriteSheetGrid from './SpriteSheetGrid.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const emit = defineEmits<{ touch: [] }>()

const { setup, phase } = sprite
const result = computed(() =>
  phase.value.kind === 'done' ? phase.value.result : undefined
)
const grid = computed(() => result.value ?? SPRITE_GRID)
const sheetAlt = computed(() =>
  spc('sprite.alt.sheet', locale, {
    n: grid.value.frames,
    motion: spc(MOTION_LABELS[setup.value.motion], locale),
    style: spc(STYLE_LABELS[setup.value.style], locale)
  })
)

function show(index: number) {
  emit('touch')
  sprite.showFrame(index)
}
</script>

<template>
  <EditorFrame :width="grid.columns" :height="grid.rows">
    <div
      :class="
        cn(
          'relative size-full overflow-hidden rounded-sm bg-primary-comfy-ink/80 ring-1 ring-transparency-white-t8',
          CHECKER
        )
      "
      data-testid="sprite-stage"
    >
      <img
        v-if="result"
        :src="result.url"
        :alt="sheetAlt"
        draggable="false"
        :class="
          cn(
            'pointer-events-none absolute inset-0 size-full',
            setup.style === 'pixel' && '[image-rendering:pixelated]'
          )
        "
        data-testid="sprite-sheet-result"
      />
      <div
        v-else
        role="img"
        :aria-label="spc('sprite.draft', locale)"
        :class="
          cn(
            'absolute inset-0 grid opacity-70',
            phase.kind === 'running' && 'motion-safe:animate-pulse'
          )
        "
        :style="{
          gridTemplateColumns: `repeat(${grid.columns}, 1fr)`,
          gridTemplateRows: `repeat(${grid.rows}, 1fr)`
        }"
      >
        <span v-for="index in grid.frames" :key="index" class="relative">
          <SpriteSheetFrame :sprite :index="index - 1" />
        </span>
      </div>
      <SpriteSheetGrid
        :columns="grid.columns"
        :rows="grid.rows"
        :count="grid.frames"
        :locale
        @show="show"
      />
      <slot />
    </div>
  </EditorFrame>
</template>
