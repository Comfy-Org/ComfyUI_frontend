<template>
  <div
    v-if="visible && initialized"
    ref="minimapRef"
    :class="
      cn(
        'minimap-main-container absolute right-0 bottom-[54px] z-1000 flex',
        isMobile ? 'flex-col' : 'flex-row'
      )
    "
  >
    <MiniMapPanel
      v-if="showOptionsPanel"
      :panel-styles="panelStyles"
      :node-colors="nodeColors"
      :show-links="showLinks"
      :show-groups="showGroups"
      :render-bypass="renderBypass"
      :render-error="renderError"
      :is-mobile="isMobile"
      @update-option="updateOption"
    />

    <div
      class="flex flex-col overflow-hidden bg-comfy-menu-bg shadow-interface"
      :style="containerStyles"
    >
      <div class="flex shrink-0 items-center justify-between">
        <Button
          size="icon"
          variant="muted-textonly"
          :aria-label="$t('g.settings')"
          @click.stop="toggleOptionsPanel"
        >
          <i class="icon-[lucide--settings-2]" />
        </Button>
        <Button
          size="icon"
          variant="muted-textonly"
          :aria-label="$t('g.close')"
          data-testid="close-minimap-button"
          @click.stop="() => commandStore.execute('Comfy.Canvas.ToggleMinimap')"
        >
          <i class="icon-[lucide--x]" />
        </Button>
      </div>

      <div
        ref="containerRef"
        class="litegraph-minimap relative min-h-0 flex-1 overflow-hidden rounded-t-lg border-t border-node-component-border"
        data-testid="minimap-container"
      >
        <canvas
          ref="canvasRef"
          :width="width"
          :height="height"
          class="minimap-canvas"
          data-testid="minimap-canvas"
        />

        <div
          class="minimap-viewport rounded-lg"
          :style="viewportStyles"
          data-testid="minimap-viewport"
        />

        <div
          class="absolute inset-0 touch-none"
          data-testid="minimap-interaction-overlay"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointerleave="handlePointerUp"
          @pointercancel="handlePointerCancel"
          @wheel="handleWheel"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { onMounted, onUnmounted, ref, useTemplateRef } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'
import { useCommandStore } from '@/stores/commandStore'
import { cn } from '@comfyorg/tailwind-utils'

import MiniMapPanel from './MiniMapPanel.vue'

const isMobile = useBreakpoints(breakpointsTailwind).smaller('md')

const commandStore = useCommandStore()
const minimapRef = ref<HTMLDivElement>()
const containerRef = useTemplateRef<HTMLDivElement>('containerRef')
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')

const {
  initialized,
  visible,
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
  handlePointerCancel,
  handleWheel,
  setMinimapRef
} = useMinimap({
  containerRefMaybe: containerRef,
  canvasRefMaybe: canvasRef
})

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
