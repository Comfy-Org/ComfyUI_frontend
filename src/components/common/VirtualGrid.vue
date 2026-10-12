<template>
  <div
    ref="container"
    class="h-full scrollbar-thin scrollbar-thumb-(--dialog-surface) scrollbar-track-transparent scrollbar-gutter-stable overflow-y-auto [overflow-anchor:none]"
  >
    <div :style="topSpacerStyle" />
    <div :style="mergedGridStyle">
      <div
        v-for="(item, i) in renderedItems"
        :key="item.key"
        data-virtual-grid-item
      >
        <slot name="item" :item :index="state.start + i" />
      </div>
    </div>
    <div :style="bottomSpacerStyle" />
  </div>
</template>

<script setup lang="ts" generic="T">
import {
  useElementSize,
  useInfiniteScroll,
  useScroll,
  whenever
} from '@vueuse/core'
import { clamp, debounce } from 'es-toolkit/compat'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'

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
  maxColumns = Infinity,
  onLoadMore,
  canLoadMore = false
} = defineProps<{
  items: (T & { key: string })[]
  gridStyle: CSSProperties
  bufferRows?: number
  resizeDebounce?: number
  defaultItemHeight?: number
  defaultItemWidth?: number
  maxColumns?: number
  onLoadMore?: () => unknown
  canLoadMore?: boolean
}>()

const itemHeight = ref(defaultItemHeight)
const itemWidth = ref(defaultItemWidth)
const container = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(container)
const { y: scrollY } = useScroll(container, {
  eventListenerOptions: { passive: true }
})

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
const offsetRows = computed(() => Math.floor(scrollY.value / itemHeight.value))
const isValidGrid = computed(() => height.value && width.value && items?.length)

const state = computed<GridState>(() => {
  const fromRow = offsetRows.value - bufferRows
  const toRow = offsetRows.value + bufferRows + viewRows.value

  const fromCol = fromRow * cols.value
  const toCol = toRow * cols.value

  const total = items?.length ?? 0
  const windowSize = Math.max(toCol - fromCol, 0)

  // Clamp `end` to the current item count first, then clamp `start` against
  // that already-valid bound (not the raw `fromCol`). This guarantees
  // 0 <= start <= end <= total even when `fromCol`/`toCol` point past a list
  // that just shrunk (filter change) or a column count that just grew
  // (resize/zoom) while scrolled deep into the grid. es-toolkit's
  // clamp(value, min, max) produces nonsensical results when min > max,
  // which is exactly what happens if `start` is clamped against the
  // unclamped `fromCol` in those cases.
  const end = clamp(toCol, 0, total)
  let start = clamp(fromCol, 0, end)

  // If the scroll position still points entirely past the available items
  // (the window collapsed to empty), shift it left to show the trailing
  // items instead of leaving the view blank. A real browser would normally
  // clamp the scroll position itself once the spacer heights shrink, but a
  // stale/negative spacer height can get rejected by the CSSOM and prevent
  // that from ever happening, so we clamp the window directly here.
  if (start === end && total > 0) {
    start = Math.max(0, end - windowSize)
  }

  return { start, end }
})
const renderedItems = computed(() =>
  isValidGrid.value ? items.slice(state.value.start, state.value.end) : []
)

function rowsToHeight(itemsCount: number): string {
  const rows = Math.ceil(itemsCount / cols.value)
  return `${rows * itemHeight.value}px`
}
const topSpacerStyle = computed<CSSProperties>(() => ({
  height: rowsToHeight(state.value.start)
}))
const bottomSpacerStyle = computed<CSSProperties>(() => ({
  height: rowsToHeight(items.length - state.value.end)
}))

const distance = 2 * defaultItemHeight * (1 + bufferRows)
useInfiniteScroll(
  container,
  async () => {
    await onLoadMore?.()
  },
  { canLoadMore: () => canLoadMore, distance }
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
