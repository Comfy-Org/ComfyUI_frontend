import type {
  Bounds as Rect,
  Bounds,
  PanZoom,
  RectTuple
} from '@comfyorg/shared-frontend-utils/geometry'
import type { CSSProperties, Ref } from 'vue'
import { ref } from 'vue'

function intersect(a: Rect, b: Rect): RectTuple | null {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.width, b.x + b.width)
  const y2 = Math.min(a.y + a.height, b.y + b.height)

  if (x1 >= x2 || y1 >= y2) {
    return null
  }

  return [x1, y1, x2 - x1, y2 - y1]
}

interface ClippingOptions {
  margin?: number
}

interface UseDomClippingReturn {
  style: Ref<CSSProperties>
  updateClipPath: (
    element: HTMLElement,
    canvasElement: HTMLCanvasElement,
    isSelected: boolean,
    selectedArea?: Bounds & PanZoom
  ) => void
}

export function useDomClipping(
  options: ClippingOptions = {}
): UseDomClippingReturn {
  const style = ref<CSSProperties>({})
  const { margin = 4 } = options

  const calculateClipPath = (
    elementRect: DOMRect,
    canvasRect: DOMRect,
    isSelected: boolean,
    selectedArea?: Bounds & PanZoom
  ): string => {
    if (!isSelected && selectedArea) {
      const { scale, offset } = selectedArea

      const intersection = intersect(
        {
          x: elementRect.left - canvasRect.left,
          y: elementRect.top - canvasRect.top,
          width: elementRect.width,
          height: elementRect.height
        },
        {
          x: (selectedArea.x + offset[0] - margin) * scale,
          y: (selectedArea.y + offset[1] - margin) * scale,
          width: (selectedArea.width + 2 * margin) * scale,
          height: (selectedArea.height + 2 * margin) * scale
        }
      )

      if (!intersection) {
        return ''
      }

      const clipX =
        (intersection[0] - elementRect.left + canvasRect.left) / scale + 'px'
      const clipY =
        (intersection[1] - elementRect.top + canvasRect.top) / scale + 'px'
      const clipWidth = intersection[2] / scale + 'px'
      const clipHeight = intersection[3] / scale + 'px'

      return `polygon(0% 0%, 0% 100%, ${clipX} 100%, ${clipX} ${clipY}, calc(${clipX} + ${clipWidth}) ${clipY}, calc(${clipX} + ${clipWidth}) calc(${clipY} + ${clipHeight}), ${clipX} calc(${clipY} + ${clipHeight}), ${clipX} 100%, 100% 100%, 100% 0%)`
    }

    return ''
  }

  let pendingRaf = 0

  const updateClipPath = (
    element: HTMLElement,
    canvasElement: HTMLCanvasElement,
    isSelected: boolean,
    selectedArea?: Bounds & PanZoom
  ) => {
    if (pendingRaf) cancelAnimationFrame(pendingRaf)
    pendingRaf = requestAnimationFrame(() => {
      pendingRaf = 0
      const elementRect = element.getBoundingClientRect()
      const canvasRect = canvasElement.getBoundingClientRect()

      const clipPath = calculateClipPath(
        elementRect,
        canvasRect,
        isSelected,
        selectedArea
      )

      style.value = {
        clipPath: clipPath || 'none',
        willChange: 'clip-path'
      }
    })
  }

  return {
    style,
    updateClipPath
  }
}
