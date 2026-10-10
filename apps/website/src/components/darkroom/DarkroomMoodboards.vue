<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DarkroomBoard } from '@/lib/darkroom/store'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  boards,
  openId,
  activeId,
  urls,
  itemsOf,
  locale = 'en'
} = defineProps<{
  boards: readonly DarkroomBoard[]
  /** The board whose page is open, or none for the list. */
  openId?: string
  /** The board new images follow. */
  activeId?: string | null
  urls: ReadonlyMap<string, string>
  /** A board's images that still exist. */
  itemsOf: (board: DarkroomBoard) => string[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  show: [id?: string]
  create: []
  rename: [id: string, name: string]
  use: [id?: string]
  upload: [id: string, files: File[]]
  remove: [id: string]
  drop: [id: string, item: string]
}>()

const file = useTemplateRef<HTMLInputElement>('file')
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')
const open = computed(() => boards.find((board) => board.id === openId))
const openItems = computed(() => (open.value ? itemsOf(open.value) : []))
const using = computed(() => !!open.value && open.value.id === activeId)

function focusName() {
  void nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}
defineExpose({ focusName })

function picked(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement) || !open.value) return
  emit('upload', open.value.id, [...(input.files ?? [])])
  input.value = ''
}

function renamed(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement) || !open.value) return
  if (input.value.trim()) emit('rename', open.value.id, input.value)
  else input.value = open.value.name
}

function confirmRemove() {
  if (!open.value) return
  if (
    window.confirm(
      t('darkroom.boards.confirmDelete', { name: open.value.name })
    )
  )
    emit('remove', open.value.id)
}

const toolButton =
  'h-11 cursor-pointer rounded-xl border border-transparency-white-t20 px-3 text-xs font-bold tracking-wider text-primary-warm-white uppercase transition-colors hover:border-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-transparency-white-t20 disabled:hover:bg-transparent disabled:hover:text-primary-warm-white'
const quietButton =
  'h-11 cursor-pointer rounded-xl px-3 text-xs font-bold tracking-wider text-content-muted uppercase hover:bg-transparency-white-t8 hover:text-primary-warm-white'
const heading = 'text-xl font-semibold text-primary-warm-white lg:text-2xl'
const emptyNote =
  'mx-auto max-w-xl px-4 py-18 text-center text-base/relaxed text-content-muted'
const emptyTitle = 'mb-2 text-lg font-semibold text-primary-warm-white'
</script>

<template>
  <div class="mx-auto w-full max-w-10xl px-4 pt-6 pb-28 sm:px-8 lg:px-14">
    <template v-if="!open">
      <div
        class="mt-2 mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4"
      >
        <div>
          <h2 :class="heading">{{ t('darkroom.boards.heading') }}</h2>
          <p class="mt-1.5 max-w-2xl text-base text-content-muted">
            {{ t('darkroom.boards.sub') }}
          </p>
        </div>
        <button type="button" :class="toolButton" @click="emit('create')">
          {{ t('darkroom.boards.new') }}
        </button>
      </div>
      <div
        v-if="boards.length"
        class="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4"
      >
        <button
          v-for="board in boards"
          :key="board.id"
          type="button"
          class="cursor-pointer rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 p-2 text-left transition-colors hover:border-transparency-white-t20"
          data-testid="darkroom-board-card"
          @click="emit('show', board.id)"
        >
          <span
            class="grid aspect-4/3 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl bg-site-bg-soft"
          >
            <img
              v-for="(item, index) in itemsOf(board).slice(0, 4)"
              :key="item"
              :src="urls.get(item)"
              alt=""
              loading="lazy"
              :class="
                cn(
                  'block size-full min-h-0 object-cover',
                  itemsOf(board).length === 1 && 'col-span-2 row-span-2',
                  itemsOf(board).length === 2 && 'row-span-2',
                  itemsOf(board).length === 3 && index === 0 && 'row-span-2'
                )
              "
            />
          </span>
          <span
            class="flex items-center justify-between gap-3 px-2.5 pt-3 pb-1.5"
          >
            <span
              class="truncate text-base font-semibold text-primary-warm-white"
            >
              {{ board.name }}
            </span>
            <span
              class="flex items-center gap-2 text-sm whitespace-nowrap text-content-muted"
            >
              <span
                v-if="board.id === activeId"
                class="inline-flex items-center gap-1.5 rounded-xl border border-transparency-white-t20 px-2.5 py-0.5 text-xs font-bold tracking-wider text-primary-warm-white uppercase"
              >
                <span class="size-1.5 rounded-full bg-primary-comfy-yellow" />
                {{ t('darkroom.boards.inUse') }}
              </span>
              {{
                t(
                  'darkroom.boards.count',
                  { count: itemsOf(board).length },
                  itemsOf(board).length
                )
              }}
            </span>
          </span>
        </button>
      </div>
      <div v-else :class="emptyNote">
        <h3 :class="emptyTitle">{{ t('darkroom.boards.emptyTitle') }}</h3>
        {{ t('darkroom.boards.emptyBody') }}
      </div>
    </template>

    <template v-else>
      <div
        class="mt-2 mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4"
      >
        <div>
          <button
            type="button"
            class="mb-2 block cursor-pointer text-xs font-bold tracking-wider text-content-muted uppercase hover:text-primary-warm-white"
            @click="emit('show')"
          >
            ‹ {{ t('darkroom.boards.all') }}
          </button>
          <input
            ref="nameInput"
            :key="open.id"
            :value="open.name"
            maxlength="80"
            :aria-label="t('darkroom.boards.nameLabel')"
            :class="
              cn(
                heading,
                'w-xl max-w-[80vw] border-b border-transparent bg-transparent outline-none hover:border-transparency-white-t20 focus:border-transparency-white-t20'
              )
            "
            @change="renamed"
            @keydown.enter="nameInput?.blur()"
          />
          <p class="mt-1.5 text-base text-content-muted">
            {{
              t(
                'darkroom.boards.count',
                { count: openItems.length },
                openItems.length
              )
            }}
            <template v-if="using">
              · {{ t('darkroom.boards.following') }}</template
            >
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            :class="toolButton"
            :disabled="!openItems.length"
            @click="emit('use', using ? undefined : open.id)"
          >
            {{ using ? t('darkroom.boards.stop') : t('darkroom.boards.use') }}
          </button>
          <button type="button" :class="toolButton" @click="file?.click()">
            {{ t('darkroom.boards.add') }}
          </button>
          <button type="button" :class="quietButton" @click="confirmRemove">
            {{ t('darkroom.row.delete') }}
          </button>
        </div>
      </div>
      <div
        v-if="openItems.length"
        class="grid grid-cols-3 gap-1 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-1.5"
      >
        <div
          v-for="item in openItems"
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
            @click="emit('drop', open.id, item)"
          >
            ×
          </button>
        </div>
      </div>
      <div v-else :class="emptyNote">
        <h3 :class="emptyTitle">{{ t('darkroom.boards.boardEmptyTitle') }}</h3>
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
  </div>
</template>
