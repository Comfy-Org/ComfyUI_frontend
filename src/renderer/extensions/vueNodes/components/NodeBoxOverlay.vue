<script setup lang="ts">
import { useRafFn, useResizeObserver } from '@vueuse/core'
import { ref, useTemplateRef, watch } from 'vue'

import { drawNodeBoxes } from '@/renderer/core/canvas/nodeBoxRenderer'
import type {
  NodeBox,
  NodeBoxStyle
} from '@/renderer/core/canvas/nodeBoxRenderer'
import { useThemeStore } from '@/platform/theme/themeStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import type { Bounds } from '@comfyorg/shared-frontend-utils/geometry'

const { getBoxes, contentVersion = 0 } = defineProps<{
  getBoxes: (viewport: Bounds) => Iterable<NodeBox>
  contentVersion?: number
}>()

const { camera } = useTransformState()
const themeStore = useThemeStore()
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')

let boxStyle: NodeBoxStyle = {
  defaultColor: '#353535',
  defaultTitleColor: '#333',
  defaultSlotColor: '#778',
  widgetColor: '#222'
}
let elementWidth = 0
let elementHeight = 0

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

useResizeObserver(canvasRef, () => {
  if (canvasRef.value) measureElement(canvasRef.value)
})

watch(
  () => themeStore.activeTheme,
  () => {
    if (canvasRef.value) measureElement(canvasRef.value)
  }
)

function viewportBounds(width: number, height: number): Bounds {
  const scale = camera.z || 1
  return {
    x: -camera.x,
    y: -camera.y,
    width: width / scale,
    height: height / scale
  }
}

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

  const viewport = viewportBounds(width, height)
  drawNodeBoxes(ctx, getBoxes(viewport), camera, viewport, boxStyle)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    data-testid="node-box-overlay"
    class="pointer-events-none absolute inset-0 size-full [--node-box-color:var(--component-node-background)] [--node-box-slot-color:var(--component-node-foreground-secondary)] [--node-box-title-color:var(--component-node-background)] [--node-box-widget-color:var(--component-node-widget-background)]"
  />
</template>
