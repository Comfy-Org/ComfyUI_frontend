import * as Sentry from '@sentry/vue'
import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { t } from '@/i18n'
import type { IContextMenuValue } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { reorderSubgraphInputs } from '@/lib/litegraph/src/subgraph/subgraphUtils'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { isWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import { useToastStore } from '@/platform/updates/common/toastStore'
import {
  CANVAS_IMAGE_PREVIEW_WIDGET,
  supportsVirtualCanvasImagePreview
} from '@/composables/node/canvasImagePreviewTypes'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLitegraphService } from '@/services/litegraphService'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { readWidgetValue } from '@/world/widgetValueIO'

type PartialNode = Pick<LGraphNode, 'title' | 'id' | 'type'>

export type WidgetItem = [LGraphNode, IBaseWidget]
export { CANVAS_IMAGE_PREVIEW_WIDGET }

export function getWidgetName(w: IBaseWidget): string {
  return w.name
}

export function isLinkedPromotion(
  subgraphNode: SubgraphNode,
  sourceNodeId: string,
  sourceWidgetName: string
): boolean {
  return (
    findHostInputForPromotion(subgraphNode, sourceNodeId, sourceWidgetName) !==
    undefined
  )
}

export function findHostInputForPromotion(
  subgraphNode: SubgraphNode,
  sourceNodeId: string,
  sourceWidgetName: string
) {
  return subgraphNode.inputs.find((input) => {
    const w = input._widget
    return (
      w &&
      isPromotedWidgetView(w) &&
      w.sourceNodeId === sourceNodeId &&
      w.sourceWidgetName === sourceWidgetName
    )
  })
}

export function reorderSubgraphInputsByName(
  subgraphNode: SubgraphNode,
  orderedInputNames: readonly string[]
): void {
  const order = new Map(
    orderedInputNames.map((name, index) => [name, index] as const)
  )
  const byOrder = <T extends { name: string }>(left: T, right: T) => {
    const leftOrder = order.get(left.name) ?? Number.MAX_SAFE_INTEGER
    const rightOrder = order.get(right.name) ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
  }

  const orderedIndices = subgraphNode.subgraph.inputs
    .map((input, index) => ({ input, index }))
    .sort((left, right) => byOrder(left.input, right.input))
    .map(({ index }) => index)
  applySubgraphInputOrder(subgraphNode, orderedIndices)
}

export function reorderSubgraphInputsByWidgetOrder(
  subgraphNode: SubgraphNode,
  orderedWidgets: readonly IBaseWidget[]
): void {
  const remainingIndices = new Set(subgraphNode.inputs.keys())
  const orderedIndices = orderedWidgets.flatMap((orderedWidget) => {
    for (const index of remainingIndices) {
      const widget = subgraphNode.inputs[index]?._widget
      if (widget && isSamePromotedWidget(widget, orderedWidget)) {
        remainingIndices.delete(index)
        return [index]
      }
    }
    return []
  })

  for (const index of remainingIndices) orderedIndices.push(index)

  applySubgraphInputOrder(subgraphNode, orderedIndices)
}

function applySubgraphInputOrder(
  subgraphNode: SubgraphNode,
  orderedIndices: readonly number[]
): void {
  const widgetValues = subgraphNode.inputs.map((input) =>
    getExplicitHostWidgetValue(input?._widget)
  )

  reorderSubgraphInputs(subgraphNode, orderedIndices)

  for (const [newIndex, oldIndex] of orderedIndices.entries()) {
    const value = widgetValues[oldIndex]
    if (value === undefined) continue
    const widget = subgraphNode.inputs[newIndex]?._widget
    if (widget) widget.value = value
  }
}

function getExplicitHostWidgetValue(
  widget: IBaseWidget | undefined
): IBaseWidget['value'] | undefined {
  if (!widget) return undefined
  if (!isPromotedWidgetView(widget)) return widget.value

  const value = readWidgetValue(widget.entityId)
  return isWidgetValue(value) ? value : undefined
}

function isSamePromotedWidget(left: IBaseWidget, right: IBaseWidget): boolean {
  return (
    isPromotedWidgetView(left) &&
    isPromotedWidgetView(right) &&
    left.sourceNodeId === right.sourceNodeId &&
    left.sourceWidgetName === right.sourceWidgetName
  )
}

