<template>
  <div
    ref="transformPaneRef"
    data-testid="transform-pane"
    class="pointer-events-none absolute will-change-auto contain-layout contain-size contain-style"
    :style="paneStyle"
  >
    <!-- Vue nodes will be rendered here -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { computed, useTemplateRef, watch } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { usePaneBounds } from '@/renderer/core/layout/transform/usePaneBounds'
import { useTransformSettling } from '@/renderer/core/layout/transform/useTransformSettling'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

interface TransformPaneProps {
  canvas?: LGraphCanvas
}

const props = defineProps<TransformPaneProps>()

const { syncWithCanvas, camera } = useTransformState()
const { offset, size, expandToContain } = usePaneBounds()

const canvasElement = computed(() => props.canvas?.canvas)
const { isTransforming: isInteracting } = useTransformSettling(canvasElement, {
  settleDelay: 256
})

const transformPaneRef = useTemplateRef('transformPaneRef')

/** Reactive pane dimensions — only changes when bounds grow. */
const paneStyle = computed(() => ({
  width: `${size.width}px`,
  height: `${size.height}px`
}))

/**
 * Apply transform via direct DOM mutation instead of reactive template
 * bindings. The transform changes every animation frame during pan/zoom;
 * a reactive binding would cause Vue to diff the entire vnode subtree
 * (including all child node slots) on every frame.
 */
const adjustedTransform = computed(() => ({
  transform: `scale3d(${camera.z}, ${camera.z}, ${camera.z}) translate3d(${camera.x - offset.x}px, ${camera.y - offset.y}px, 0)`,
  transformOrigin: '0 0'
}))

watch([adjustedTransform, transformPaneRef], ([newStyle, el]) => {
  if (el) {
    Object.assign(el.style, newStyle)
  }
})
watch([isInteracting, transformPaneRef], ([interacting, el]) => {
  if (el) {
    el.classList.toggle('will-change-transform', interacting)
    el.classList.toggle('will-change-auto', !interacting)
  }
})

useRafFn(
  () => {
    if (!props.canvas) return
    syncWithCanvas(props.canvas)

    const nodes = props.canvas.graph?.nodes
    if (nodes?.length) {
      expandToContain(nodes)
    }
  },
  { immediate: true }
)
</script>
