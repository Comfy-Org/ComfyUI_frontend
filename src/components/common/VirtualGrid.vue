<template>
  <div
    ref="container"
    class="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-(--dialog-surface) h-full overflow-y-auto [overflow-anchor:none] [scrollbar-gutter:stable]"
  >
    <div :style="totalSizeStyle">
      <div
        v-for="virtualRow in virtualRows"
        :key="virtualRow.index"
        :style="rowStyle(virtualRow)"
      >
        <div :style="mergedGridStyle">
          <div
            v-for="(item, i) in itemsForRow(virtualRow.index)"
            :key="item.key"
            data-virtual-grid-item
          >
            <slot name="item" :item :index="virtualRow.index * cols + i" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import type { VirtualItem } from '@tanstack/vue-virtual'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useElementSize } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'

const {
  items,
  gridStyle,
  bufferRows = 1,
  defaultItemHeight = 200,
  defaultItemWidth = 200,
  maxColumns = Infinity
} = defineProps<{
  items: (T & { key: string })[]
  gridStyle: CSSProperties
  bufferRows?: number
  defaultItemHeight?: number
  defaultItemWidth?: number
  maxColumns?: number
}>()

const emit = defineEmits<{
  /**
   * Emitted when `bufferRows` (or fewer) rows remain between the last
   * rendered row and the end of the list.
   */
  'approach-end': []
}>()

const container = ref<HTMLElement | null>(null)
const { width } = useElementSize(container)

const cols = computed(() => {
  if (maxColumns !== Infinity) return maxColumns
  return Math.floor(width.value / defaultItemWidth) || 1
})

const rowCount = computed(() => Math.ceil(items.length / cols.value))

const virtualizer = useVirtualizer({
  get count() {
    return rowCount.value
  },
  estimateSize: () => defaultItemHeight,
  getScrollElement: () => container.value,
  overscan: bufferRows
})

const virtualRows = computed(() => virtualizer.value.getVirtualItems())

const totalSizeStyle = computed<CSSProperties>(() => ({
  position: 'relative',
  width: '100%',
  height: `${virtualizer.value.getTotalSize()}px`
}))

const mergedGridStyle = computed<CSSProperties>(() => {
  if (maxColumns === Infinity) return gridStyle
  return {
    ...gridStyle,
    gridTemplateColumns: `repeat(${maxColumns}, minmax(0, 1fr))`
  }
})

function rowStyle(virtualRow: VirtualItem): CSSProperties {
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    transform: `translateY(${virtualRow.start}px)`
  }
}

function itemsForRow(rowIndex: number) {
  const start = rowIndex * cols.value
  return items.slice(start, start + cols.value)
}

watch(
  virtualRows,
  (rows) => {
    const last = rows.at(-1)
    if (!last) return
    if (last.index >= rowCount.value - bufferRows - 1) {
      emit('approach-end')
    }
  },
  { flush: 'post' }
)
</script>
