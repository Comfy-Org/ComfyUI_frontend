<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DoneSlot } from '@/lib/darkroom/feed'
import { downloadName } from '@/lib/darkroom/feed'
import { TALL_RATIO } from '@/lib/darkroom/vocabulary'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

import DarkroomStarIcon from './DarkroomStarIcon.vue'

const {
  tile,
  url,
  locale = 'en'
} = defineProps<{
  tile: DoneSlot
  url?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  star: []
  edit: []
  vary: []
  board: [anchor: HTMLElement]
  /** The image's real width over height, once it has loaded. */
  ratio: [ratio: number, tall: boolean]
}>()

const shown = ref(false)
const starred = computed(() => tile.item.starred === true)
// A tile that finished on this visit fades in from a blur.
const arriving = computed(() => tile.fresh === true && !shown.value)

function loaded(event: Event) {
  const image = event.target
  if (image instanceof HTMLImageElement && image.naturalWidth) {
    const ratio = image.naturalWidth / image.naturalHeight
    emit('ratio', ratio, ratio < TALL_RATIO)
  }
  shown.value = true
}

function board(event: Event) {
  if (event.currentTarget instanceof HTMLElement)
    emit('board', event.currentTarget)
}

const overlayButton =
  'cursor-pointer rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink/85 px-2.5 py-1.5 text-xs font-bold tracking-wider text-primary-warm-white uppercase no-underline hover:bg-primary-warm-white hover:text-primary-comfy-ink'
</script>

<template>
  <img
    v-if="url"
    :src="url"
    :alt="tile.item.settings.prompt"
    :class="
      cn(
        'block size-full object-cover',
        tile.fresh &&
          'motion-safe:transition-[opacity,filter,scale] motion-safe:duration-1000',
        arriving &&
          'motion-safe:scale-105 motion-safe:opacity-0 motion-safe:blur-lg'
      )
    "
    @load="loaded"
    @error="shown = true"
  />
  <span
    class="absolute top-2 left-2 rounded-lg bg-primary-comfy-ink/75 px-2 py-0.5 text-xs text-primary-warm-white opacity-0 transition-opacity group-hover/tile:opacity-100"
  >
    {{
      t('darkroom.tile.seedTag', {
        seed: tile.seed,
        seconds: tile.item.stats.seconds ?? '?'
      })
    }}
  </span>
  <button
    type="button"
    :class="
      cn(
        'absolute top-2 right-2 flex size-8 cursor-pointer items-center justify-center rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink/75 transition-opacity focus-visible:opacity-100 pointer-coarse:opacity-100',
        starred
          ? 'text-primary-comfy-yellow'
          : 'text-primary-warm-white opacity-0 group-hover/tile:opacity-100 hover:bg-primary-warm-white hover:text-primary-comfy-ink'
      )
    "
    :aria-pressed="starred"
    :title="t('darkroom.tile.starTitle')"
    :aria-label="t('darkroom.tile.star')"
    @click.stop="emit('star')"
  >
    <DarkroomStarIcon :filled="starred" class="size-4" />
  </button>
  <!-- On a phone the tile is too small to carry four actions over the image,
       so a tap opens the viewer, which has them all. -->
  <div
    class="absolute inset-x-0 bottom-0 hidden flex-wrap justify-end gap-1.5 bg-linear-to-b from-transparent to-black/60 p-2 opacity-0 transition-opacity group-focus-within/tile:opacity-100 group-hover/tile:opacity-100 sm:flex pointer-coarse:opacity-100"
  >
    <button
      type="button"
      :class="overlayButton"
      :title="t('darkroom.tile.editTitle')"
      @click.stop="emit('edit')"
    >
      {{ t('darkroom.tile.edit') }}
    </button>
    <button
      type="button"
      :class="overlayButton"
      :title="t('darkroom.tile.variationsTitle')"
      @click.stop="emit('vary')"
    >
      {{ t('darkroom.tile.variations') }}
    </button>
    <button
      type="button"
      :class="overlayButton"
      :title="t('darkroom.tile.boardTitle')"
      data-darkroom-menu-anchor
      @click.stop="board"
    >
      {{ t('darkroom.tile.board') }}
    </button>
    <a
      v-if="url"
      :href="url"
      :download="downloadName(tile.item)"
      :class="overlayButton"
      @click.stop
    >
      {{ t('darkroom.tile.download') }}
    </a>
  </div>
</template>
