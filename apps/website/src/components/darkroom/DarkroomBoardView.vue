<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'

import type { DarkroomBoard } from '@/lib/darkroom/store'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  board,
  items,
  using,
  urls,
  locale = 'en'
} = defineProps<{
  board: DarkroomBoard
  /** The board's images that still exist. */
  items: readonly string[]
  /** Whether new images follow this board. */
  using: boolean
  urls: ReadonlyMap<string, string>
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  back: []
  rename: [name: string]
  use: [following: boolean]
  upload: [files: File[]]
  remove: []
  drop: [item: string]
}>()

const file = useTemplateRef<HTMLInputElement>('file')
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')

function focusName() {
  void nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}
defineExpose({ focusName })

const summary = computed(() => {
  const count = t(
    'darkroom.boards.count',
    { count: items.length },
    items.length
  )
  return using ? `${count} · ${t('darkroom.boards.following')}` : count
})
const useLabel = computed(() =>
  using ? t('darkroom.boards.stop') : t('darkroom.boards.use')
)

function picked(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  emit('upload', [...(input.files ?? [])])
  input.value = ''
}

function renamed(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  if (input.value.trim()) emit('rename', input.value)
  else input.value = board.name
}

function confirmRemove() {
  if (window.confirm(t('darkroom.boards.confirmDelete', { name: board.name })))
    emit('remove')
}

const toolButton =
  'h-11 cursor-pointer rounded-xl border border-transparency-white-t20 px-3 text-xs font-bold tracking-wider text-primary-warm-white uppercase transition-colors hover:border-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-transparency-white-t20 disabled:hover:bg-transparent disabled:hover:text-primary-warm-white'
</script>

<template>
  <div
    class="mt-2 mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4"
  >
    <div>
      <button
        type="button"
        class="mb-2 block cursor-pointer text-xs font-bold tracking-wider text-content-muted uppercase hover:text-primary-warm-white"
        @click="emit('back')"
      >
        ‹ {{ t('darkroom.boards.all') }}
      </button>
      <input
        ref="nameInput"
        :key="board.id"
        :value="board.name"
        maxlength="80"
        :aria-label="t('darkroom.boards.nameLabel')"
        class="w-xl max-w-full border-b border-transparent bg-transparent text-xl font-semibold text-primary-warm-white outline-none hover:border-transparency-white-t20 focus:border-transparency-white-t20 lg:text-2xl"
        @change="renamed"
        @keydown.enter="nameInput?.blur()"
      />
      <p class="mt-1.5 text-base text-content-muted">{{ summary }}</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        :class="toolButton"
        :disabled="!items.length"
        @click="emit('use', !using)"
      >
        {{ useLabel }}
      </button>
      <button type="button" :class="toolButton" @click="file?.click()">
        {{ t('darkroom.boards.add') }}
      </button>
      <button
        type="button"
        class="h-11 cursor-pointer rounded-xl px-3 text-xs font-bold tracking-wider text-content-muted uppercase hover:bg-transparency-white-t8 hover:text-primary-warm-white"
        @click="confirmRemove"
      >
        {{ t('darkroom.row.delete') }}
      </button>
    </div>
  </div>
  <div
    v-if="items.length"
    class="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-1.5 lg:grid-cols-6 xl:grid-cols-8"
  >
    <div
      v-for="item in items"
      :key="item"
      class="group/tile relative aspect-square overflow-hidden rounded-xl bg-site-bg-soft"
    >
      <img
        :src="urls.get(item)"
        alt=""
        loading="lazy"
        class="block size-full object-cover"
      />
      <button
        type="button"
        class="absolute top-2 right-2 size-8 cursor-pointer rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink/80 text-base text-primary-warm-white opacity-0 transition-opacity group-hover/tile:opacity-100 hover:bg-primary-warm-white hover:text-primary-comfy-ink focus-visible:opacity-100 pointer-coarse:opacity-100"
        :title="t('darkroom.boards.removeItem')"
        :aria-label="t('darkroom.boards.removeItem')"
        @click="emit('drop', item)"
      >
        ×
      </button>
    </div>
  </div>
  <div
    v-else
    class="mx-auto max-w-xl px-4 py-18 text-center text-base/relaxed text-content-muted"
  >
    <h3 class="mb-2 text-lg font-semibold text-primary-warm-white">
      {{ t('darkroom.boards.boardEmptyTitle') }}
    </h3>
    {{ t('darkroom.boards.boardEmptyBody') }}
  </div>
  <input
    ref="file"
    type="file"
    accept="image/*"
    multiple
    hidden
    @change="picked"
  />
</template>
