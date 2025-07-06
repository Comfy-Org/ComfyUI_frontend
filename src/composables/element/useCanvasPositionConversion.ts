import type { LGraphCanvas, Vector2 } from '@comfyorg/litegraph'
import { useElementBounding } from '@vueuse/core'

/**
 * Convert between canvas and client positions
 * @param canvasElement - The canvas element
 * @param lgCanvas - The litegraph canvas
 * @returns The canvas position conversion functions
 */
export const useCanvasPositionConversion = (
  canvasElement: Parameters<typeof useElementBounding>[0],
  lgCanvas: LGraphCanvas
) => {
  const { left, top } = useElementBounding(canvasElement)

  const clientPosToCanvasPos = (pos: Vector2): Vector2 => {
    const { offset, scale } = lgCanvas.ds
    return [
      (pos[0] - left.value) / scale - offset[0],
      (pos[1] - top.value) / scale - offset[1]
    ]
  }

  const canvasPosToClientPos = (pos: Vector2): Vector2 => {
    const { offset, scale } = lgCanvas.ds
    return [
      (pos[0] + offset[0]) * scale + left.value,
      (pos[1] + offset[1]) * scale + top.value
    ]
  }

  return {
    clientPosToCanvasPos,
    canvasPosToClientPos
  }
}
