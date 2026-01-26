<template>
  <div
    ref="container"
    class="h-full overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-(--dialog-surface)"
  >
    <div :style="topSpacerStyle" />
    <div :style="mergedGridStyle">
      <div
        v-for="item in renderedItems"
        :key="item.key"
        class="transition-[width] duration-150 ease-out"
        data-virtual-grid-item
      >
        <slot name="item" :item="item" />
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

const itemHeight = ref(defaultItemHeight)
const itemWidth = ref(defaultItemWidth)
const container = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(container)
const { y: scrollY } = useScroll(container, {
  throttle: scrollThrottle,
  eventListenerOptions: { passive: true }
})

const cols = computed(() =>
  Math.min(Math.floor(width.value / itemWidth.value) || 1, maxColumns)
)

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

function rowsToHeight(rows: number): string {
  return `${(rows / cols.value) * itemHeight.value}px`
}
const topSpacerStyle = computed<CSSProperties>(() => ({
  height: rowsToHeight(state.value.start)
}))
const bottomSpacerStyle = computed<CSSProperties>(() => ({
  height: rowsToHeight(items.length - state.value.end)
}))

whenever(
  () => state.value.isNearEnd,
  () => {
    emit('approach-end')
  }
)

const updateItemSize = () => {
  if (container.value) {
    const firstItem = container.value.querySelector('[data-virtual-grid-item]')

    // Don't update item size if the first item is not rendered yet
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
whenever(() => items, updateItemSize, { flush: 'post' })
onBeforeUnmount(() => {
  onResize.cancel()
})
</script>
