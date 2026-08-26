<script setup lang="ts">
import { useRafFn, useResizeObserver } from '@vueuse/core'
import { ref, useTemplateRef, watch } from 'vue'

import { drawNodeBoxes } from '@/renderer/core/canvas/nodeBoxRenderer'
import type {
  NodeBox,
  NodeBoxStyle
} from '@/renderer/core/canvas/nodeBoxRenderer'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import type { Bounds } from '@/renderer/core/layout/types'

const { getBoxes, contentVersion = 0 } = defineProps<{
  /**
   * Boxes to draw, in graph space. Receives the visible rect so the caller can
   * return only what intersects it rather than the whole graph.
   */
  getBoxes: (viewport: Bounds) => Iterable<NodeBox>
  /**
   * Bumped by the owner when box content changes for reasons this component
   * cannot observe - a node recolour, for instance, moves no geometry.
   */
  contentVersion?: number
}>()

const { camera } = useTransformState()
const colorPaletteStore = useColorPaletteStore()
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')

// Read once per measure rather than per frame: these are static class literals
// on this canvas, and getComputedStyle forces a style recalculation in a loop
// whose entire justification is frame time - with TransformPane having just
// dirtied style by writing the pane transform.
let boxStyle: NodeBoxStyle = {
  defaultColor: '#353535',
  defaultTitleColor: '#333',
  defaultSlotColor: '#778',
  widgetColor: '#222'
}
// Element size likewise: clientWidth forces layout. Not window-resize driven -
// this canvas is `absolute inset-0` inside a splitter panel, so a sidebar drag
// or bottom-panel toggle resizes it with no window event, and a zero-size
// mount would otherwise be permanent because nothing could re-measure it.
let elementWidth = 0
let elementHeight = 0

/** In the redraw signature, so re-measures repaint even with a still camera. */
const measureVersion = ref(0)

function measureElement(el: HTMLCanvasElement): void {
  const style = getComputedStyle(el)
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback

  boxStyle = {
    defaultColor: token('--node-box-color', '#353535'),
    defaultTitleColor: token('--node-box-title-color', '#333'),
    defaultSlotColor: token('--node-box-slot-color', '#778'),
    widgetColor: token('--node-box-widget-color', '#222')
  }
  elementWidth = el.clientWidth
  elementHeight = el.clientHeight
  measureVersion.value++
}

// Subsumes the mount measurement too: ResizeObserver delivers an initial entry
// on observe.
useResizeObserver(canvasRef, () => {
  if (canvasRef.value) measureElement(canvasRef.value)
})

// A palette switch changes the theme tokens the boxes are painted with, and
// nothing else re-samples them: the camera can sit still across a theme change
// indefinitely, leaving light boxes on a dark canvas until the next pan.
watch(
  () => colorPaletteStore.completedActivePalette,
  () => {
    if (canvasRef.value) measureElement(canvasRef.value)
  }
)

/** Visible region in graph space, from the inverse of the camera transform. */
function viewportBounds(width: number, height: number): Bounds {
  const scale = camera.z || 1
  return {
    x: -camera.x,
    y: -camera.y,
    width: width / scale,
    height: height / scale
  }
}

// Nothing drawn here can change without one of the signature's terms moving,
// so an idle frame does no work at all. dpr is a term because moving the
// window to a different-density display changes the backing store size with a
// static camera; measureVersion covers theme and element size; contentVersion
// covers box content the owner knows about and this component cannot.
let lastSignature = ''

useRafFn(() => {
  const el = canvasRef.value
  if (!el) return

  const dpr = window.devicePixelRatio || 1
  const width = elementWidth
  const height = elementHeight
  if (!width || !height) return

  const signature = `${camera.x},${camera.y},${camera.z},${layoutStore.layoutVersion},${layoutStore.nodeGeometryVersion},${width}x${height},${dpr},${measureVersion.value},${contentVersion}`
  if (signature === lastSignature) return
  lastSignature = signature

  const pixelWidth = Math.round(width * dpr)
  const pixelHeight = Math.round(height * dpr)
  if (el.width !== pixelWidth || el.height !== pixelHeight) {
    el.width = pixelWidth
    el.height = pixelHeight
  }

  const ctx = el.getContext('2d')
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  // Matches the node surface colour so a zoomed-out graph reads the same as a
  // zoomed-in one.
  const viewport = viewportBounds(width, height)
  drawNodeBoxes(ctx, getBoxes(viewport), camera, viewport, boxStyle)
})
</script>

<template>
  <!--
    Stands in for the node layer while zoomed out past legibility. Owned and
    drawn by the renderer, so a zoomed-out graph does not depend on the canvas
    renderer being present.
  -->
  <canvas
    ref="canvasRef"
    data-testid="node-box-overlay"
    class="pointer-events-none absolute inset-0 size-full [--node-box-color:var(--component-node-background)] [--node-box-slot-color:var(--component-node-foreground-secondary)] [--node-box-title-color:var(--component-node-background)] [--node-box-widget-color:var(--component-node-widget-background)]"
  />
</template>
