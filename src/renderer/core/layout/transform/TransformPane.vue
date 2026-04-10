<template>
  <div
    ref="transformPaneRef"
    data-testid="transform-pane"
    class="pointer-events-none absolute top-0 left-0 will-change-auto"
  >
    <!--
      Offset wrapper: applies a single 2D translate to shift all child
      nodes into positive coordinate space. This keeps every node within
      the TransformPane's CSS box, so Chrome's compositor merges them
      into one compositing layer instead of creating one per node.
      The 2D translate does NOT promote this div to its own layer.
    -->
    <div ref="offsetWrapperRef" class="absolute">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { computed, useTemplateRef, watch } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useContentBounds } from '@/renderer/core/layout/transform/useContentBounds'
import { useTransformSettling } from '@/renderer/core/layout/transform/useTransformSettling'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

interface TransformPaneProps {
  canvas?: LGraphCanvas
}

const props = defineProps<TransformPaneProps>()

const { camera, syncWithCanvas } = useTransformState()

const canvasElement = computed(() => props.canvas?.canvas)
const { isTransforming: isInteracting } = useTransformSettling(canvasElement, {
  settleDelay: 256
})

const transformPaneRef = useTemplateRef('transformPaneRef')
const offsetWrapperRef = useTemplateRef('offsetWrapperRef')

const contentBounds = useContentBounds()
const allNodes = layoutStore.getAllNodes()
const storeVersion = layoutStore.getVersion()
let lastTrackedVersion = -1
let sampleNodeId: string | null = null

/**
 * When the layout store version changes, expand the tracked content
 * bounds to include any nodes that moved beyond the current area.
 *
 * Detects workflow switches by checking whether a previously tracked
 * node still exists. When the entire node set is replaced (e.g. on
 * workflow load), resets bounds so they don't accumulate across
 * unrelated workflows.
 */
function updateContentBounds() {
  const currentVersion = storeVersion.value
  if (currentVersion === lastTrackedVersion) return
  lastTrackedVersion = currentVersion

  const nodes = allNodes.value

  // Detect workflow switch: if the sampled node is gone, the node set
  // was replaced wholesale — reset bounds to avoid unbounded growth.
  if (sampleNodeId !== null && nodes.size > 0 && !nodes.has(sampleNodeId)) {
    contentBounds.reset()
  }
  sampleNodeId = nodes.size > 0 ? nodes.keys().next().value ?? null : null

  for (const [, layout] of nodes) {
    contentBounds.expandToInclude(layout.bounds)
  }
}

// --- DOM mutation (avoids Vue vdom diffing on every frame) ---

/**
 * Apply transform style, pane size, and offset wrapper transform via
 * direct DOM mutation instead of reactive template bindings.
 *
 * These values change every animation frame during zoom or pan.
 * Mutating the DOM directly limits the update to two elements,
 * avoiding expensive vdom patch work across the full node list.
 */
function applyStyles() {
  const pane = transformPaneRef.value
  const wrapper = offsetWrapperRef.value
  if (!pane) return

  const { x: ox, y: oy } = contentBounds.offset
  const { width, height } = contentBounds.size
  const z = camera.z

  // TransformPane: size covers all offset content; transform compensates
  pane.style.width = width > 0 ? `${width}px` : '100%'
  pane.style.height = height > 0 ? `${height}px` : '100%'
  pane.style.transform = `scale3d(${z}, ${z}, ${z}) translate3d(${camera.x - ox}px, ${camera.y - oy}px, 0)`
  pane.style.transformOrigin = '0 0'

  // Offset wrapper: shift child nodes into positive coordinate space
  if (wrapper) {
    wrapper.style.transform = `translate(${ox}px, ${oy}px)`
  }
}

watch(isInteracting, (interacting) => {
  const el = transformPaneRef.value
  if (el) {
    el.classList.toggle('will-change-transform', interacting)
    el.classList.toggle('will-change-auto', !interacting)
  }
})

useRafFn(
  () => {
    if (!props.canvas) return
    syncWithCanvas(props.canvas)
    updateContentBounds()
    contentBounds.flush()
    applyStyles()
  },
  { immediate: true }
)
</script>
