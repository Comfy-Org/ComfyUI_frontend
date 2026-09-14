<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import CardArticle01 from './CardArticle01.vue'
import type { CardArticleItem } from './CardArticle01.vue'
import {
  GALLERY_FILTER_ALL,
  useFilteredGallery
} from '../../composables/useFilteredGallery'

export type CardArticleGalleryItem = CardArticleItem & {
  filterKey?: string
}

type CardArticleGalleryTab = {
  key: string
  label: string
}

const {
  title,
  titleAlign = 'start',
  items,
  layout = 'mixed',
  titleClamp = false,
  tabs,
  allLabel,
  pageSize,
  loadMoreLabel,
  class: className
} = defineProps<{
  title?: string
  titleAlign?: 'start' | 'center'
  items: CardArticleGalleryItem[]
  layout?: 'mixed' | 'two-column' | 'three-column'
  titleClamp?: boolean
  tabs?: CardArticleGalleryTab[]
  allLabel?: string
  pageSize?: number
  loadMoreLabel?: string
  class?: HTMLAttributes['class']
}>()

const activeTab = ref(GALLERY_FILTER_ALL)

const { visibleItems, hasMore, showMore } = useFilteredGallery({
  items: () => items,
  filterKey: activeTab,
  pageSize
})

// Shown inside each tab pill; counts the whole item set, not the paged slice.
const tabCount = (key: string) =>
  key === GALLERY_FILTER_ALL
    ? items.length
    : items.filter((item) => item.filterKey === key).length
</script>

<template>
  <section :class="cn('max-w-9xl mx-auto px-6 py-16 lg:py-24', className)">
    <h2
      v-if="title && !tabs"
      class="text-3xl font-light tracking-tight text-primary-warm-white lg:text-5xl"
      :class="titleAlign === 'center' ? 'text-center' : undefined"
    >
      {{ title }}
    </h2>

    <div
      v-if="tabs"
      class="flex flex-col gap-8"
      :class="
        titleAlign === 'center' ? 'items-center text-center' : 'items-start'
      "
    >
      <h2
        v-if="title"
        class="text-3xl font-light tracking-tight text-primary-warm-white lg:text-5xl"
      >
        {{ title }}
      </h2>

      <!-- Free-floating pills with per-tab counts; wrapping keeps them
      inside the card column on phones. -->
      <div class="flex flex-wrap justify-center gap-2">
        <button
          v-for="tab in [
            { key: GALLERY_FILTER_ALL, label: allLabel ?? 'ALL' },
            ...tabs
          ]"
          :key="tab.key"
          type="button"
          :aria-pressed="activeTab === tab.key"
          class="h-8 rounded-full px-4 text-xs font-semibold tracking-wide whitespace-nowrap uppercase transition-colors"
          :class="
            activeTab === tab.key
              ? 'bg-white/20 text-white'
              : 'bg-white/8 text-primary-comfy-canvas/80 hover:bg-white/15 hover:text-white'
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span
            class="ml-2 hidden font-normal text-primary-comfy-canvas/50 tabular-nums sm:inline"
          >
            {{ tabCount(tab.key) }}
          </span>
        </button>
      </div>
    </div>

    <div
      class="mt-10 grid grid-cols-1 gap-6 lg:mt-12"
      :class="
        layout === 'mixed'
          ? 'md:grid-cols-6'
          : layout === 'three-column'
            ? 'md:grid-cols-3'
            : 'md:grid-cols-2'
      "
    >
      <div
        v-for="(item, index) in visibleItems"
        :key="item.id"
        :class="
          layout === 'mixed'
            ? index < 4
              ? 'md:col-span-3'
              : 'md:col-span-2'
            : undefined
        "
      >
        <CardArticle01 :item :title-clamp="titleClamp" />
      </div>
    </div>

    <div v-if="hasMore && loadMoreLabel" class="mt-10 flex justify-center">
      <button
        type="button"
        class="border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow h-12 rounded-2xl border-2 px-5 text-sm font-bold tracking-wider uppercase transition-colors hover:text-primary-comfy-ink focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        @click="showMore()"
      >
        {{ loadMoreLabel }}
      </button>
    </div>
  </section>
</template>
