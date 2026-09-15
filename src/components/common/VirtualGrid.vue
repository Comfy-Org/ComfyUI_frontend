<template>
  <slot
    v-if="$slots.placeholder && !pagedItems(items).length && !canLoadMore"
    name="placeholder"
  />
  <div
    v-else
    ref="container"
    class="h-full scrollbar-thin scrollbar-thumb-(--dialog-surface) scrollbar-track-transparent scrollbar-gutter-stable overflow-y-auto [overflow-anchor:none]"
  >
    <div :style="topSpacerStyle" />
    <div :style="mergedGridStyle">
      <div
        v-for="(item, i) in renderedItems"
        :key="item.id"
        data-virtual-grid-item
      >
        <slot name="item" :item :index="state.start + i" />
      </div>
    </div>
    <div :style="bottomSpacerStyle" />
    <slot
      v-if="$slots.loading && isPaged(items) && toValue(items.isLoading)"
      name="loading"
    />
  </div>
</template>

<script setup lang="ts" generic="T extends { id: string }">
import {
  useElementSize,
  useInfiniteScroll,
  useScroll,
  whenever
} from '@vueuse/core'
import { clamp, debounce } from 'es-toolkit/compat'
import { computed, onBeforeUnmount, ref, toValue, watch } from 'vue'
import type { CSSProperties } from 'vue'

import { isPaged, pagedItems } from '@/utils/pagedList'
import type { MaybePaged } from '@/utils/pagedList'

type GridState = {
  start: number
  end: number
}

const {
  items,
  gridStyle,
  bufferRows = 1,
  resizeDebounce = 64,
  defaultItemHeight = 200,
  defaultItemWidth = 200,
  maxColumns = Infinity
} = defineProps<{
  items: MaybePaged<T>
  gridStyle: CSSProperties
  bufferRows?: number
  resizeDebounce?: number
  defaultItemHeight?: number
  defaultItemWidth?: number
  maxColumns?: number
}>()

const itemHeight = ref(defaultItemHeight)
const itemWidth = ref(defaultItemWidth)
const container = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(container)
const { y: scrollY } = useScroll(container, {
  eventListenerOptions: { passive: true }
})
const canLoadMore = computed(() => isPaged(items) && toValue(items.hasMore))

const cols = computed(() => {
  if (maxColumns !== Infinity) return maxColumns
  return Math.floor(width.value / itemWidth.value) || 1
})

const mergedGridStyle = computed<CSSProperties>(() => {
  if (maxColumns === Infinity) return gridStyle
  return {
    ...gridStyle,
    gridTemplateColumns: `repeat(${maxColumns}, minmax(0, 1fr))`
  }
})

const viewRows = computed(() => Math.ceil(height.value / itemHeight.value))
const maxOffsetRows = computed(() =>
  Math.max(0, Math.ceil(pagedItems(items).length / cols.value) - viewRows.value)
)
const offsetRows = computed(() =>
  clamp(Math.floor(scrollY.value / itemHeight.value), 0, maxOffsetRows.value)
)
const isValidGrid = computed(
  () => height.value && width.value && pagedItems(items).length
)

const state = computed<GridState>(() => {
  const fromRow = offsetRows.value - bufferRows
  const toRow = offsetRows.value + bufferRows + viewRows.value

  const fromCol = fromRow * cols.value
  const toCol = toRow * cols.value

  return {
    start: clamp(fromCol, 0, pagedItems(items).length),
    end: clamp(toCol, fromCol, pagedItems(items).length)
  }
})
const renderedItems = computed(() =>
  isValidGrid.value
    ? pagedItems(items).slice(state.value.start, state.value.end)
    : []
)

function rowsToHeight(itemsCount: number): string {
  const rows = Math.ceil(itemsCount / cols.value)
  return `${rows * itemHeight.value}px`
}
const topSpacerStyle = computed<CSSProperties>(() => ({
  height: rowsToHeight(state.value.start)
}))
const bottomSpacerStyle = computed<CSSProperties>(() => ({
  height: rowsToHeight(pagedItems(items).length - state.value.end)
}))

const distance = 2 * defaultItemHeight * (1 + bufferRows)
const infiniteScrollElement = computed(() =>
  isPaged(items) ? container.value : undefined
)
useInfiniteScroll(
  infiniteScrollElement,
  async () => {
    if (isPaged(items)) await items.loadMore()
  },
  { canLoadMore: () => canLoadMore.value, distance }
)

function updateItemSize(): void {
  if (container.value) {
    const firstItem = container.value.querySelector('[data-virtual-grid-item]')

    if (!firstItem?.clientHeight || !firstItem?.clientWidth) return

    if (itemHeight.value !== firstItem.clientHeight) {
      itemHeight.value = firstItem.clientHeight
    }
    if (itemWidth.value !== firstItem.clientWidth) {
      itemWidth.value = firstItem.clientWidth
    }
  }
}
const onResize = debounce(updateItemSize, resizeDebounce)
watch([width, height], onResize, { flush: 'post' })
watch(() => gridStyle, updateItemSize, { flush: 'post' })
whenever(() => items, updateItemSize, { flush: 'post' })
onBeforeUnmount(() => {
  onResize.cancel()
})
</script>
