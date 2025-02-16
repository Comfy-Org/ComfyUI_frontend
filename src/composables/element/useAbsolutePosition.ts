import type { Size, Vector2 } from '@comfyorg/litegraph'
import { CSSProperties, ref } from 'vue'

import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'

export interface PositionConfig {
  /* The position of the element on litegraph canvas */
  pos: Vector2
  /* The size of the element on litegraph canvas */
  size: Size
  /* The scale factor of the canvas */
  scale?: number
}

export function useAbsolutePosition() {
  const canvasStore = useCanvasStore()
  const style = ref<CSSProperties>({
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: '0px',
    height: '0px'
  })

  const updatePosition = (
    config: PositionConfig,
    extraStyle?: CSSProperties
  ) => {
    const { pos, size, scale = canvasStore.canvas?.ds?.scale ?? 1 } = config
    const [left, top] = app.canvasPosToClientPos(pos)
    const [width, height] = size

    style.value = {
      ...style.value,
      left: `${left}px`,
      top: `${top}px`,
      width: `${width * scale}px`,
      height: `${height * scale}px`,
      ...extraStyle
    }
  }

  return {
    style,
    updatePosition
  }
}
