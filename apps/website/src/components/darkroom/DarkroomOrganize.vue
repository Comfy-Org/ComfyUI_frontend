<script setup lang="ts">
import { useInfiniteScroll } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DarkroomJob } from '@/lib/darkroom/feed'
import {
  doneSlots,
  formatTokens,
  toggleSelection,
  usageSummary
} from '@/lib/darkroom/feed'
import type { DarkroomItem } from '@/lib/darkroom/store'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

import DarkroomOrganizeTile from './DarkroomOrganizeTile.vue'
import DarkroomSelectionBar from './DarkroomSelectionBar.vue'

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
const selected = ref<ReadonlySet<string>>(new Set())
const limit = ref(PAGE)
let lastPicked = -1

const all = computed(() => doneSlots(jobs).map((slot) => slot.item))
const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return all.value
    .filter((item) => !starredOnly.value || item.starred)
    .filter((item) => item.settings.prompt.toLowerCase().includes(needle))
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
  if (!summary.totalTokens) return ''
  return t(
    'darkroom.organize.usage',
    {
      count: summary.todayImages,
      today: formatTokens(summary.todayTokens),
      total: formatTokens(summary.totalTokens)
    },
    summary.todayImages
  )
})
const selectAllLabel = computed(() =>
  allSelected.value
    ? t('darkroom.organize.clearSelection')
    : t('darkroom.organize.selectAll')
)

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

function toggle(index: number, shiftKey: boolean) {
  selected.value = toggleSelection(
    selected.value,
    shown.value.map((item) => item.id),
    index,
    shiftKey ? lastPicked : -1
  )
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

function removeSelected() {
  const ids = [...selected.value]
  clear()
  emit('remove', ids)
}

const toolButton =
  'h-11 cursor-pointer rounded-xl border border-transparency-white-t20 px-3 text-xs font-bold tracking-wider text-primary-warm-white uppercase transition-colors hover:border-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink'
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
          class="h-11 w-full rounded-xl border border-transparency-white-t20 bg-transparency-white-t4 px-3.5 text-base text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus:border-primary-warm-white/60 sm:w-64"
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
          {{ selectAllLabel }}
        </button>
      </div>
    </div>

    <div
      v-if="all.length"
      class="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-1.5 lg:grid-cols-6 xl:grid-cols-8"
      data-testid="darkroom-organize-grid"
    >
      <DarkroomOrganizeTile
        v-for="(item, index) in shown"
        :key="item.id"
        :item
        :url="urls.get(item.id)"
        :selected="selected.has(item.id)"
        :selecting="selected.size > 0"
        :locale
        @toggle="(shiftKey) => toggle(index, shiftKey)"
        @open="emit('open', item)"
      />
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

    <DarkroomSelectionBar
      v-if="selected.size"
      :count="selected.size"
      :all-starred="allStarred"
      :locale
      @board="(anchor) => emit('board', [...selected], anchor, clear)"
      @star="(starred) => emit('star', [...selected], starred)"
      @remove="removeSelected"
      @clear="clear"
    />
  </div>
</template>
