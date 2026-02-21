import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { t } from '@/i18n'
import type {
  IContextMenuValue,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLitegraphService } from '@/services/litegraphService'
import { usePromotionStore } from '@/stores/promotionStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'

type PartialNode = Pick<LGraphNode, 'title' | 'id' | 'type'>

export type WidgetItem = [PartialNode, IBaseWidget]

export function getWidgetName(w: IBaseWidget): string {
  return isPromotedWidgetView(w) ? w.sourceWidgetName : w.name
}

/** Known non-$$ preview widget types added by core or popular extensions. */
const PREVIEW_WIDGET_TYPES = new Set(['preview', 'video', 'audioUI'])

/**
 * Returns true for pseudo-widgets that display media previews and should
 * be auto-promoted when their node is inside a subgraph.
 * Matches the core `$$` convention as well as custom-node patterns
 * (e.g. VHS `videopreview` with type `"preview"`).
 */
export function isPreviewPseudoWidget(widget: IBaseWidget): boolean {
  if (widget.name.startsWith('$$')) return true
  // Custom nodes may set serialize on the widget or in options
  if (widget.serialize !== false && widget.options?.serialize !== false)
    return false
  if (typeof widget.type === 'string' && PREVIEW_WIDGET_TYPES.has(widget.type))
    return true
  return false
}

export function promoteWidget(
  node: PartialNode,
  widget: IBaseWidget,
  parents: SubgraphNode[]
) {
  const store = usePromotionStore()
  const nodeId = String(
    isPromotedWidgetView(widget) ? widget.sourceNodeId : node.id
  )
  const widgetName = getWidgetName(widget)
  for (const parent of parents) {
    store.promote(parent.id, nodeId, widgetName)
  }
}

export function demoteWidget(
  node: PartialNode,
  widget: IBaseWidget,
  parents: SubgraphNode[]
) {
  const store = usePromotionStore()
  const nodeId = String(
    isPromotedWidgetView(widget) ? widget.sourceNodeId : node.id
  )
  const widgetName = getWidgetName(widget)
  for (const parent of parents) {
    store.demote(parent.id, nodeId, widgetName)
  }
}

function getParentNodes(): SubgraphNode[] {
  const { navigationStack } = useSubgraphNavigationStore()
  const subgraph = navigationStack.at(-1)
  if (!subgraph) {
    useToastStore().add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('subgraphStore.promoteOutsideSubgraph'),
      life: 2000
    })
    return []
  }
  const parentGraph = navigationStack.at(-2) ?? subgraph.rootGraph
  return parentGraph.nodes.filter(
    (node): node is SubgraphNode =>
      node.type === subgraph.id && node.isSubgraphNode()
  )
}

export function addWidgetPromotionOptions(
  options: (IContextMenuValue<unknown> | null)[],
  widget: IBaseWidget,
  node: LGraphNode
) {
  const store = usePromotionStore()
  const parents = getParentNodes()
  const nodeId = String(node.id)
  const widgetName = getWidgetName(widget)
  const promotableParents = parents.filter(
    (s) => !store.isPromoted(s.id, nodeId, widgetName)
  )
  if (promotableParents.length > 0)
    options.unshift({
      content: `Promote Widget: ${widget.label ?? widget.name}`,
      callback: () => {
        promoteWidget(node, widget, promotableParents)
        widget.callback?.(widget.value)
      }
    })
  else {
    options.unshift({
      content: `Un-Promote Widget: ${widget.label ?? widget.name}`,
      callback: () => {
        demoteWidget(node, widget, parents)
        widget.callback?.(widget.value)
      }
    })
  }
}

export function tryToggleWidgetPromotion() {
  const canvas = useCanvasStore().getCanvas()
  const [x, y] = canvas.graph_mouse
  const node = canvas.graph?.getNodeOnPos(x, y, canvas.visible_nodes)
  if (!node) return
  const widget = node.getWidgetOnPos(x, y, true)
  const parents = getParentNodes()
  if (!parents.length || !widget) return
  const store = usePromotionStore()
  const nodeId = String(node.id)
  const widgetName = getWidgetName(widget)
  const promotableParents = parents.filter(
    (s) => !store.isPromoted(s.id, nodeId, widgetName)
  )
  if (promotableParents.length > 0)
    promoteWidget(node, widget, promotableParents)
  else demoteWidget(node, widget, parents)
}

const recommendedNodes = [
  'CLIPTextEncode',
  'LoadImage',
  'SaveImage',
  'PreviewImage'
]
const recommendedWidgetNames = ['seed']

export function isRecommendedWidget([node, widget]: WidgetItem) {
  return (
    !widget.computedDisabled &&
    (recommendedNodes.includes(node.type) ||
      recommendedWidgetNames.includes(widget.name))
  )
}

function nodeWidgets(n: LGraphNode): WidgetItem[] {
  return n.widgets?.map((w: IBaseWidget) => [n, w]) ?? []
}

export function promoteRecommendedWidgets(subgraphNode: SubgraphNode) {
  const store = usePromotionStore()
  const { updatePreviews } = useLitegraphService()
  const interiorNodes = subgraphNode.subgraph.nodes
  for (const node of interiorNodes) {
    node.updateComputedDisabled()
    function promotePreviewWidget() {
      const widget = node.widgets?.find(isPreviewPseudoWidget)
      if (!widget) return
      if (store.isPromoted(subgraphNode.id, String(node.id), widget.name))
        return
      promoteWidget(node, widget, [subgraphNode])
    }
    // Promote preview widgets that already exist (e.g. custom node DOM widgets
    // like VHS videopreview that are created in onNodeCreated).
    promotePreviewWidget()
    // Also schedule a deferred check: core $$ widgets are created lazily by
    // updatePreviews when node outputs are first loaded.
    requestAnimationFrame(() =>
      updatePreviews(node, () => {
        promotePreviewWidget()
      })
    )
  }
  const filteredWidgets: WidgetItem[] = interiorNodes
    .flatMap(nodeWidgets)
    .filter(isRecommendedWidget)
  for (const [n, w] of filteredWidgets) {
    store.promote(subgraphNode.id, String(n.id), getWidgetName(w))
  }
  subgraphNode.computeSize(subgraphNode.size)
}

export function pruneDisconnected(subgraphNode: SubgraphNode) {
  const store = usePromotionStore()
  const subgraph = subgraphNode.subgraph
  const validEntries = store.getPromotions(subgraphNode.id).filter((entry) => {
    const node = subgraph.getNodeById(entry.interiorNodeId)
    if (!node) return false
    return node.widgets?.some((iw) => iw.name === entry.widgetName) ?? false
  })
  store.setPromotions(subgraphNode.id, validEntries)
}
