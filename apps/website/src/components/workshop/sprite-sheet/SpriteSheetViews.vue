<script setup lang="ts">
import { Film, LayoutGrid } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { view } = sprite
const views = [
  { id: 'sheet', label: spc('sprite.view.sheet', locale), icon: LayoutGrid },
  { id: 'preview', label: spc('sprite.view.preview', locale), icon: Film }
] as const
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="spc('sprite.views', locale)"
    class="flex items-center gap-0.5"
  >
    <button
      v-for="option in views"
      :key="option.id"
      type="button"
      role="radio"
      :aria-checked="view === option.id"
      :class="
        cn(
          'flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs text-primary-warm-gray transition hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none max-sm:px-2.5',
          view === option.id &&
            'bg-transparency-white-t20 text-primary-warm-white'
        )
      "
      @click="view = option.id"
    >
      <component :is="option.icon" class="size-3.5" aria-hidden="true" />
      <span class="max-sm:sr-only">{{ option.label }}</span>
    </button>
  </div>
</template>
