/**
 * Patches LGraphNode.changeMode to sync with layoutStore
 * This ensures that mode changes from LiteGraph (e.g., keyboard shortcuts, context menus)
 * are properly synchronized to the layout store.
 */
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

let isPatched = false

/**
 * Patches LGraphNode.prototype.changeMode to sync with layoutStore.
 * Should be called once during application initialization.
 */
export function patchLGraphNodeMode(): void {
  if (isPatched) return

  const originalChangeMode = LGraphNode.prototype.changeMode

  LGraphNode.prototype.changeMode = function (modeTo: number): boolean {
    const previousMode = this.mode
    const result = originalChangeMode.call(this, modeTo)

    // Sync to layoutStore if mode actually changed and the call succeeded
    if (result && previousMode !== this.mode) {
      layoutStore.setNodeMode(this.id.toString(), this.mode)
    }

    return result
  }

  isPatched = true
}
