<template>
  <div ref="container" class="scroll-container">
    <div :style="{ height: `${(state.start / cols) * itemHeight}px` }" />
    <div :style="gridStyle">
      <div v-for="item in renderedItems" :key="item.key" data-virtual-grid-item>
        <slot name="item" :item="item" />
      </div>
    </div>
    <div
      :style="{
        height: `${((items.length - state.end) / cols) * itemHeight}px`
      }"
    />
  </div>
</template>

<script setup lang="ts" generic="T">
import { useElementSize, useScroll, whenever } from '@vueuse/core'
import { clamp, debounce } from 'lodash'
import { type CSSProperties, computed, onBeforeUnmount, ref, watch } from 'vue'

type GridState = {
  start: number
  end: number
  isNearEnd: boolean
}

const {
  items,
  bufferRows = 1,
  scrollThrottle = 64,
  resizeDebounce = 64,
  defaultItemHeight = 200,
  defaultItemWidth = 200
} = defineProps<{
  items: (T & { key: string })[]
  gridStyle: Partial<CSSProperties>
  bufferRows?: number
  scrollThrottle?: number
  resizeDebounce?: number
  defaultItemHeight?: number
  defaultItemWidth?: number
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

const cols = computed(() => Math.floor(width.value / itemWidth.value) || 1)
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
whenever(() => items, updateItemSize)
onBeforeUnmount(() => {
  onResize.cancel() // Clear pending debounced calls
})
</script>

<style scoped>
.scroll-container {
  height: 100%;
  overflow-y: auto;

  /* Firefox */
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 1px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: transparent;
  }
}
</style>