function isPreviewExposed(
  subgraphNode: SubgraphNode,
  source: PromotedWidgetSource
): boolean {
  const hostLocator = String(subgraphNode.id)
  return usePreviewExposureStore()
    .getExposures(subgraphNode.rootGraph.id, hostLocator)
    .some(
      (exposure) =>
        exposure.sourceNodeId === source.sourceNodeId &&
        exposure.sourcePreviewName === source.sourceWidgetName
    )
}

export function isWidgetPromotedOnSubgraphNode(
  subgraphNode: SubgraphNode,
  source: PromotedWidgetSource,
  widget?: IBaseWidget
): boolean {
  if (widget && isPreviewPseudoWidget(widget))
    return isPreviewExposed(subgraphNode, source)
  return (
    isLinkedPromotion(
      subgraphNode,
      source.sourceNodeId,
      source.sourceWidgetName
    ) || isPreviewExposed(subgraphNode, source)
  )
}

function toPromotionSource(
  node: PartialNode,
  widget: IBaseWidget
): PromotedWidgetSource {
  const widgetIsParentLevelView =
    isPromotedWidgetView(widget) && widget.sourceNodeId === String(node.id)
  return {
    sourceNodeId: String(node.id),
    sourceWidgetName: widgetIsParentLevelView
      ? widget.sourceWidgetName
      : getWidgetName(widget)
  }
}

function refreshPromotedWidgetRendering(parents: SubgraphNode[]): void {
  for (const parent of parents) {
    parent.computeSize(parent.size)
    parent.setDirtyCanvas(true, true)
  }
  useCanvasStore().canvas?.setDirty(true, true)
}

type CanonicalPromotionResult =
  | { ok: true }
  | { ok: false; reason: 'missingSourceSlot' | 'connectFailed' }

export function promoteValueWidgetViaSubgraphInput(
  subgraphNode: SubgraphNode,
  sourceNode: LGraphNode,
  sourceWidget: IBaseWidget
): CanonicalPromotionResult {
  const sourceWidgetName = getWidgetName(sourceWidget)
  if (
    isLinkedPromotion(subgraphNode, String(sourceNode.id), sourceWidgetName)
  ) {
    return { ok: true }
  }

  const sourceSlot = sourceNode.getSlotFromWidget(sourceWidget)
  if (!sourceSlot) return { ok: false, reason: 'missingSourceSlot' }

  const existingNames = subgraphNode.subgraph.inputs.map((input) => input.name)
  const inputName = nextUniqueName(sourceWidgetName, existingNames)
  const subgraphInput = subgraphNode.subgraph.addInput(
    inputName,
    String(sourceSlot.type ?? sourceWidget.type ?? '*')
  )
  const link = subgraphInput.connect(sourceSlot, sourceNode)
  if (!link) {
    subgraphNode.subgraph.removeInput(subgraphInput)
    return { ok: false, reason: 'connectFailed' }
  }

  return { ok: true }
}

function promotePreviewViaExposure(
  subgraphNode: SubgraphNode,
  sourceNode: LGraphNode,
  sourcePreviewName: string
): void {
  const store = usePreviewExposureStore()
  const rootGraphId = subgraphNode.rootGraph.id
  const hostLocator = String(subgraphNode.id)
  const existing = store
    .getExposures(rootGraphId, hostLocator)
    .some(
      (exposure) =>
        exposure.sourceNodeId === String(sourceNode.id) &&
        exposure.sourcePreviewName === sourcePreviewName
    )
  if (existing) return

  store.addExposure(rootGraphId, hostLocator, {
    sourceNodeId: String(sourceNode.id),
    sourcePreviewName
  })
}

const PREVIEW_WIDGET_TYPES = new Set(['preview', 'video', 'audioUI'])

export function isPreviewPseudoWidget(widget: IBaseWidget): boolean {
  if (widget.name.startsWith('$$')) return true
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
  const source = toPromotionSource(node, widget)
  if (!(node instanceof LGraphNode)) return
  for (const parent of parents) {
    if (isPreviewPseudoWidget(widget)) {
      promotePreviewViaExposure(parent, node, source.sourceWidgetName)
      continue
    }
    const result = promoteValueWidgetViaSubgraphInput(parent, node, widget)
    if (!result.ok) {
      Sentry.addBreadcrumb({
        category: 'subgraph',
        level: 'warning',
        message: `Failed to promote widget "${source.sourceWidgetName}" on node ${node.id}: ${result.reason}`
      })
    }
  }
  refreshPromotedWidgetRendering(parents)
  Sentry.addBreadcrumb({
    category: 'subgraph',
    message: `Promoted widget "${source.sourceWidgetName}" on node ${node.id}`,
    level: 'info'
  })
}

