<template>
  <div
    v-if="visible && initialized"
    class="flex absolute bottom-[20px] right-[90px] z-[1000]"
    :class="{
      'bottom-[20px]': !bottomPanelStore.bottomPanelVisible,
      'bottom-[280px]': bottomPanelStore.bottomPanelVisible
    }"
  >
    <MiniMapPanel
      v-if="showOptionsPanel"
      :options-list="optionsList"
      :panel-styles="panelStyles"
      @update-option="updateOption"
    />

    <div
      ref="containerRef"
      class="litegraph-minimap relative"
      :style="containerStyles"
    >
      <Button
        icon="pi pi-bars"
        class="absolute top-2 left-2 z-10"
        size="small"
        @click.stop="toggleOptionsPanel"
      >
      </Button>

      <canvas
        ref="canvasRef"
        :width="width"
        :height="height"
        class="minimap-canvas"
      />

      <div class="minimap-viewport" :style="viewportStyles" />

      <div
        class="absolute inset-0"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointerleave="handlePointerUp"
        @wheel="handleWheel"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { useMinimap } from '@/composables/useMinimap'
import { useCanvasStore } from '@/stores/graphStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

import MiniMapPanel from './MiniMapPanel.vue'

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
  panelStyles,
  optionsList,
  updateOption,
  init,
  destroy,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleWheel
} = minimap

const showOptionsPanel = ref(false)

const toggleOptionsPanel = () => {
  showOptionsPanel.value = !showOptionsPanel.value
}

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
