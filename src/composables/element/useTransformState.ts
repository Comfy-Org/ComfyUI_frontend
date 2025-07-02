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
    pos: ArrayLike<number>,
    size: ArrayLike<number>
  ): DOMRect => {
    const topLeft = canvasToScreen({ x: pos[0], y: pos[1] })
    const width = size[0] * camera.z
    const height = size[1] * camera.z

    return new DOMRect(topLeft.x, topLeft.y, width, height)
  }

  // Check if node is within viewport with frustum and size-based culling
  const isNodeInViewport = (
    nodePos: ArrayLike<number>,
    nodeSize: ArrayLike<number>,
    viewport: { width: number; height: number },
    margin: number = 0.2 // 20% margin by default
  ): boolean => {
    const screenPos = canvasToScreen({ x: nodePos[0], y: nodePos[1] })
    
    // Adjust margin based on zoom level for better performance
    let adjustedMargin = margin
    if (camera.z < 0.1) {
      adjustedMargin = Math.min(margin * 5, 2.0) // More aggressive at low zoom
    } else if (camera.z > 3.0) {
      adjustedMargin = Math.max(margin * 0.5, 0.05) // Tighter at high zoom
    }
    
    // Skip nodes too small to be visible
    const nodeScreenSize = Math.max(nodeSize[0], nodeSize[1]) * camera.z
    if (nodeScreenSize < 4) {
      return false
    }
    
    // Early rejection tests for performance
    const nodeRight = screenPos.x + (nodeSize[0] * camera.z)
    const nodeBottom = screenPos.y + (nodeSize[1] * camera.z)
    
    // Use actual viewport dimensions (already accounts for browser zoom via clientWidth/Height)
    const marginX = viewport.width * adjustedMargin
    const marginY = viewport.height * adjustedMargin
    const expandedLeft = -marginX
    const expandedRight = viewport.width + marginX
    const expandedTop = -marginY
    const expandedBottom = viewport.height + marginY
    
    return !(
      nodeRight < expandedLeft || 
      screenPos.x > expandedRight ||
      nodeBottom < expandedTop || 
      screenPos.y > expandedBottom
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
