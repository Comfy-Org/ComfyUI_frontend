<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  count,
  allStarred,
  locale = 'en'
} = defineProps<{
  count: number
  /** Whether every selected image is starred, which turns Star into Unstar. */
  allStarred: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  board: [anchor: HTMLElement]
  star: [starred: boolean]
  remove: []
  clear: []
}>()

const starLabel = computed(() =>
  allStarred ? t('darkroom.organize.unstar') : t('darkroom.tile.star')
)

function board(event: Event) {
  if (event.currentTarget instanceof HTMLElement)
    emit('board', event.currentTarget)
}

const barButton =
  'cursor-pointer rounded-xl border border-transparency-white-t20 px-3 py-2 text-xs font-bold tracking-wider text-primary-warm-white uppercase hover:border-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink'
const quietButton =
  'cursor-pointer rounded-xl px-3 py-2 text-xs font-bold tracking-wider text-content-muted uppercase hover:bg-transparency-white-t8 hover:text-primary-warm-white'
</script>

<template>
  <div
    class="fixed bottom-5 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl border border-transparency-white-t20 bg-primary-comfy-ink-light py-2 pr-2 pl-4.5"
    data-testid="darkroom-selection-bar"
  >
    <span class="mr-1.5 whitespace-nowrap text-primary-warm-white">
      {{ t('darkroom.organize.selected', { count }) }}
    </span>
    <button
      type="button"
      :class="barButton"
      data-darkroom-menu-anchor
      @click="board"
    >
      {{ t('darkroom.organize.addToBoard') }}
    </button>
    <button type="button" :class="barButton" @click="emit('star', !allStarred)">
      {{ starLabel }}
    </button>
    <button type="button" :class="quietButton" @click="emit('remove')">
      {{ t('darkroom.row.delete') }}
    </button>
    <button type="button" :class="quietButton" @click="emit('clear')">
      {{ t('darkroom.organize.clear') }}
    </button>
  </div>
</template>
