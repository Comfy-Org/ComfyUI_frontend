/** Feeds renderer-neutral node selection changes to the public node API. */
import { watch } from 'vue'

import { provideSelectionSource } from '@/platform/nodeApi/selection'
import { isLGraphNode } from '@/utils/litegraphUtil'

import { useCanvasStore } from './canvasStore'

export function installSelectionBridge(): void {
  provideSelectionSource((onSelection) => {
    const canvasStore = useCanvasStore()
    return watch(
      () => canvasStore.selectedItems,
      (items) => {
        onSelection(items.filter(isLGraphNode).map((node) => String(node.id)))
      }
    )
  })
}
