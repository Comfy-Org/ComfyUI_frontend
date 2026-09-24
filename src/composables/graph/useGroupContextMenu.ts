import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { getCanvasContextMenuTarget } from '@/lib/litegraph/src/canvas/getCanvasContextMenuTarget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'

function shouldUseLegacyContextMenu(
  canvas: LGraphCanvas,
  node: LGraphNode | undefined
) {
  return Boolean(node) || !LiteGraph.vueNodesMode || !canvas.graph
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

    if (shouldUseLegacyContextMenu(this, node)) {
      original.apply(this, args)
      return
    }

    const { reroute, link, group } = getCanvasContextMenuTarget(
      this,
      event.canvasX,
      event.canvasY
    )
    if (reroute || link || !group) {
      original.apply(this, args)
      return
    }

    const groupIsOnlySelection =
      this.selectedItems.size === 1 && this.selectedItems.has(group)

    if (!groupIsOnlySelection && !this.selectOnly) {
      this.deselectAll()
      this.select(group, { selectGroupChildren: false })
    }
    showNodeOptions(event)
  }

  LGraphCanvas.prototype.processContextMenu = processContextMenuWithVueGroupMenu
}
