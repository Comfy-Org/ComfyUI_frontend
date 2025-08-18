<template>
  <div ref="container" class="scroll-container">
    <div :style="{ height: `${state.start * itemSize}px` }"></div>
    <div :style="contentStyle">
      <div
        v-for="item in renderedItems"
        :key="item.key"
        :style="{ height: `${itemSize}px` }"
        data-virtual-item
      >
        <slot name="item" :item="item"></slot>
      </div>
    </div>
    <div
      :style="{ height: `${(items.length - state.end) * itemSize}px` }"
    ></div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { useElementSize, useScroll } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import { type CSSProperties, computed, ref } from 'vue'

type Item = T & { key: string }

const props = defineProps<{
  items: Item[]
  itemSize: number
  contentStyle?: Partial<CSSProperties>
  scrollThrottle?: number
}>()

const { scrollThrottle = 64 } = props

const container = ref<HTMLElement | null>(null)
const { height } = useElementSize(container)
const { y: scrollY } = useScroll(container, {
  throttle: scrollThrottle,
  eventListenerOptions: { passive: true }
})

const viewRows = computed(() => Math.ceil(height.value / props.itemSize))
const offsetRows = computed(() => Math.floor(scrollY.value / props.itemSize))

const state = computed(() => {
  const bufferRows = viewRows.value

  const fromRow = offsetRows.value - bufferRows
  const toRow = offsetRows.value + bufferRows + viewRows.value

  return {
    start: clamp(fromRow, 0, props.items.length),
    end: clamp(toRow, fromRow, props.items.length)
  }
})

const renderedItems = computed(() => {
  return props.items.slice(state.value.start, state.value.end)
})

const reset = () => {}

defineExpose({
  reset
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
