import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { getCanvasContextMenuTarget } from '@/lib/litegraph/src/canvas/getCanvasContextMenuTarget'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

/**
 * Routes a right-click on a group (frame) to the Vue context menu instead of
 * the legacy litegraph menu, mirroring how a Vue node right-click opens the
 * same menu via {@link showNodeOptions}.
 *
 * Only active in Nodes 2.0 mode ({@link LiteGraph.vueNodesMode}); in legacy
 * rendering, groups keep the old menu so they stay consistent with legacy
 * nodes. Nodes, the canvas background, and reroutes are left untouched.
 */
export function useGroupContextMenu() {
  const original = LGraphCanvas.prototype.processContextMenu

  function processContextMenuWithVueGroupMenu(
    this: LGraphCanvas,
    ...args: Parameters<typeof original>
  ): void {
    const [node, event] = args

    if (node || !LiteGraph.vueNodesMode || !this.graph) {
      original.apply(this, args)
      return
    }

    const { reroute, group } = getCanvasContextMenuTarget(
      this,
      event.canvasX,
      event.canvasY
    )
    if (reroute || !group) {
      original.apply(this, args)
      return
    }

    if (!group.selected) {
      this.deselectAll()
      group.selected = true
      this.selectedItems.add(group)
      this.state.selectionChanged = true
    }
    useCanvasStore().updateSelectedItems()
    showNodeOptions(event)
  }

  LGraphCanvas.prototype.processContextMenu = processContextMenuWithVueGroupMenu
}
