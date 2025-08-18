<template>
  <div
    v-if="visible && initialized"
    ref="minimapRef"
    class="minimap-main-container flex absolute bottom-[20px] right-[90px] z-[1000]"
  >
    <MiniMapPanel
      v-if="showOptionsPanel"
      :panel-styles="panelStyles"
      :node-colors="nodeColors"
      :show-links="showLinks"
      :show-groups="showGroups"
      :render-bypass="renderBypass"
      :render-error="renderError"
      @update-option="updateOption"
    />

    <div
      ref="containerRef"
      class="litegraph-minimap relative"
      :style="containerStyles"
    >
      <Button
        class="absolute z-10"
        size="small"
        text
        severity="secondary"
        @click.stop="toggleOptionsPanel"
      >
        <template #icon>
          <i-lucide:settings-2 />
        </template>
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
import { onMounted, onUnmounted, ref } from 'vue'

import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'

import MiniMapPanel from './MiniMapPanel.vue'

const minimapRef = ref<HTMLDivElement>()

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
  nodeColors,
  showLinks,
  showGroups,
  renderBypass,
  renderError,
  updateOption,
  destroy,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleWheel,
  setMinimapRef
} = useMinimap()

const showOptionsPanel = ref(false)

const toggleOptionsPanel = () => {
  showOptionsPanel.value = !showOptionsPanel.value
}

onMounted(() => {
  if (minimapRef.value) {
    setMinimapRef(minimapRef.value)
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
