import { ref } from 'vue'

import type { Point } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useCoordinateTransform } from './useCoordinateTransform'

export function useBrushAdjustment(initialSettings?: {
  useDominantAxis?: boolean
  brushAdjustmentSpeed?: number
}) {
  const store = useMaskEditorStore()
  const coordinateTransform = useCoordinateTransform()

  const initialPoint = ref<Point | null>(null)
  const initialBrushSize = ref(0)
  const initialBrushHardness = ref(0)
  const useDominantAxis = ref(initialSettings?.useDominantAxis ?? false)
  const brushAdjustmentSpeed = ref(initialSettings?.brushAdjustmentSpeed ?? 1.0)

  async function startBrushAdjustment(event: PointerEvent): Promise<void> {
    event.preventDefault()

    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = coordinateTransform.screenToCanvas(coords)

    store.brushPreviewGradientVisible = true
    initialPoint.value = coords_canvas
    initialBrushSize.value = store.brushSettings.size
    initialBrushHardness.value = store.brushSettings.hardness
  }

  async function handleBrushAdjustment(event: PointerEvent): Promise<void> {
    if (!initialPoint.value) {
      return
    }

    const coords = { x: event.offsetX, y: event.offsetY }
    const brushDeadZone = 5
    const coords_canvas = coordinateTransform.screenToCanvas(coords)

    const delta_x = coords_canvas.x - initialPoint.value.x
    const delta_y = coords_canvas.y - initialPoint.value.y

    const effectiveDeltaX = Math.abs(delta_x) < brushDeadZone ? 0 : delta_x
    const effectiveDeltaY = Math.abs(delta_y) < brushDeadZone ? 0 : delta_y

    let finalDeltaX = effectiveDeltaX
    let finalDeltaY = effectiveDeltaY

    if (useDominantAxis.value) {
      const ratio = Math.abs(effectiveDeltaX) / Math.abs(effectiveDeltaY)
      const threshold = 2.0

      if (ratio > threshold) {
        finalDeltaY = 0
      } else if (ratio < 1 / threshold) {
        finalDeltaX = 0
      }
    }

    const newSize = Math.max(
      1,
      Math.min(
        500,
        initialBrushSize.value + (finalDeltaX / 35) * brushAdjustmentSpeed.value
      )
    )

    const newHardness = Math.max(
      0,
      Math.min(
        1,
        initialBrushHardness.value -
          (finalDeltaY / 4000) * brushAdjustmentSpeed.value
      )
    )

    store.setBrushSize(newSize)
    store.setBrushHardness(newHardness)
  }

  return { startBrushAdjustment, handleBrushAdjustment }
}
