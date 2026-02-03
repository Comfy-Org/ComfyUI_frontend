<template>
  <div
    ref="container"
    class="h-full overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-(--dialog-surface)"
  >
    <div :style="topSpacerStyle" />
    <div :style="mergedGridStyle">
      <div
        v-for="(item, i) in renderedItems"
        :key="item.key"
        class="transition-[width] duration-150 ease-out"
        data-virtual-grid-item
      >
        <slot name="item" :item :index="state.start + i" />
      </div>
    </div>
    <div :style="bottomSpacerStyle" />
  </div>
</template>

<script setup lang="ts" generic="T">
import { useElementSize, useScroll, whenever } from '@vueuse/core'
import { clamp, debounce } from 'es-toolkit/compat'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'

type GridState = {
  start: number
  end: number
  isNearEnd: boolean
}

const {
  items,
  gridStyle,
  bufferRows = 1,
  scrollThrottle = 64,
  resizeDebounce = 64,
  defaultItemHeight = 200,
  defaultItemWidth = 200,
  maxColumns = Infinity
} = defineProps<{
  items: (T & { key: string })[]
  gridStyle: CSSProperties
  bufferRows?: number
  scrollThrottle?: number
  resizeDebounce?: number
  defaultItemHeight?: number
  defaultItemWidth?: number
  maxColumns?: number
}>()

const emit = defineEmits<{
  /**
   * Emitted when `bufferRows` (or fewer) rows remaining between scrollY and grid bottom.
   */
  'approach-end': []
}>()

const rowHeight = ref(defaultItemHeight)
const colWidth = ref(defaultItemWidth)
const container = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(container)
const { y: scrollY } = useScroll(container, {
  throttle: scrollThrottle,
  eventListenerOptions: { passive: true }
})

const cols = computed(() =>
  Math.min(Math.floor(width.value / colWidth.value) || 1, maxColumns)
)

const mergedGridStyle = computed<CSSProperties>(() => {
  if (maxColumns === Infinity) return gridStyle
  return {
    ...gridStyle,
    gridTemplateColumns: `repeat(${maxColumns}, minmax(0, 1fr))`
  }
})

const viewRows = computed(() => Math.ceil(height.value / rowHeight.value))
const offsetRows = computed(() => Math.floor(scrollY.value / rowHeight.value))
const isValidGrid = computed(() => height.value && width.value && items?.length)

const state = computed<GridState>(() => {
  const fromRow = offsetRows.value - bufferRows
  const toRow = offsetRows.value + bufferRows + viewRows.value

  const fromCol = fromRow * cols.value
  const toCol = toRow * cols.value
  const remainingCol = items.length - toCol
  const hasMoreToRender = remainingCol >= 0

  return {
    start: clamp(fromCol, 0, items?.length),
    end: clamp(toCol, fromCol, items?.length),
    isNearEnd: hasMoreToRender && remainingCol <= cols.value * bufferRows
  }
})
const renderedItems = computed(() =>
  isValidGrid.value ? items.slice(state.value.start, state.value.end) : []
)

function spacerRowsToHeight(rows: number): string {
  return `${rows * rowHeight.value}px`
}

const topSpacerRows = computed(() => {
  if (!isValidGrid.value) return 0
  return Math.floor(state.value.start / cols.value)
})

const bottomSpacerRows = computed(() => {
  if (!isValidGrid.value) return 0

  const totalRows = Math.ceil(items.length / cols.value)
  const renderedEndRow = Math.ceil(state.value.end / cols.value)
  return Math.max(0, totalRows - renderedEndRow)
})

const topSpacerStyle = computed<CSSProperties>(() => ({
  height: spacerRowsToHeight(topSpacerRows.value)
}))
const bottomSpacerStyle = computed<CSSProperties>(() => ({
  height: spacerRowsToHeight(bottomSpacerRows.value)
}))

whenever(
  () => state.value.isNearEnd,
  () => {
    emit('approach-end')
  }
)

const ITEM_SIZE_EPSILON_PX = 1

/**
 * Measures the effective grid row/column step (including `gap`) from rendered
 * items to keep spacer math stable and prevent scroll jitter near the end.
 */
function updateItemSize(): void {
  if (!container.value) return

  const itemElements = Array.from(
    container.value.querySelectorAll('[data-virtual-grid-item]')
  ).filter((node): node is HTMLElement => node instanceof HTMLElement)

  const firstItem = itemElements[0]

  if (!firstItem?.clientHeight || !firstItem?.clientWidth) return

  const nextRowItem = itemElements.find(
    (item) => item.offsetTop > firstItem.offsetTop
  )

  const measuredRowHeight = nextRowItem
    ? nextRowItem.offsetTop - firstItem.offsetTop
    : firstItem.clientHeight

  const nextColItem = itemElements.find(
    (item) =>
      item.offsetTop === firstItem.offsetTop &&
      item.offsetLeft > firstItem.offsetLeft
  )

  const measuredColWidth = nextColItem
    ? nextColItem.offsetLeft - firstItem.offsetLeft
    : firstItem.clientWidth

  if (
    measuredRowHeight > 0 &&
    Math.abs(rowHeight.value - measuredRowHeight) >= ITEM_SIZE_EPSILON_PX
  ) {
    rowHeight.value = measuredRowHeight
  }

  if (
    measuredColWidth > 0 &&
    Math.abs(colWidth.value - measuredColWidth) >= ITEM_SIZE_EPSILON_PX
  ) {
    colWidth.value = measuredColWidth
  }
}
const onResize = debounce(updateItemSize, resizeDebounce)
watch([width, height], onResize, { flush: 'post' })
whenever(() => items, updateItemSize, { flush: 'post' })

onBeforeUnmount(() => {
  onResize.cancel()
})
</script>
