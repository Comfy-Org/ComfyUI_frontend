<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import type { GalleryItem } from '../../data/gallery'
import type { Locale } from '../../i18n/translations'
import GalleryCard from './GalleryCard.vue'
import GalleryDetailModal from './GalleryDetailModal.vue'

const { items, locale = 'en' } = defineProps<{
  items: GalleryItem[]
  locale?: Locale
}>()

const modalOpen = ref(false)
const modalIndex = ref(0)

function openDetail(index: number) {
  modalIndex.value = index
  modalOpen.value = true
}

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

function buildRows(galleryItems: GalleryItem[]): Row[] {
  const result: Row[] = []
  let idx = 0
  let patternIdx = 0

  while (idx < galleryItems.length) {
    const layout = LAYOUT_PATTERN[patternIdx % LAYOUT_PATTERN.length]
    const count = ITEMS_PER_LAYOUT[layout]
    const slice = galleryItems.slice(idx, idx + count)
    result.push({ layout, items: slice, startIndex: idx })
    idx += slice.length
    patternIdx++
  }

  return result
}

const rows = computed(() => buildRows(items))
</script>

<template>
  <section
    data-testid="gallery-grid"
    class="max-w-9xl mx-auto px-4 pb-20 lg:px-20"
  >
    <!-- Desktop grid -->
    <div
      class="rounded-5xl bg-transparency-white-t4 hidden flex-col gap-2 p-2 lg:flex"
    >
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
            :key="item.id"
            :item="item"
            :locale="locale"
            :aspect="row.layout === 'full' ? '16/9' : undefined"
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
          class="grid grid-cols-2 gap-2"
        >
          <GalleryCard
            :item="row.items[0]"
            :locale="locale"
            aspect="3/4"
            class="row-span-2"
            @click="openDetail(row.startIndex)"
          />
          <div class="flex flex-col gap-2">
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
        <div v-else class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-2">
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
            aspect="3/4"
            class="row-span-2"
            @click="openDetail(row.startIndex + 2)"
          />
        </div>
      </template>
    </div>

    <!-- Mobile list -->
    <div
      class="rounded-5xl bg-transparency-white-t4 flex flex-col gap-6 p-2 lg:hidden"
    >
      <GalleryCard
        v-for="(item, i) in items"
        :key="item.id"
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
