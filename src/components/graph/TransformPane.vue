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
import type { LGraphCanvas } from '@comfyorg/litegraph'
import { onMounted, onUnmounted, provide, ref } from 'vue'

import { useTransformState } from '@/composables/element/useTransformState'

interface TransformPaneProps {
  canvas?: LGraphCanvas
  viewport?: { width: number; height: number }
}

const props = defineProps<TransformPaneProps>()

// Transform state management
const {
  camera,
  transformStyle,
  syncWithCanvas,
  canvasToScreen,
  screenToCanvas,
  isNodeInViewport
} = useTransformState()

// Interaction state
const isInteracting = ref(false)
let interactionTimeout: number | null = null

// Provide transform utilities to child components
provide('transformState', {
  camera,
  canvasToScreen,
  screenToCanvas,
  isNodeInViewport
})

// Handle will-change for performance
const setInteracting = (interactive: boolean) => {
  isInteracting.value = interactive

  if (!interactive && interactionTimeout !== null) {
    clearTimeout(interactionTimeout)
    interactionTimeout = null
  }

  if (!interactive) {
    // Delay removing will-change to avoid thrashing
    interactionTimeout = window.setTimeout(() => {
      isInteracting.value = false
    }, 200)
  }
}

// Event delegation for node interactions
const handlePointerDown = (event: PointerEvent) => {
  const target = event.target as HTMLElement
  const nodeElement = target.closest('[data-node-id]')

  if (nodeElement) {
    const nodeId = nodeElement.getAttribute('data-node-id')
    // TODO: Emit event for node interaction
    console.log('Node interaction:', nodeId)
  }
}

// Sync with canvas on RAF
let rafId: number | null = null
const emit = defineEmits<{
  rafStatusChange: [active: boolean]
  transformUpdate: [time: number]
}>()

const startSync = () => {
  emit('rafStatusChange', true)
  const sync = () => {
    if (props.canvas) {
      const startTime = performance.now()
      syncWithCanvas(props.canvas)
      const endTime = performance.now()
      emit('transformUpdate', endTime - startTime)
    }
    rafId = requestAnimationFrame(sync)
  }
  sync()
}

const stopSync = () => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
    emit('rafStatusChange', false)
  }
}

// Canvas event listeners
const handleCanvasInteractionStart = () => setInteracting(true)
const handleCanvasInteractionEnd = () => setInteracting(false)

onMounted(() => {
  startSync()

  // Listen to canvas interaction events if available
  if (props.canvas) {
    props.canvas.canvas.addEventListener('wheel', handleCanvasInteractionStart)
    props.canvas.canvas.addEventListener(
      'pointerdown',
      handleCanvasInteractionStart
    )
    props.canvas.canvas.addEventListener(
      'pointerup',
      handleCanvasInteractionEnd
    )
    props.canvas.canvas.addEventListener(
      'pointercancel',
      handleCanvasInteractionEnd
    )
  }
})

onUnmounted(() => {
  stopSync()

  if (interactionTimeout !== null) {
    clearTimeout(interactionTimeout)
  }

  // Clean up event listeners
  if (props.canvas) {
    props.canvas.canvas.removeEventListener(
      'wheel',
      handleCanvasInteractionStart
    )
    props.canvas.canvas.removeEventListener(
      'pointerdown',
      handleCanvasInteractionStart
    )
    props.canvas.canvas.removeEventListener(
      'pointerup',
      handleCanvasInteractionEnd
    )
    props.canvas.canvas.removeEventListener(
      'pointercancel',
      handleCanvasInteractionEnd
    )
  }
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
