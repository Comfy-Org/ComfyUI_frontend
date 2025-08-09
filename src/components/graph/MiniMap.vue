<template>
  <div
    v-if="visible && initialized"
    ref="containerRef"
    class="litegraph-minimap absolute right-[90px] z-[1000]"
    :class="{
      'bottom-[20px]': !bottomPanelStore.bottomPanelVisible,
      'bottom-[280px]': bottomPanelStore.bottomPanelVisible
    }"
    :style="containerStyles"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointerleave="handlePointerUp"
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
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

const minimap = useMinimap()
const canvasStore = useCanvasStore()
const bottomPanelStore = useBottomPanelStore()

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
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
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
