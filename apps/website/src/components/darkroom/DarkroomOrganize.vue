<script setup lang="ts">
import { useInfiniteScroll } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DarkroomJob } from '@/lib/darkroom/feed'
import { doneSlots, formatTokens, usageSummary } from '@/lib/darkroom/feed'
import type { DarkroomItem } from '@/lib/darkroom/store'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

import DarkroomStarIcon from './DarkroomStarIcon.vue'

const PAGE = 240

const {
  jobs,
  urls,
  locale = 'en'
} = defineProps<{
  jobs: readonly DarkroomJob[]
  urls: ReadonlyMap<string, string>
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  open: [item: DarkroomItem]
  board: [ids: string[], anchor: HTMLElement, done: () => void]
  star: [ids: string[], starred: boolean]
  remove: [ids: string[]]
}>()

const query = ref('')
const starredOnly = ref(false)
const selected = ref(new Set<string>())
const limit = ref(PAGE)
let lastPicked = -1

const all = computed(() => doneSlots(jobs).map((slot) => slot.item))
const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return all.value.filter(
    (item) =>
      (!starredOnly.value || item.starred) &&
      (!needle || item.settings.prompt.toLowerCase().includes(needle))
  )
})
const shown = computed(() => visible.value.slice(0, limit.value))
const picked = computed(() =>
  all.value.filter((item) => selected.value.has(item.id))
)
const allSelected = computed(
  () =>
    visible.value.length > 0 &&
    visible.value.every((item) => selected.value.has(item.id))
)
const allStarred = computed(
  () => picked.value.length > 0 && picked.value.every((item) => item.starred)
)
const usage = computed(() => {
  const summary = usageSummary(jobs)
  return summary.totalTokens
    ? t(
        'darkroom.organize.usage',
        {
          count: summary.todayImages,
          today: formatTokens(summary.todayTokens),
          total: formatTokens(summary.totalTokens)
        },
        summary.todayImages
      )
    : ''
})

// A deleted image leaves the selection with it.
watch(all, (items) => {
  const live = new Set(items.map((item) => item.id))
  const kept = [...selected.value].filter((id) => live.has(id))
  if (kept.length !== selected.value.size) selected.value = new Set(kept)
})
watch([query, starredOnly], () => {
  limit.value = PAGE
})

useInfiniteScroll(
  () => (typeof window === 'undefined' ? null : window),
  () => {
    if (limit.value < visible.value.length) limit.value += PAGE
  },
  { distance: 1500 }
)

function clear() {
  selected.value = new Set()
  lastPicked = -1
}

function toggle(index: number, event: { readonly shiftKey: boolean }) {
  const next = new Set(selected.value)
  if (event.shiftKey && lastPicked >= 0) {
    // Shift-click selects the range.
    const [from, to] = [
      Math.min(index, lastPicked),
      Math.max(index, lastPicked)
    ]
    for (const item of shown.value.slice(from, to + 1)) next.add(item.id)
  } else {
    const { id } = shown.value[index]
    if (!next.delete(id)) next.add(id)
  }
  selected.value = next
  lastPicked = index
}

function toggleAll() {
  if (allSelected.value) return clear()
  selected.value = new Set(visible.value.map((item) => item.id))
}

function toggleStarredOnly() {
  starredOnly.value = !starredOnly.value
  clear()
}

function board(event: Event) {
  if (event.currentTarget instanceof HTMLElement)
    emit('board', [...selected.value], event.currentTarget, clear)
}

function removeSelected() {
  const ids = [...selected.value]
  clear()
  emit('remove', ids)
}

const toolButton =
  'h-11 cursor-pointer rounded-xl border border-transparency-white-t20 px-3 text-xs font-bold tracking-wider text-primary-warm-white uppercase transition-colors hover:border-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink'
const barButton =
  'cursor-pointer rounded-xl border border-transparency-white-t20 px-3 py-2 text-xs font-bold tracking-wider text-primary-warm-white uppercase hover:border-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink'
const quietButton =
  'cursor-pointer rounded-xl px-3 py-2 text-xs font-bold tracking-wider text-content-muted uppercase hover:bg-transparency-white-t8 hover:text-primary-warm-white'
</script>

