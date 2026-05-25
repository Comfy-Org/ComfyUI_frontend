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
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useElementSize, whenever } from '@vueuse/core'
import { debounce } from 'es-toolkit/compat'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'

const {
  items,
  gridStyle,
  bufferRows = 1,
  resizeDebounce = 64,
  defaultItemHeight = 200,
  defaultItemWidth = 200,
  maxColumns = Infinity
} = defineProps<{
  items: (T & { key: string })[]
  gridStyle: CSSProperties
  bufferRows?: number
  resizeDebounce?: number
  defaultItemHeight?: number
  defaultItemWidth?: number
  maxColumns?: number
}>()

const emit = defineEmits<{
  /**
   * Edge-triggered when the rendered window reaches within `bufferRows`
   * rows of the grid's last item.
   */
  'approach-end': []
}>()

const itemHeight = ref(defaultItemHeight)
const itemWidth = ref(defaultItemWidth)
const container = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(container)

// Suppress range computation while the container is unmounted/zero-sized.
// Without this, cols collapses to 1 during the brief width=0 mount window,
// which makes a small list look near-end and emits a spurious approach-end
// that double-loads paginated consumers (ManagerDialog).
const isValidGrid = computed(
  () => width.value > 0 && height.value > 0 && items.length > 0
)

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

const rowCount = computed(() => Math.ceil(items.length / cols.value))

const virtualizer = useVirtualizer({
  get count() {
    return rowCount.value
  },
  estimateSize: () => itemHeight.value,
  getScrollElement: () => container.value,
  overscan: bufferRows
})

const virtualRows = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())

type GridState = {
  start: number
  end: number
  isNearEnd: boolean
}

const state = computed<GridState>(() => {
  const rows = virtualRows.value
  if (!isValidGrid.value || rows.length === 0) {
    return { start: 0, end: 0, isNearEnd: false }
  }
  const firstRow = rows[0]
  const lastRow = rows[rows.length - 1]
  const start = firstRow.index * cols.value
  const end = Math.min(items.length, (lastRow.index + 1) * cols.value)

  const toCol = (lastRow.index + 1) * cols.value
  const remainingCol = items.length - toCol
  const hasMoreToRender = remainingCol >= 0
  const isNearEnd = hasMoreToRender && remainingCol <= cols.value * bufferRows

  return { start, end, isNearEnd }
})

const renderedItems = computed(() =>
  isValidGrid.value ? items.slice(state.value.start, state.value.end) : []
)

const topSpacerStyle = computed<CSSProperties>(() => ({
  height: `${virtualRows.value[0]?.start ?? 0}px`
}))
const bottomSpacerStyle = computed<CSSProperties>(() => {
  const rows = virtualRows.value
  if (rows.length === 0) return { height: '0px' }
  const lastEnd = rows[rows.length - 1].end
  return { height: `${Math.max(0, totalSize.value - lastEnd)}px` }
})

whenever(
  () => state.value.isNearEnd,
  () => {
    emit('approach-end')
  }
)

function updateItemSize(): void {
  if (!container.value) return
  const firstItem = container.value.querySelector('[data-virtual-grid-item]')
  if (!firstItem?.clientHeight || !firstItem?.clientWidth) return
  if (itemHeight.value !== firstItem.clientHeight) {
    itemHeight.value = firstItem.clientHeight
  }
  if (itemWidth.value !== firstItem.clientWidth) {
    itemWidth.value = firstItem.clientWidth
  }
}
const onResize = debounce(updateItemSize, resizeDebounce)

watch(width, onResize, { flush: 'post' })
whenever(() => items, updateItemSize, { flush: 'post' })
watch(itemHeight, () => {
  virtualizer.value.measure()
})

onBeforeUnmount(() => {
  onResize.cancel()
})
</script>
