<template>
  <div
    v-if="visible && initialized"
    ref="minimapRef"
    class="minimap-main-container absolute right-0 bottom-[54px] z-1000 flex"
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
      class="litegraph-minimap relative bg-interface-panel-surface"
      :style="containerStyles"
    >
      <Button
        class="absolute top-1 left-1 z-10 hover:bg-button-hover-surface!"
        size="small"
        text
        severity="secondary"
        @click.stop="toggleOptionsPanel"
      >
        <template #icon>
          <i class="icon-[lucide--settings-2]" />
        </template>
      </Button>
      <Button
        class="absolute top-1 right-1 z-10 hover:bg-button-hover-surface!"
        size="small"
        text
        severity="secondary"
        data-testid="close-minmap-button"
        @click.stop="() => commandStore.execute('Comfy.Canvas.ToggleMinimap')"
      >
        <template #icon>
          <i class="icon-[lucide--x]" />
        </template>
      </Button>

      <hr
        class="absolute top-7 h-px border-0 bg-node-component-border"
        :style="{
          width: containerStyles.width
        }"
      />

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
import { useCommandStore } from '@/stores/commandStore'

import MiniMapPanel from './MiniMapPanel.vue'

const commandStore = useCommandStore()

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
