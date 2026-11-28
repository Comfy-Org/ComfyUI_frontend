<template>
  <div
    ref="container"
    class="h-full scrollbar-thin scrollbar-thumb-(--muted) scrollbar-track-transparent scrollbar-gutter-stable overflow-y-auto [overflow-anchor:none]"
  >
    <div :style="topSpacerStyle" />
    <div :style="mergedGridStyle">
      <div
        v-for="(item, i) in renderedItems"
        :key="item.key ?? item.id"
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
  useEventListener,
  useInfiniteScroll,
  useScroll,
  whenever
} from '@vueuse/core'
import { clamp, debounce } from 'es-toolkit/compat'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'

import { anchorAt, scrollTopFor } from './virtualGridAnchor'

type HasKeyOrId = { key: string; id?: string } | { key?: string; id: string }

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
  minItemWidth,
  maxItemWidth,
  onLoadMore,
  canLoadMore = false
} = defineProps<{
  items: readonly (T & HasKeyOrId)[]
  gridStyle: CSSProperties
  bufferRows?: number
  resizeDebounce?: number
  defaultItemHeight?: number
  defaultItemWidth?: number
  maxColumns?: number
  minItemWidth?: number
  maxItemWidth?: number
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
  if (maxColumns === Infinity) {
    return Math.floor(width.value / itemWidth.value) || 1
  }
  if (!minItemWidth) return maxColumns
  return clamp(Math.floor(width.value / minItemWidth), 1, maxColumns)
})

const mergedGridStyle = computed<CSSProperties>(() => {
  if (maxColumns === Infinity) return gridStyle
  return {
    ...gridStyle,
    gridTemplateColumns: `repeat(${cols.value}, minmax(0, ${maxItemWidth ? `${maxItemWidth}px` : '1fr'}))`
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

  const end = clamp(toCol, 0, total)
  let start = clamp(fromCol, 0, end)

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
let pointer: { clientX: number; clientY: number } | undefined
useEventListener(
  container,
  'pointermove',
  ({ clientX, clientY }: PointerEvent) => {
    pointer = { clientX, clientY }
  },
  { passive: true }
)
useEventListener(container, 'pointerleave', () => {
  pointer = undefined
})

function focusPoint(el: HTMLElement): { x: number; y: number } {
  if (!pointer) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  return { x: pointer.clientX - rect.left, y: pointer.clientY - rect.top }
}

watch([cols, () => maxItemWidth], async ([nextCols], [prevCols]) => {
  const el = container.value
  if (!el || !isValidGrid.value) return
  const anchor = anchorAt(focusPoint(el), {
    scrollTop: el.scrollTop,
    rowHeight: itemHeight.value,
    cols: prevCols,
    width: width.value
  })
  await nextTick()
  updateItemSize()
  el.scrollTop = scrollTopFor(anchor, nextCols, itemHeight.value)
})

const onResize = debounce(updateItemSize, resizeDebounce)
watch([width, height], onResize, { flush: 'post' })
watch(() => gridStyle, updateItemSize, { flush: 'post' })
whenever(() => items, updateItemSize, { flush: 'post' })
onBeforeUnmount(() => {
  onResize.cancel()
})
</script>
