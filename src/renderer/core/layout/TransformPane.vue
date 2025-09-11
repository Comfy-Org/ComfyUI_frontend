<template>
  <div
    class="transform-pane"
    :class="{ 'transform-pane--interacting': isInteracting }"
    :style="transformStyle"
    @pointerdown="handlePointerDown"
  >
    <!-- Vue nodes will be rendered here -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'

import { useCanvasTransformSync } from '@/composables/graph/useCanvasTransformSync'
import { useTransformSettling } from '@/composables/graph/useTransformSettling'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useTransformState } from '@/renderer/core/layout/useTransformState'

interface TransformPaneProps {
  canvas?: LGraphCanvas
}

const props = defineProps<TransformPaneProps>()

const {
  camera,
  transformStyle,
  syncWithCanvas,
  canvasToScreen,
  screenToCanvas,
  isNodeInViewport
} = useTransformState()

const canvasElement = computed(() => props.canvas?.canvas)
const { isTransforming: isInteracting } = useTransformSettling(canvasElement, {
  settleDelay: 200,
  trackPan: true
})

provide('transformState', {
  camera,
  canvasToScreen,
  screenToCanvas,
  isNodeInViewport
})

const handlePointerDown = (event: PointerEvent) => {
  const target = event.target as HTMLElement
  const nodeElement = target.closest('[data-node-id]')

  if (nodeElement) {
    // TODO: Emit event for node interaction
    // Node interaction with nodeId will be handled in future implementation
  }
}

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
  transform-origin: 0 0;
  pointer-events: none;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.transform-pane--interacting {
  will-change: transform;
}

/* Allow pointer events on nodes */
.transform-pane :deep([data-node-id]) {
  pointer-events: auto;
}
</style>
