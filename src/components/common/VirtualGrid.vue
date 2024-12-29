<template>
  <div ref="container" class="virtual-grid-scroll-container">
    <div :style="{ height: `${(visibleRange.start / cols) * itemSize}px` }" />
    <div :style="gridStyle">
      <div v-for="item in visibleItems" :key="item.key" data-virtual-grid-item>
        <slot name="item" :item="item" />
      </div>
    </div>
    <div
      :style="{
        height: `${((props.items.length - visibleRange.end) / cols) * itemSize}px`
      }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue'
import { useElementSize, useScroll } from '@vueuse/core'
import { clamp, debounce } from 'lodash'

type GridItem<T = any> = T & { key: string }

const props = defineProps<{
  items: GridItem[]
  gridStyle: Partial<CSSProperties>
  buffer?: number
  defaultItemSize?: number
}>()
const { buffer = 1, defaultItemSize = 200 } = props

const itemSize = ref(defaultItemSize)
const container = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(container)
const { y: scrollY } = useScroll(container, {
  throttle: 64,
  eventListenerOptions: { passive: true }
})

const cols = computed(() => Math.floor(width.value / itemSize.value) || 1)
const visibleRows = computed(() => Math.ceil(height.value / itemSize.value))
const offset = computed(() => Math.floor(scrollY.value / itemSize.value))
const isValidGrid = computed(
  () => height.value && width.value && props.items?.length
)

const visibleRange = computed<{ start: number; end: number }>(() => {
  const fromRow = offset.value - buffer
  const toRow = offset.value + buffer + visibleRows.value

  const fromCol = fromRow * cols.value
  const toCol = toRow * cols.value

  return {
    start: clamp(fromCol, 0, props.items.length),
    end: clamp(toCol, fromCol, props.items.length)
  }
})

const visibleItems = computed<GridItem[]>(() =>
  isValidGrid.value
    ? props.items.slice(visibleRange.value.start, visibleRange.value.end)
    : []
)

const updateItemSize = () => {
  if (container.value) {
    const firstItem = container.value.querySelector('[data-virtual-grid-item]')
    itemSize.value = firstItem?.clientHeight || defaultItemSize
  }
}

const onResize = debounce(updateItemSize, 64, { leading: true, trailing: true })
watch([width, height], onResize, { flush: 'post' })
</script>

<style scoped>
.virtual-grid-scroll-container {
  height: 100%;
  overflow-y: auto;
  /* Firefox */
  scrollbar-width: none;
}

.virtual-grid-scroll-container::-webkit-scrollbar {
  width: 1px;
}

.virtual-grid-scroll-container::-webkit-scrollbar-thumb {
  background-color: transparent;
}
</style>
