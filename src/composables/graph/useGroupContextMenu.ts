import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { getCanvasContextMenuTarget } from '@/lib/litegraph/src/canvas/getCanvasContextMenuTarget'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { selectableKeyOf } from '@/lib/litegraph/src/utils/selectableItems'
import { useSelectionStore } from '@/renderer/core/canvas/selectionStore'
import { graphScopeOf } from '@/types/graphScopeId'

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

    if (!groupIsOnlySelection) {
      this.deselectAll()
      group.selected = true
      group.recomputeInsideNodes()
      this.selectedItems.add(group)
      this.state.selectionChanged = true
      if (this.graph) {
        useSelectionStore().apply(graphScopeOf(this.graph), {
          type: 'selection.add',
          keys: [selectableKeyOf(group)]
        })
      }
    }
    showNodeOptions(event)
  }

  LGraphCanvas.prototype.processContextMenu = processContextMenuWithVueGroupMenu
}
