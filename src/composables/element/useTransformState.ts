/**
 * Composable for managing transform state synchronized with LiteGraph canvas
 * Provides reactive transform state and coordinate conversion utilities
 */
import type { LGraphCanvas } from '@comfyorg/litegraph'
import { computed, reactive, readonly } from 'vue'

export interface Point {
  x: number
  y: number
}

export interface Camera {
  x: number
  y: number
  z: number // scale/zoom
}

export const useTransformState = () => {
  // Reactive state mirroring LiteGraph's canvas transform
  const camera = reactive<Camera>({
    x: 0,
    y: 0,
    z: 1
  })

  // Computed transform string for CSS
  const transformStyle = computed(() => ({
    transform: `scale(${camera.z}) translate(${camera.x}px, ${camera.y}px)`,
    transformOrigin: '0 0'
  }))

  // Sync with LiteGraph during draw cycle
  const syncWithCanvas = (canvas: LGraphCanvas) => {
    if (!canvas || !canvas.ds) return

    camera.x = canvas.ds.offset[0]
    camera.y = canvas.ds.offset[1]
    camera.z = canvas.ds.scale || 1
  }

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = (point: Point): Point => {
    return {
      x: point.x * camera.z + camera.x,
      y: point.y * camera.z + camera.y
    }
  }

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = (point: Point): Point => {
    return {
      x: (point.x - camera.x) / camera.z,
      y: (point.y - camera.y) / camera.z
    }
  }

  // Get node's screen bounds for culling
  const getNodeScreenBounds = (
    pos: [number, number],
    size: [number, number]
  ): DOMRect => {
    const topLeft = canvasToScreen({ x: pos[0], y: pos[1] })
    const width = size[0] * camera.z
    const height = size[1] * camera.z

    return new DOMRect(topLeft.x, topLeft.y, width, height)
  }

  // Check if node is within viewport
  const isNodeInViewport = (
    nodePos: [number, number],
    nodeSize: [number, number],
    viewport: DOMRect,
    margin: number = 0.2 // 20% margin by default
  ): boolean => {
    const nodeBounds = getNodeScreenBounds(nodePos, nodeSize)
    const expandedViewport = new DOMRect(
      viewport.x - viewport.width * margin,
      viewport.y - viewport.height * margin,
      viewport.width * (1 + margin * 2),
      viewport.height * (1 + margin * 2)
    )

    return !(
      nodeBounds.right < expandedViewport.left ||
      nodeBounds.left > expandedViewport.right ||
      nodeBounds.bottom < expandedViewport.top ||
      nodeBounds.top > expandedViewport.bottom
    )
  }

  return {
    camera: readonly(camera),
    transformStyle,
    syncWithCanvas,
    canvasToScreen,
    screenToCanvas,
    getNodeScreenBounds,
    isNodeInViewport
  }
}
