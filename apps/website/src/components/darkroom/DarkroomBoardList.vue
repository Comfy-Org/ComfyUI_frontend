<script setup lang="ts">
import { computed } from 'vue'

import type { DarkroomBoard } from '@/lib/darkroom/store'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  boards,
  activeId,
  urls,
  itemsOf,
  locale = 'en'
} = defineProps<{
  boards: readonly DarkroomBoard[]
  /** The board new images follow. */
  activeId?: string | null
  urls: ReadonlyMap<string, string>
  /** A board's images that still exist. */
  itemsOf: (board: DarkroomBoard) => string[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ show: [id: string]; create: [] }>()

/** How a cover of one, two or three images fills its two-by-two grid. */
const COVER_SPANS: Readonly<Record<number, readonly string[]>> = {
  1: ['col-span-2 row-span-2'],
  2: ['row-span-2', 'row-span-2'],
  3: ['row-span-2']
}

const cards = computed(() =>
  boards.map((board) => {
    const items = itemsOf(board)
    const cover = items.slice(0, 4)
    return {
      board,
      count: items.length,
      inUse: board.id === activeId,
      cover: cover.map((item, index) => ({
        item,
        span: COVER_SPANS[cover.length]?.[index] ?? ''
      }))
    }
  })
)
</script>

<template>
  <div
    class="mt-2 mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4"
  >
    <div>
      <h2 class="text-xl font-semibold text-primary-warm-white lg:text-2xl">
        {{ t('darkroom.boards.heading') }}
      </h2>
      <p class="mt-1.5 max-w-2xl text-base text-content-muted">
        {{ t('darkroom.boards.sub') }}
      </p>
    </div>
    <button
      type="button"
      class="h-11 cursor-pointer rounded-xl border border-transparency-white-t20 px-3 text-xs font-bold tracking-wider text-primary-warm-white uppercase transition-colors hover:border-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink"
      @click="emit('create')"
    >
      {{ t('darkroom.boards.new') }}
    </button>
  </div>
  <div
    v-if="cards.length"
    class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  >
    <button
      v-for="card in cards"
      :key="card.board.id"
      type="button"
      class="cursor-pointer rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 p-2 text-left transition-colors hover:border-transparency-white-t20"
      data-testid="darkroom-board-card"
      @click="emit('show', card.board.id)"
    >
      <span
        class="grid aspect-4/3 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl bg-site-bg-soft"
      >
        <img
          v-for="image in card.cover"
          :key="image.item"
          :src="urls.get(image.item)"
          alt=""
          loading="lazy"
          class="block size-full min-h-0 object-cover"
          :class="image.span"
        />
      </span>
      <span class="flex items-center justify-between gap-3 px-2.5 pt-3 pb-1.5">
        <span class="truncate text-base font-semibold text-primary-warm-white">
          {{ card.board.name }}
        </span>
        <span
          class="flex items-center gap-2 text-sm whitespace-nowrap text-content-muted"
        >
          <span
            v-if="card.inUse"
            class="inline-flex items-center gap-1.5 rounded-xl border border-transparency-white-t20 px-2.5 py-0.5 text-xs font-bold tracking-wider text-primary-warm-white uppercase"
          >
            <span class="size-1.5 rounded-full bg-primary-comfy-yellow" />
            {{ t('darkroom.boards.inUse') }}
          </span>
          {{ t('darkroom.boards.count', { count: card.count }, card.count) }}
        </span>
      </span>
    </button>
  </div>
  <div
    v-else
    class="mx-auto max-w-xl px-4 py-18 text-center text-base/relaxed text-content-muted"
  >
    <h3 class="mb-2 text-lg font-semibold text-primary-warm-white">
      {{ t('darkroom.boards.emptyTitle') }}
    </h3>
    {{ t('darkroom.boards.emptyBody') }}
  </div>
</template>
