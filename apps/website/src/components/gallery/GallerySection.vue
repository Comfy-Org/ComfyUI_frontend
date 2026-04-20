<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import GalleryCard from './GalleryCard.vue'
import GalleryDetailModal from './GalleryDetailModal.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const modalOpen = ref(false)
const modalIndex = ref(0)

function openDetail(index: number) {
  modalIndex.value = index
  modalOpen.value = true
}

export interface GalleryItem {
  image: string
  title: string
  userAlias: string
  teamAlias: string
  tool: string
  href?: string
}

const items: GalleryItem[] = Array.from({ length: 12 }, () => ({
  image: '/images/gallery/gallery.webp',
  title: 'Image Title',
  userAlias: 'User Alias',
  teamAlias: 'Team Alias',
  tool: 'Tool',
  href: '#'
}))

/**
 * Desktop layout pattern (repeating):
 *  Row A: full-width                           (1 item)
 *  Row B: 2-col equal                          (2 items)
 *  Row C: 3-col equal                          (3 items)
 *  Row D: large-left + 2 stacked small-right   (3 items)
 *  Row E: 2 stacked small-left + large-right   (3 items)
 *  = 1 + 2 + 3 + 3 + 3 = 12 items per cycle
 */
type RowLayout = 'full' | 'col-2' | 'col-3' | 'large-left' | 'large-right'
const LAYOUT_PATTERN: RowLayout[] = [
  'full',
  'col-2',
  'col-3',
  'large-left',
  'large-right'
]
const ITEMS_PER_LAYOUT: Record<RowLayout, number> = {
  full: 1,
  'col-2': 2,
  'col-3': 3,
  'large-left': 3,
  'large-right': 3
}

interface Row {
  layout: RowLayout
  items: GalleryItem[]
  startIndex: number
}

const rows: Row[] = []
let idx = 0
let patternIdx = 0

while (idx < items.length) {
  const layout = LAYOUT_PATTERN[patternIdx % LAYOUT_PATTERN.length]
  const count = ITEMS_PER_LAYOUT[layout]
  const slice = items.slice(idx, idx + count)
  if (slice.length === 0) break
  rows.push({ layout, items: slice, startIndex: idx })
  idx += slice.length
  patternIdx++
}
</script>

<template>
  <section class="px-4 pb-20 lg:px-20">
    <!-- Desktop grid -->
    <div class="hidden flex-col gap-2 lg:flex">
      <template v-for="(row, rowIdx) in rows" :key="rowIdx">
        <!-- Symmetric rows: full / 2-col / 3-col -->
        <div
          v-if="
            row.layout === 'full' ||
            row.layout === 'col-2' ||
            row.layout === 'col-3'
          "
          class="grid grid-cols-6 gap-2"
        >
          <GalleryCard
            v-for="(item, i) in row.items"
            :key="i"
            :item="item"
            :locale="locale"
            :hero="row.layout === 'full'"
            :class="
              cn(
                row.layout === 'full' && 'col-span-6',
                row.layout === 'col-2' && 'col-span-3',
                row.layout === 'col-3' && 'col-span-2'
              )
            "
            @click="openDetail(row.startIndex + i)"
          />
        </div>

        <!-- Large left + 2 stacked right -->
        <div
          v-else-if="row.layout === 'large-left'"
          class="grid grid-cols-3 gap-2"
        >
          <GalleryCard
            :item="row.items[0]"
            :locale="locale"
            class="col-span-2 row-span-2"
            @click="openDetail(row.startIndex)"
          />
          <div class="col-span-1 flex flex-col gap-2">
            <GalleryCard
              :item="row.items[1]"
              :locale="locale"
              class="flex-1"
              @click="openDetail(row.startIndex + 1)"
            />
            <GalleryCard
              :item="row.items[2]"
              :locale="locale"
              class="flex-1"
              @click="openDetail(row.startIndex + 2)"
            />
          </div>
        </div>

        <!-- 2 stacked left + large right -->
        <div v-else class="grid grid-cols-3 gap-2">
          <div class="col-span-1 flex flex-col gap-2">
            <GalleryCard
              :item="row.items[0]"
              :locale="locale"
              class="flex-1"
              @click="openDetail(row.startIndex)"
            />
            <GalleryCard
              :item="row.items[1]"
              :locale="locale"
              class="flex-1"
              @click="openDetail(row.startIndex + 1)"
            />
          </div>
          <GalleryCard
            :item="row.items[2]"
            :locale="locale"
            class="col-span-2 row-span-2"
            @click="openDetail(row.startIndex + 2)"
          />
        </div>
      </template>
    </div>

    <!-- Mobile list -->
    <div class="flex flex-col gap-6 lg:hidden">
      <GalleryCard
        v-for="(item, i) in items"
        :key="i"
        :item="item"
        :locale="locale"
        mobile
        @click="openDetail(i)"
      />
    </div>

    <GalleryDetailModal
      v-if="modalOpen"
      :items="items"
      :initial-index="modalIndex"
      :locale="locale"
      @close="modalOpen = false"
    />
  </section>
</template>
