import type { Point2D, Size2D } from '@comfyorg/shared-frontend-utils/geometry'
import { computed } from 'vue'

import { snapPoint } from '@comfyorg/litegraph/measure'
import { useSettingStore } from '@/platform/settings/settingStore'

export function useNodeSnap() {
  const settingStore = useSettingStore()

  const gridSize = computed(() => settingStore.get('Comfy.SnapToGrid.GridSize'))
  const alwaysSnap = computed(() => settingStore.get('pysssss.SnapToGrid'))

  function shouldSnap(event: PointerEvent): boolean {
    return event.shiftKey || alwaysSnap.value
  }

  function applySnapToPosition(position: Point2D): Point2D {
    const size = gridSize.value
    if (!size) return { ...position }

    const posArray: [number, number] = [position.x, position.y]
    if (snapPoint(posArray, size)) {
      return { x: posArray[0], y: posArray[1] }
    }
    return { ...position }
  }

  function applySnapToSize(size: Size2D): Size2D {
    const gridSizeValue = gridSize.value
    if (!gridSizeValue) return { ...size }

    const sizeArray: [number, number] = [size.width, size.height]
    if (snapPoint(sizeArray, gridSizeValue, 'ceil')) {
      return { width: sizeArray[0], height: sizeArray[1] }
    }
    return { ...size }
  }

  return {
    gridSize,
    alwaysSnap,
    shouldSnap,
    applySnapToPosition,
    applySnapToSize
  }
}
