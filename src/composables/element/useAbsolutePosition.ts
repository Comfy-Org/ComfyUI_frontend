import type { Size, Vector2 } from '@comfyorg/litegraph'
import { CSSProperties, computed, ref } from 'vue'

import { useCanvasPositionConversion } from '@/composables/element/useCanvasPositionConversion'
import { useCanvasStore } from '@/stores/graphStore'

export interface PositionConfig {
  /* The position of the element on litegraph canvas */
  pos: Vector2
  /* The size of the element on litegraph canvas */
  size: Size
  /* The scale factor of the canvas */
  scale?: number
}

export function useAbsolutePosition(options: { useTransform?: boolean } = {}) {
  const { useTransform = false } = options

  const canvasStore = useCanvasStore()
  const lgCanvas = canvasStore.getCanvas()
  const { canvasPosToClientPos } = useCanvasPositionConversion(
    lgCanvas.canvas,
    lgCanvas
  )

  const position = ref<PositionConfig>({
    pos: [0, 0],
    size: [0, 0]
  })

  const style = computed<CSSProperties>(() => {
    const { pos, size, scale = lgCanvas.ds.scale } = position.value
    const [left, top] = canvasPosToClientPos(pos)
    const [width, height] = size

    return useTransform
      ? {
          position: 'fixed',
          transformOrigin: '0 0',
          transform: `scale(${scale})`,
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`
        }
      : {
          position: 'fixed',
          left: `${left}px`,
          top: `${top}px`,
          width: `${width * scale}px`,
          height: `${height * scale}px`
        }
  })

  /**
   * Update the position of the element on the litegraph canvas.
   *
   * @param config
   */
  const updatePosition = (config: PositionConfig) => {
    position.value = config
  }

  return {
    style,
    updatePosition
  }
}
