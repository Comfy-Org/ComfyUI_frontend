import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

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
  const canvasStore = useCanvasStore()
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

    // Reroutes can sit inside a group; keep their legacy right-click menu.
    const onReroute = layoutStore.queryRerouteAtPoint({
      x: event.canvasX,
      y: event.canvasY
    })
    const group = onReroute
      ? undefined
      : this.graph.getGroupOnPos(event.canvasX, event.canvasY)

    if (!group) {
      original.apply(this, args)
      return
    }

    if (!group.selected) {
      this.deselectAll()
      this.select(group)
      canvasStore.updateSelectedItems()
    }
    showNodeOptions(event)
  }

  LGraphCanvas.prototype.processContextMenu = processContextMenuWithVueGroupMenu
}
