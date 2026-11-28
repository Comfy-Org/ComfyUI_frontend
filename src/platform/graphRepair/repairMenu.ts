import type { MenuOption } from '@/composables/graph/menuOption'
import { t } from '@/i18n'
import type {
  IContextMenuValue,
  LGraphCanvas
} from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { markNodeMenuCallback } from '@/lib/litegraph/src/types/nodeMenu'
import {
  canvasRerouteRepair,
  nodeRerouteRepair
} from '@/platform/graphRepair/rerouteNodeRepair'

/** An eligible repair action for one menu invocation. */
export interface RepairMenuItem {
  id: string
  label: string
  action: () => void
}

function compact(items: (RepairMenuItem | undefined)[]): RepairMenuItem[] {
  return items.filter((item): item is RepairMenuItem => item !== undefined)
}

/** Repairs for a node menu: the selection when the node is selected, otherwise the node. */
export function getNodeRepairItems(
  canvas: LGraphCanvas,
  node: LGraphNode
): RepairMenuItem[] {
  const graph = canvas.graph
  if (!graph || canvas.state.readOnly || node.graph !== graph) return []
  const nodes = canvas.selectedItems.has(node)
    ? [...canvas.selectedItems].filter((item) => item instanceof LGraphNode)
    : [node]
  return compact([nodeRerouteRepair(graph, nodes)])
}

/** Repairs for the canvas menu, scoped to the graph the canvas shows. */
export function getCanvasRepairItems(canvas: LGraphCanvas): RepairMenuItem[] {
  const graph = canvas.graph
  if (!graph || canvas.state.readOnly) return []
  return compact([canvasRerouteRepair(graph)])
}

/** A divider, a Repair heading and the items for a LiteGraph menu; empty when there is nothing to repair. */
export function toLitegraphRepairSection(
  items: readonly RepairMenuItem[]
): (IContextMenuValue | null)[] {
  if (!items.length) return []
  return [
    null,
    {
      content: t('contextMenu.Repair'),
      disabled: true,
      callback: markNodeMenuCallback(() => {}, null)
    },
    ...items.map((item) => ({
      content: item.label,
      callback: markNodeMenuCallback(item.action, null)
    }))
  ]
}

/** Repair items for the Nodes 2.0 menu, grouped under the Repair heading by its menu builder. */
export function toRepairMenuOptions(
  items: readonly RepairMenuItem[]
): MenuOption[] {
  return items.map((item) => ({
    id: `repair:${item.id}`,
    label: item.label,
    action: item.action
  }))
}
