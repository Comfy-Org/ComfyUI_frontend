<template>
  <div
    class="absolute inset-0 w-full h-full pointer-events-none"
    :class="[
      isInteracting ? 'transform-pane--interacting' : 'will-change-auto',
      isLOD ? 'isLOD' : ''
    ]"
    :style="transformStyle"
    @pointerdown="handlePointerDown"
  >
    <!-- Vue nodes will be rendered here -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { TransformStateKey } from '@/renderer/core/layout/injectionKeys'
import { useCanvasTransformSync } from '@/renderer/core/layout/transform/useCanvasTransformSync'
import { useTransformSettling } from '@/renderer/core/layout/transform/useTransformSettling'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { useLOD } from '@/renderer/extensions/vueNodes/lod/useLOD'

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

const isLOD = ref(false)

useLOD(camera, isLOD)

const canvasElement = computed(() => props.canvas?.canvas)
const { isTransforming: isInteracting } = useTransformSettling(canvasElement, {
  settleDelay: 200,
  trackPan: true
})

provide(TransformStateKey, {
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
