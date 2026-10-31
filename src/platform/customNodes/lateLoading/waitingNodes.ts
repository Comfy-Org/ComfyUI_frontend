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

function hideMissingOutline(node: LGraphNode): void {
  node.strokeStyles = { ...node.strokeStyles, error: () => undefined }
}

function showTypeWhenUntitled(node: LGraphNode): void {
  const titleOf = node.getTitle
  node.getTitle = () => titleOf.call(node) || node.type
}

/** Shows the nodes whose type is not registered yet as waiting for their pack instead of missing; they stay placeholders and change nothing they save. */
export function showPlaceholdersAsWaiting(graph: LGraph): void {
  forEachNode(graph, (node) => {
    if (!isPlaceholder(node) || node.badges.includes(waitingBadge)) return
    hideMissingOutline(node)
    showTypeWhenUntitled(node)
    node.badges.push(waitingBadge)
  })
  graph.setDirtyCanvas(true, true)
}
