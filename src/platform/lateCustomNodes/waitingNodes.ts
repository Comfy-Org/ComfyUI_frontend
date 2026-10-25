import { t } from '@/i18n'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphBadge, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { forEachNode } from '@/utils/graphTraversalUtil'

function waitingBadge(): LGraphBadge {
  const colors =
    useColorPaletteStore().completedActivePalette.colors.litegraph_base
  return new LGraphBadge({
    text: t('lateCustomNodes.waitingBadge'),
    fgColor: colors.BADGE_FG_COLOR,
    bgColor: colors.BADGE_BG_COLOR
  })
}

function isPlaceholder(node: LGraphNode): boolean {
  return (
    node.last_serialization !== undefined &&
    !(node.type in LiteGraph.registered_node_types)
  )
}

/** Shows the nodes whose type is not registered yet as waiting for their pack instead of missing; changes nothing they save. */
export function showPlaceholdersAsWaiting(graph: LGraph): void {
  forEachNode(graph, (node) => {
    if (!isPlaceholder(node) || node.badges.includes(waitingBadge)) return
    node.has_errors = false
    if (!node.getTitle()) node.getTitle = () => node.type
    node.badges.push(waitingBadge)
  })
  graph.setDirtyCanvas(true, true)
}
