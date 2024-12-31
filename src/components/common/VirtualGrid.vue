<template>
  <div ref="container" class="scroll-container">
    <div :style="{ height: `${(state.start / cols) * itemSize}px` }" />
    <div :style="gridStyle">
      <div v-for="item in renderedItems" :key="item.key" data-virtual-grid-item>
        <slot name="item" :item="item"> </slot>
      </div>
    </div>
    <div
      :style="{
        height: `${((props.items.length - state.end) / cols) * itemSize}px`
      }"
    />
  </div>
</template>

<script setup lang="ts" generic="T">
import { useElementSize, useScroll } from '@vueuse/core'
import { clamp, debounce } from 'lodash'
import { type CSSProperties, computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  items: (T & { key: string })[]
  gridStyle: Partial<CSSProperties>
  bufferRows?: number
  scrollThrottle?: number
  resizeDebounce?: number
  defaultItemSize?: number
}>()
const {
  bufferRows = 1,
  scrollThrottle = 64,
  resizeDebounce = 64,
  defaultItemSize = 200
} = props

const itemSize = ref(defaultItemSize)
const container = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(container)
const { y: scrollY } = useScroll(container, {
  throttle: scrollThrottle,
  eventListenerOptions: { passive: true }
})

const cols = computed(() => Math.floor(width.value / itemSize.value) || 1)
const viewRows = computed(() => Math.ceil(height.value / itemSize.value))
const offsetRows = computed(() => Math.floor(scrollY.value / itemSize.value))
const isValidGrid = computed(
  () => height.value && width.value && props.items?.length
)

const state = computed<{ start: number; end: number }>(() => {
  const fromRow = offsetRows.value - bufferRows
  const toRow = offsetRows.value + bufferRows + viewRows.value

  const fromCol = fromRow * cols.value
  const toCol = toRow * cols.value

  return {
    start: clamp(fromCol, 0, props.items?.length),
    end: clamp(toCol, fromCol, props.items?.length)
  }
})
const renderedItems = computed(() =>
  isValidGrid.value ? props.items.slice(state.value.start, state.value.end) : []
)

const updateItemSize = () => {
  if (container.value) {
    const firstItem = container.value.querySelector('[data-virtual-grid-item]')
    itemSize.value = firstItem?.clientHeight || defaultItemSize
  }
}
const onResize = debounce(updateItemSize, resizeDebounce)
watch([width, height], onResize, { flush: 'post' })
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
