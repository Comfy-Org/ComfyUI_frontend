<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DarkroomSlot } from '@/lib/darkroom/feed'
import { shapeRatio } from '@/lib/darkroom/vocabulary'
import type { Locale } from '@/i18n/translations'

import DarkroomTileDone from './DarkroomTileDone.vue'
import DarkroomTileFailed from './DarkroomTileFailed.vue'
import DarkroomTilePending from './DarkroomTilePending.vue'

const {
  tile,
  shape,
  url,
  retryable,
  locale = 'en'
} = defineProps<{
  tile: DarkroomSlot
  /** The shape asked for, which reserves the tile's space until it loads. */
  shape: string
  url?: string
  retryable: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  open: []
  cancel: []
  retry: []
  star: []
  edit: []
  vary: []
  board: [anchor: HTMLElement]
  tall: [tall: boolean]
}>()

const naturalRatio = ref<number>()
const ratio = computed(() => naturalRatio.value ?? shapeRatio(shape))

function measured(natural: number, tall: boolean) {
  naturalRatio.value = natural
  emit('tall', tall)
}

const STATE_CLASS = {
  pending: '',
  done: 'cursor-zoom-in',
  error: 'flex flex-col items-start justify-center gap-2 overflow-auto p-5'
} as const

function open() {
  if (tile.status === 'done') emit('open')
}
</script>

<template>
  <div
    :class="
      cn(
        'group/tile relative overflow-hidden rounded-xl bg-site-bg-soft',
        STATE_CLASS[tile.status]
      )
    "
    :style="{ aspectRatio: String(ratio) }"
    :data-testid="`darkroom-tile-${tile.status}`"
    @click="open"
  >
    <DarkroomTilePending
      v-if="tile.status === 'pending'"
      :tile
      :shape
      :locale
      @cancel="emit('cancel')"
    />
    <DarkroomTileDone
      v-else-if="tile.status === 'done'"
      :tile
      :url
      :locale
      @star="emit('star')"
      @edit="emit('edit')"
      @vary="emit('vary')"
      @board="(anchor) => emit('board', anchor)"
      @ratio="measured"
    />
    <DarkroomTileFailed
      v-else
      :tile
      :retryable
      :locale
      @retry="emit('retry')"
    />
  </div>
</template>
