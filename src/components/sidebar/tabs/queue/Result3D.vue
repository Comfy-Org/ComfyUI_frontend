<template>
  <div
    class="relative h-[85vh] w-full"
    @mouseenter="viewer.handleMouseEnter"
    @mouseleave="viewer.handleMouseLeave"
  >
    <div ref="containerRef" class="absolute inset-0" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useLoad3dViewer } from '@/composables/useLoad3dViewer'
import type { ResultItemImpl } from '@/stores/queueStore'

const { result } = defineProps<{
  result: ResultItemImpl
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const viewer = useLoad3dViewer()

const initializeViewer = async () => {
  if (!containerRef.value || !result.url) {
    return
  }

  await viewer.initializeStandaloneViewer(containerRef.value, result.url)
}

watch(
  () => result.url,
  async () => {
    viewer.cleanup()
    await initializeViewer()
  }
)

onMounted(async () => {
  await initializeViewer()
  window.addEventListener('resize', viewer.handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', viewer.handleResize)
  viewer.cleanup()
})
</script>
