import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { getCanvasContextMenuTarget } from '@/lib/litegraph/src/canvas/getCanvasContextMenuTarget'
import type { LGraphGroup } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'

/**
 * The group menu only shows group actions when no nodes are selected, so the
 * group is selected without its child cascade regardless of the setting.
 */
function selectGroupWithoutChildren(canvas: LGraphCanvas, group: LGraphGroup) {
  const cascade = canvas.groupSelectChildren
  canvas.groupSelectChildren = false
  try {
    canvas.deselectAll()
    canvas.select(group)
  } finally {
    canvas.groupSelectChildren = cascade
  }
}

/**
 * Routes Nodes 2.0 group right-clicks to Vue while nodes, reroutes,
 * background, and legacy mode stay on litegraph.
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

    const groupIsOnlySelection =
      this.selectedItems.size === 1 && this.selectedItems.has(group)

    if (!groupIsOnlySelection) selectGroupWithoutChildren(this, group)
    showNodeOptions(event)
  }

  LGraphCanvas.prototype.processContextMenu = processContextMenuWithVueGroupMenu
}