<template>
  <div class="mx-auto w-full max-w-10xl px-4 pt-6 pb-28 sm:px-8 lg:px-14">
    <div
      class="mt-2 mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4"
    >
      <div>
        <h2 class="text-xl font-semibold text-primary-warm-white lg:text-2xl">
          {{ t('darkroom.organize.heading') }}
        </h2>
        <p
          v-if="all.length"
          class="mt-1.5 max-w-2xl text-base text-content-muted"
        >
          {{ t('darkroom.organize.sub', { count: all.length }, all.length) }}
        </p>
        <p v-if="usage" class="mt-1 text-sm text-content-muted">{{ usage }}</p>
      </div>
      <div v-if="all.length" class="flex flex-wrap items-center gap-2">
        <input
          v-model="query"
          type="text"
          class="h-11 w-full rounded-xl border border-transparency-white-t20 bg-site-bg-soft px-3.5 text-base text-primary-warm-white outline-none placeholder:text-content-muted focus:border-primary-comfy-canvas sm:w-64"
          :placeholder="t('darkroom.organize.search')"
          :aria-label="t('darkroom.organize.search')"
        />
        <button
          type="button"
          :class="
            cn(
              toolButton,
              starredOnly &&
                'border-primary-warm-white bg-primary-warm-white text-primary-comfy-ink'
            )
          "
          :aria-pressed="starredOnly"
          :title="t('darkroom.organize.starredTitle')"
          @click="toggleStarredOnly"
        >
          {{ t('darkroom.organize.starred') }}
        </button>
        <button type="button" :class="toolButton" @click="toggleAll">
          {{
            allSelected
              ? t('darkroom.organize.clearSelection')
              : t('darkroom.organize.selectAll')
          }}
        </button>
      </div>
    </div>

    <div
      v-if="all.length"
      class="grid grid-cols-3 gap-1 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-1.5"
      data-testid="darkroom-organize-grid"
    >
      <div
        v-for="(item, index) in shown"
        :key="item.id"
        :title="item.settings.prompt"
        :class="
          cn(
            'group/tile relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-site-bg-soft select-none',
            selected.has(item.id) && 'ring-3 ring-primary-warm-white ring-inset'
          )
        "
        role="checkbox"
        tabindex="0"
        :aria-checked="selected.has(item.id)"
        @click="toggle(index, $event)"
        @keydown.space.prevent="toggle(index, $event)"
      >
        <img
          v-if="urls.get(item.id)"
          :src="urls.get(item.id)"
          alt=""
          loading="lazy"
          class="block size-full object-cover"
        />
        <span
          :class="
            cn(
              'absolute top-2 left-2 flex size-6 items-center justify-center rounded-full border-[1.5px] transition-opacity pointer-coarse:opacity-100',
              selected.has(item.id)
                ? 'border-primary-warm-white bg-primary-warm-white text-primary-comfy-ink'
                : 'border-white/90 bg-primary-comfy-ink/45 text-transparent',
              selected.size
                ? 'opacity-100'
                : 'opacity-0 group-hover/tile:opacity-100'
            )
          "
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            aria-hidden="true"
            class="size-3.5"
          >
            <path d="M3.5 8.5l3 3 6-6.5" />
          </svg>
        </span>
        <DarkroomStarIcon
          v-if="item.starred"
          filled
          class="absolute bottom-2 left-2 size-5 text-primary-comfy-yellow drop-shadow-md"
        />
        <button
          type="button"
          class="absolute top-2 right-2 size-8 cursor-pointer rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink/80 text-base text-primary-warm-white opacity-0 transition-opacity group-hover/tile:opacity-100 hover:bg-primary-warm-white hover:text-primary-comfy-ink focus-visible:opacity-100 pointer-coarse:opacity-100"
          :title="t('darkroom.organize.viewLarger')"
          :aria-label="t('darkroom.organize.viewLarger')"
          @click.stop="emit('open', item)"
        >
          ⤢
        </button>
      </div>
    </div>
    <div
      v-else
      class="mx-auto max-w-xl px-4 py-18 text-center text-base/relaxed text-content-muted"
    >
      <h3 class="mb-2 text-lg font-semibold text-primary-warm-white">
        {{ t('darkroom.organize.emptyTitle') }}
      </h3>
      {{ t('darkroom.organize.emptyBody') }}
    </div>

    <div
      v-if="selected.size"
      class="fixed bottom-5 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl border border-transparency-white-t20 bg-primary-comfy-ink-light py-2 pr-2 pl-4.5"
      data-testid="darkroom-selection-bar"
    >
      <span class="mr-1.5 whitespace-nowrap text-primary-warm-white">
        {{ t('darkroom.organize.selected', { count: selected.size }) }}
      </span>
      <button
        type="button"
        :class="barButton"
        data-darkroom-menu-anchor
        @click="board"
      >
        {{ t('darkroom.organize.addToBoard') }}
      </button>
      <button
        type="button"
        :class="barButton"
        @click="emit('star', [...selected], !allStarred)"
      >
        {{
          allStarred ? t('darkroom.organize.unstar') : t('darkroom.tile.star')
        }}
      </button>
      <button type="button" :class="quietButton" @click="removeSelected">
        {{ t('darkroom.row.delete') }}
      </button>
      <button type="button" :class="quietButton" @click="clear">
        {{ t('darkroom.organize.clear') }}
      </button>
    </div>
  </div>
</template>
