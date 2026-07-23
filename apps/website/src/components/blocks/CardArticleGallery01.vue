<script setup lang="ts">
import { ref } from 'vue'

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
  loadMoreLabel
} = defineProps<{
  title?: string
  titleAlign?: 'start' | 'center'
  items: CardArticleGalleryItem[]
  layout?: 'mixed' | 'two-column'
  titleClamp?: boolean
  tabs?: CardArticleGalleryTab[]
  allLabel?: string
  pageSize?: number
  loadMoreLabel?: string
}>()

const activeTab = ref(GALLERY_FILTER_ALL)

const { visibleItems, hasMore, showMore } = useFilteredGallery({
  items: () => items,
  filterKey: activeTab,
  pageSize
})
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <h2
      v-if="title && !tabs"
      class="text-primary-warm-white text-3xl font-light tracking-tight lg:text-5xl"
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
        class="text-primary-warm-white text-3xl font-light tracking-tight lg:text-5xl"
      >
        {{ title }}
      </h2>

      <div role="tablist" class="rounded-2xl border-2 border-white/20 p-2">
        <div class="flex gap-0.5 overflow-clip rounded-lg">
          <button
            v-for="tab in [
              { key: GALLERY_FILTER_ALL, label: allLabel ?? 'ALL' },
              ...tabs
            ]"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.key"
            class="h-8 px-4 text-xs font-semibold whitespace-nowrap transition-colors"
            :class="
              activeTab === tab.key
                ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                : 'bg-white/8 text-white hover:bg-white/15'
            "
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </div>

    <div
      class="mt-10 grid grid-cols-1 gap-6 lg:mt-12"
      :class="layout === 'mixed' ? 'md:grid-cols-6' : 'md:grid-cols-2'"
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
