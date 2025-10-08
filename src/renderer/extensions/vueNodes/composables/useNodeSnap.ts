import { computed } from 'vue'

import { snapPoint } from '@/lib/litegraph/src/measure'
import { useSettingStore } from '@/platform/settings/settingStore'

/**
 * Composable for node snap-to-grid functionality
 *
 * Provides reactive access to snap settings and utilities for applying
 * snap-to-grid behavior to Vue nodes during drag and resize operations.
 */
export function useNodeSnap() {
  const settingStore = useSettingStore()

  // Reactive snap settings
  const gridSize = computed(() => settingStore.get('Comfy.SnapToGrid.GridSize'))
  const alwaysSnap = computed(() => settingStore.get('pysssss.SnapToGrid'))

  /**
   * Determines if snap-to-grid should be applied based on shift key and settings
   * @param event - The pointer event to check for shift key
   * @returns true if snapping should be applied
   */
  function shouldSnap(event: PointerEvent): boolean {
    return event.shiftKey || alwaysSnap.value
  }

  /**
   * Applies snap-to-grid to a position
   * @param position - Position object with x, y coordinates
   * @returns The snapped position (mutates input and returns it)
   */
  function applySnapToPosition(position: { x: number; y: number }): {
    x: number
    y: number
  } {
    const size = gridSize.value
    if (!size) return position

    const posArray: [number, number] = [position.x, position.y]
    if (snapPoint(posArray, size)) {
      position.x = posArray[0]
      position.y = posArray[1]
    }
    return position
  }

  /**
   * Applies snap-to-grid to a size (width/height)
   * @param size - Size object with width, height
   * @returns The snapped size (mutates input and returns it)
   */
  function applySnapToSize(size: { width: number; height: number }): {
    width: number
    height: number
  } {
    const gridSizeValue = gridSize.value
    if (!gridSizeValue) return size

    const sizeArray: [number, number] = [size.width, size.height]
    if (snapPoint(sizeArray, gridSizeValue)) {
      size.width = sizeArray[0]
      size.height = sizeArray[1]
    }
    return size
  }

  return {
    gridSize,
    alwaysSnap,
    shouldSnap,
    applySnapToPosition,
    applySnapToSize
  }
}
