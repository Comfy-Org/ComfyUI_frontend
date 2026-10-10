<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import type { DarkroomBoard } from '@/lib/darkroom/store'
import type { Locale } from '@/i18n/translations'

import DarkroomBoardList from './DarkroomBoardList.vue'
import DarkroomBoardView from './DarkroomBoardView.vue'

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

const emit = defineEmits<{
  show: [id?: string]
  create: []
  rename: [id: string, name: string]
  use: [id?: string]
  upload: [id: string, files: File[]]
  remove: [id: string]
  drop: [id: string, item: string]
}>()

const view = useTemplateRef<{ focusName: () => void }>('view')
const open = computed(() => boards.find((board) => board.id === openId))

function forOpen(action: (id: string) => void) {
  if (open.value) action(open.value.id)
}

defineExpose({ focusName: () => view.value?.focusName() })
</script>

<template>
  <div class="mx-auto w-full max-w-10xl px-4 pt-6 pb-28 sm:px-8 lg:px-14">
    <DarkroomBoardView
      v-if="open"
      ref="view"
      :board="open"
      :items="itemsOf(open)"
      :using="open.id === activeId"
      :urls
      :locale
      @back="emit('show')"
      @rename="(name) => forOpen((id) => emit('rename', id, name))"
      @use="(following) => emit('use', following ? openId : undefined)"
      @upload="(files) => forOpen((id) => emit('upload', id, files))"
      @remove="forOpen((id) => emit('remove', id))"
      @drop="(item) => forOpen((id) => emit('drop', id, item))"
    />
    <DarkroomBoardList
      v-else
      :boards
      :active-id="activeId"
      :urls
      :items-of="itemsOf"
      :locale
      @show="(id) => emit('show', id)"
      @create="emit('create')"
    />
  </div>
</template>
