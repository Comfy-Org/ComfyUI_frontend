import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'
import { computed } from 'vue'

import { snapPoint } from '@/lib/litegraph/src/measure'
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

  return {
    gridSize,
    alwaysSnap,
    shouldSnap,
    applySnapToPosition
  }
}
