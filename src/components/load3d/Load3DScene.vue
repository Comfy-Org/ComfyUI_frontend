<template>
  <div
    ref="container"
    class="relative h-full w-full min-h-0 overflow-hidden"
    data-capture-wheel="true"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
    @mousedown.stop
    @mousemove.stop
    @mouseup.stop
    @contextmenu.stop.prevent
    @dragover.prevent.stop="handleDragOver"
    @dragleave.stop="handleDragLeave"
    @drop.prevent.stop="handleDrop"
  >
    <LoadingOverlay :loading="loading" :loading-message="loadingMessage" />
    <div
      v-if="!isPreview && isDragging"
      class="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div
        class="rounded-lg border-2 border-dashed border-blue-400 bg-blue-500/20 px-6 py-4 text-lg font-medium text-blue-100"
      >
        {{ dragMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import LoadingOverlay from '@/components/load3d/LoadingOverlay.vue'
import { useLoad3dDrag } from '@/composables/useLoad3dDrag'

const props = defineProps<{
  initializeLoad3d: (containerRef: HTMLElement) => Promise<void>
  cleanup: () => void
  loading: boolean
  loadingMessage: string
  onModelDrop?: (file: File) => void | Promise<void>
  isPreview: boolean
}>()

const container = ref<HTMLElement | null>(null)

const { isDragging, dragMessage, handleDragOver, handleDragLeave, handleDrop } =
  useLoad3dDrag({
    onModelDrop: async (file) => {
      if (props.onModelDrop) {
        await props.onModelDrop(file)
      }
    },
    disabled: computed(() => props.isPreview)
  })

onMounted(() => {
  if (container.value) {
    void props.initializeLoad3d(container.value)
  }
})

onUnmounted(() => {
  props.cleanup()
})
</script>

<style scoped>
:deep(canvas) {
  position: absolute !important;
  top: 0;
  left: 0;
  width: 100% !important;
  height: 100% !important;
  display: block !important;
  outline: none;
}
</style>
