import type { Positionable } from '@/lib/litegraph/src/interfaces'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

/**
 * Overrides the derived `canvasStore.selectedItems` for tests whose items
 * belong to no graph. Relies on `@pinia/testing` making getters writable.
 */
export function setCanvasSelection(items: Positionable[]): void {
  const store: { selectedItems: Positionable[] } = useCanvasStore()
  store.selectedItems = items
}