export function demoteWidget(
  node: PartialNode,
  widget: IBaseWidget,
  parents: SubgraphNode[]
) {
  const source = toPromotionSource(node, widget)
  for (const parent of parents) {
    if (!parent.subgraph) continue

    const hostInput = findHostInputForPromotion(
      parent,
      source.sourceNodeId,
      source.sourceWidgetName
    )
    const linkedInput = hostInput?._subgraphSlot
    if (linkedInput) {
      const hasExternalLink = hostInput.link != null
      if (hasExternalLink) {
        linkedInput.disconnect()
      } else {
        parent.subgraph.removeInput(linkedInput)
      }
      continue
    }

    if (isPreviewPseudoWidget(widget)) {
      const previewStore = usePreviewExposureStore()
      const hostLocator = String(parent.id)
      const exposure = previewStore
        .getExposures(parent.rootGraph.id, hostLocator)
        .find(
          (entry) =>
            entry.sourceNodeId === source.sourceNodeId &&
            entry.sourcePreviewName === source.sourceWidgetName
        )
      if (exposure) {
        previewStore.removeExposure(
          parent.rootGraph.id,
          hostLocator,
          exposure.name
        )
        continue
      }
    }
  }
  refreshPromotedWidgetRendering(parents)
  Sentry.addBreadcrumb({
    category: 'subgraph',
    message: `Demoted widget "${source.sourceWidgetName}" on node ${node.id}`,
    level: 'info'
  })
}

