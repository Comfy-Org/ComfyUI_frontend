<template>
  <div
    v-if="visible"
    ref="containerRef"
    class="litegraph-minimap absolute bottom-[20px] right-[90px] z-[1000]"
    :style="containerStyles"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
    @wheel="handleWheel"
  >
    <canvas
      ref="canvasRef"
      :width="width"
      :height="height"
      class="minimap-canvas"
    />
    <div class="minimap-viewport" :style="viewportStyles" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

import { useMinimap } from '@/composables/useMinimap'
import { useCanvasStore } from '@/stores/graphStore'

const minimap = useMinimap()
const canvasStore = useCanvasStore()

const {
  initialized,
  visible,
  containerRef,
  canvasRef,
  containerStyles,
  viewportStyles,
  width,
  height,
  init,
  destroy,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleWheel
} = minimap

watch(
  () => canvasStore.canvas,
  async (canvas) => {
    if (canvas && !initialized.value) {
      await init()
    }
  },
  { immediate: true }
)

onMounted(async () => {
  if (canvasStore.canvas) {
    await init()
  }
})

onUnmounted(() => {
  destroy()
})
</script>

<style scoped>
.litegraph-minimap {
  overflow: hidden;
}

.minimap-canvas {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.minimap-viewport {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
</style>
