<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <div
    class="transform-pane"
    :class="{ 'transform-pane--interacting': isInteracting }"
    :style="transformStyle"
    @pointerdown="handlePointerDown"
  >
    <!-- Vue nodes will be rendered here -->
    <slot />

    <!-- DEV ONLY: Viewport bounds visualization -->
    <div
      v-if="props.showDebugOverlay"
      class="viewport-debug-overlay"
      :style="{
        position: 'absolute',
        left: '10px',
        top: '10px',
        border: '2px solid red',
        width: (props.viewport?.width || 0) - 20 + 'px',
        height: (props.viewport?.height || 0) - 20 + 'px',
        pointerEvents: 'none',
        opacity: 0.5
      }"
    >
      <div
        style="
          position: absolute;
          top: 0;
          left: 0;
          background: red;
          color: white;
          padding: 2px 5px;
          font-size: 10px;
        "
      >
        Viewport: {{ props.viewport?.width }}x{{ props.viewport?.height }} DPR:
        {{ devicePixelRatio }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'

import { useTransformState } from '@/composables/element/useTransformState'
import { useCanvasTransformSync } from '@/composables/graph/useCanvasTransformSync'
import { useTransformSettling } from '@/composables/graph/useTransformSettling'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

interface TransformPaneProps {
  canvas?: LGraphCanvas
  viewport?: { width: number; height: number }
  showDebugOverlay?: boolean
}

const props = defineProps<TransformPaneProps>()

// Get device pixel ratio for display
const devicePixelRatio = window.devicePixelRatio || 1

// Transform state management
const {
  camera,
  transformStyle,
  syncWithCanvas,
  canvasToScreen,
  screenToCanvas,
  isNodeInViewport
} = useTransformState()

// Transform settling detection for re-rasterization optimization
const canvasElement = computed(() => props.canvas?.canvas)
const { isTransforming } = useTransformSettling(canvasElement, {
  settleDelay: 200,
  trackPan: true
})

// Use isTransforming for the CSS class (aliased for clarity)
const isInteracting = isTransforming

// Provide transform utilities to child components
provide('transformState', {
  camera,
  canvasToScreen,
  screenToCanvas,
  isNodeInViewport
})

// Event delegation for node interactions
const handlePointerDown = (event: PointerEvent) => {
  const target = event.target as HTMLElement
  const nodeElement = target.closest('[data-node-id]')

  if (nodeElement) {
    // TODO: Emit event for node interaction
    // Node interaction with nodeId will be handled in future implementation
  }
}

// Canvas transform synchronization
const emit = defineEmits<{
  rafStatusChange: [active: boolean]
  transformUpdate: [time: number]
}>()

useCanvasTransformSync(props.canvas, syncWithCanvas, {
  onStart: () => emit('rafStatusChange', true),
  onUpdate: (duration) => emit('transformUpdate', duration),
  onStop: () => emit('rafStatusChange', false)
})
</script>

<style scoped>
.transform-pane {
  position: absolute;
  inset: 0;
  contain: layout style paint;
  transform-origin: 0 0;
  pointer-events: none;
}

.transform-pane--interacting {
  will-change: transform;
}

/* Allow pointer events on nodes */
.transform-pane :deep([data-node-id]) {
  pointer-events: auto;
}
</style>