function getParentNodes(): SubgraphNode[] {
  const { navigationStack } = useSubgraphNavigationStore()
  const subgraph = navigationStack.at(-1)
  if (!subgraph) {
    useToastStore().add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('subgraphStore.promoteOutsideSubgraph')
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
  const parents = getParentNodes()
  const source = toPromotionSource(node, widget)
  const promotableParents = parents.filter(
    (parent) => !isWidgetPromotedOnSubgraphNode(parent, source, widget)
  )
  if (promotableParents.length > 0)
    options.unshift({
      content: t('subgraphStore.promoteWidget', {
        name: widget.label ?? widget.name
      }),
      callback: () => {
        promoteWidget(node, widget, promotableParents)
        widget.callback?.(widget.value)
      }
    })
  else {
    options.unshift({
      content: t('subgraphStore.unpromoteWidget', {
        name: widget.label ?? widget.name
      }),
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
  const source = toPromotionSource(node, widget)
  const promotableParents = parents.filter(
    (parent) => !isWidgetPromotedOnSubgraphNode(parent, source, widget)
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

function supportsVirtualPreviewWidget(node: LGraphNode): boolean {
  return supportsVirtualCanvasImagePreview(node)
}

function createVirtualCanvasImagePreviewWidget(): IBaseWidget {
  return {
    name: CANVAS_IMAGE_PREVIEW_WIDGET,
    type: 'IMAGE_PREVIEW',
    options: { serialize: false },
    serialize: false,
    y: 0,
    computedDisabled: false
  }
}

export function getPromotableWidgets(node: LGraphNode): IBaseWidget[] {
  const widgets = [...(node.widgets ?? [])]

  const hasCanvasPreviewWidget = widgets.some(
    (widget) => widget.name === CANVAS_IMAGE_PREVIEW_WIDGET
  )
  const supportsVirtualPreview = supportsVirtualPreviewWidget(node)
  if (!hasCanvasPreviewWidget && supportsVirtualPreview) {
    widgets.push(createVirtualCanvasImagePreviewWidget())
  }

  return widgets
}

function nodeWidgets(n: LGraphNode): WidgetItem[] {
  return getPromotableWidgets(n).map((w: IBaseWidget) => [n, w])
}

export function autoExposeKnownPreviewNodes(subgraphNode: SubgraphNode): void {
  if (subgraphNode.properties.previewExposures !== undefined) return
  const { updatePreviews } = useLitegraphService()
  const interiorNodes = subgraphNode.subgraph.nodes
  for (const node of interiorNodes) {
    node.updateComputedDisabled()

    const hasPreviewWidget = () =>
      node.widgets?.some(isPreviewPseudoWidget) ?? false

    function promotePreviewWidget() {
      const widget = node.widgets?.find(isPreviewPseudoWidget)
      if (!widget) return
      promotePreviewViaExposure(subgraphNode, node, widget.name)
    }
    promotePreviewWidget()

    if (hasPreviewWidget()) continue

    if (supportsVirtualCanvasImagePreview(node)) {
      promotePreviewViaExposure(subgraphNode, node, CANVAS_IMAGE_PREVIEW_WIDGET)
      continue
    }

    requestAnimationFrame(() => updatePreviews(node, promotePreviewWidget))
  }
}

export function promoteRecommendedWidgets(subgraphNode: SubgraphNode) {
  autoExposeKnownPreviewNodes(subgraphNode)
  const interiorNodes = subgraphNode.subgraph.nodes
  const filteredWidgets: WidgetItem[] = interiorNodes
    .flatMap(nodeWidgets)
    .filter(isRecommendedWidget)
    .filter(([, widget]) => !isPreviewPseudoWidget(widget))
  for (const [n, w] of filteredWidgets) {
    const result = promoteValueWidgetViaSubgraphInput(subgraphNode, n, w)
    if (!result.ok) {
      Sentry.addBreadcrumb({
        category: 'subgraph',
        level: 'warning',
        message: `Failed to promote widget "${getWidgetName(w)}" on node ${n.id}: ${result.reason}`
      })
    }
  }
  subgraphNode.computeSize(subgraphNode.size)
}

export function pruneDisconnected(subgraphNode: SubgraphNode) {
  const subgraph = subgraphNode.subgraph
  const removedEntries: PromotedWidgetSource[] = []

  const staleInputs = subgraph.inputs.filter((input) => {
    const widget = input._widget
    if (!widget || !isPromotedWidgetView(widget)) return false

    // If the SubgraphInput has any live link to an interior target slot that
    // still has a widget, the promotion is alive — even when the widget's
    // sourceNodeId points at a deeply-nested interior node that does not exist
    // directly in `subgraph` (nested SubgraphNode promotions).
    for (const linkId of input.linkIds) {
      const link = subgraph.getLink(linkId)
      if (!link) continue
      const { inputNode } = link.resolve(subgraph)
      if (!inputNode) continue
      const targetInputSlot = inputNode.inputs?.find(
        (slot) => slot.link === linkId
      )
      if (!targetInputSlot) continue
      if (inputNode.getWidgetFromSlot(targetInputSlot)) return false
    }

    const node = subgraph.getNodeById(widget.sourceNodeId)
    if (!node) {
      removedEntries.push(widget)
      return true
    }
    const hasWidget = getPromotableWidgets(node).some(
      (iw) => iw.name === widget.sourceWidgetName
    )
    if (!hasWidget) {
      removedEntries.push(widget)
    }
    return !hasWidget
  })

  for (const input of staleInputs) {
    subgraph.removeInput(input)
  }

  if (removedEntries.length > 0 && import.meta.env.DEV) {
    console.warn(
      '[subgraphInputs] Pruned disconnected promoted widget inputs',
      removedEntries,
      {
        graphId: subgraphNode.rootGraph.id,
        subgraphNodeId: subgraphNode.id
      }
    )
  }

  refreshPromotedWidgetRendering([subgraphNode])
  Sentry.addBreadcrumb({
    category: 'subgraph',
    message: `Pruned ${removedEntries.length} disconnected promoted widget input(s) from subgraph node ${subgraphNode.id}`,
    level: 'info'
  })
}

export function hasUnpromotedWidgets(subgraphNode: SubgraphNode): boolean {
  if (subgraphNode.isDetached) return false
  const { subgraph } = subgraphNode

  return subgraph.nodes.some((interiorNode) =>
    getPromotableWidgets(interiorNode).some(
      (widget) =>
        !widget.computedDisabled &&
        !isWidgetPromotedOnSubgraphNode(
          subgraphNode,
          {
            sourceNodeId: String(interiorNode.id),
            sourceWidgetName: widget.name
          },
          widget
        )
    )
  )
}
