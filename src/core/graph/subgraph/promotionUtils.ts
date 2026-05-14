import * as Sentry from '@sentry/vue'
import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { t } from '@/i18n'
import type {
  IContextMenuValue,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
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

function isWidgetValue(value: unknown): value is IBaseWidget['value'] {
  if (value === undefined) return true
  if (typeof value === 'string') return true
  if (typeof value === 'number') return true
  if (typeof value === 'boolean') return true
  return value !== null && typeof value === 'object'
}

export function getWidgetName(w: IBaseWidget): string {
  return isPromotedWidgetView(w) ? w.sourceWidgetName : w.name
}

/**
 * Returns true if the given promotion entry corresponds to a linked promotion
 * on the subgraph node. Linked promotions are driven by subgraph input
 * connections and cannot be independently hidden or shown.
 */
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

/** Find the host input on `subgraphNode` whose `_widget` is the
 * `PromotedWidgetView` for `(sourceNodeId, sourceWidgetName)`. */
function findHostInputForPromotion(
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

export function reorderSubgraphInputAtIndex(
  subgraphNode: SubgraphNode,
  oldPosition: number,
  newPosition: number
): void {
  if (
    oldPosition < 0 ||
    newPosition < 0 ||
    oldPosition >= subgraphNode.subgraph.inputs.length ||
    newPosition >= subgraphNode.subgraph.inputs.length
  )
    return

  const orderedIndices = subgraphNode.subgraph.inputs.map((_, index) => index)
  const [movedIndex] = orderedIndices.splice(oldPosition, 1)
  if (movedIndex !== undefined)
    orderedIndices.splice(newPosition, 0, movedIndex)

  applySubgraphInputOrder(subgraphNode, orderedIndices)
}

function applySubgraphInputOrder(
  subgraphNode: SubgraphNode,
  orderedIndices: readonly number[]
): void {
  const rows = subgraphNode.subgraph.inputs.map((input, index) => ({
    subgraphInput: input,
    hostInput: subgraphNode.inputs[index],
    value: getExplicitHostWidgetValue(subgraphNode.inputs[index]?._widget)
  }))

  const orderedRows = orderedIndices.flatMap((index) => rows[index] ?? [])

  subgraphNode.subgraph.inputs.splice(
    0,
    subgraphNode.subgraph.inputs.length,
    ...orderedRows.map((row) => row.subgraphInput)
  )
  subgraphNode.inputs.splice(
    0,
    subgraphNode.inputs.length,
    ...orderedRows.flatMap((row) => row.hostInput ?? [])
  )
  subgraphNode.invalidatePromotedViews()

  for (const [index, input] of subgraphNode.subgraph.inputs.entries()) {
    for (const linkId of input.linkIds) {
      const link = subgraphNode.subgraph.getLink(linkId)
      if (link) link.origin_slot = index
    }
  }

  for (const row of orderedRows) {
    const widget = row.hostInput?._widget
    if (widget && row.value !== undefined) widget.value = row.value
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

export function getSourceNodeId(w: IBaseWidget): string | undefined {
  if (!isPromotedWidgetView(w)) return undefined
  return w.sourceNodeId
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

function isPromotedOnParent(
  subgraphNode: SubgraphNode,
  widget: IBaseWidget,
  source: PromotedWidgetSource
): boolean {
  if (isPreviewPseudoWidget(widget))
    return isPreviewExposed(subgraphNode, source)
  return isLinkedPromotion(
    subgraphNode,
    source.sourceNodeId,
    source.sourceWidgetName
  )
}

export function isWidgetPromotedOnSubgraphNode(
  subgraphNode: SubgraphNode,
  source: PromotedWidgetSource
): boolean {
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
  return {
    sourceNodeId: String(node.id),
    sourceWidgetName: getWidgetName(widget)
  }
}

function refreshPromotedWidgetRendering(parents: SubgraphNode[]): void {
  for (const parent of parents) {
    parent.computeSize(parent.size)
    parent.setDirtyCanvas?.(true, true)
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
  const source = toPromotionSource(node, widget)
  for (const parent of parents) {
    if (isPreviewPseudoWidget(widget)) {
      promotePreviewViaExposure(
        parent,
        node as LGraphNode,
        source.sourceWidgetName
      )
      continue
    }
    if ('getSlotFromWidget' in node) {
      const result = promoteValueWidgetViaSubgraphInput(
        parent,
        node as LGraphNode,
        widget
      )
      if (!result.ok) {
        Sentry.addBreadcrumb({
          category: 'subgraph',
          level: 'warning',
          message: `Failed to promote widget "${source.sourceWidgetName}" on node ${node.id}: ${result.reason}`
        })
      }
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
      // Axiom 3: an external link to the host slot is sacred. Demote retracts
      // the promotion projection only; the SubgraphInput and any inbound link
      // outlive the projection. When no external link holds the slot open,
      // collapse it so demote is a true inverse of promote in the common case.
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
    (parent) => !isPromotedOnParent(parent, widget, source)
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
    (parent) => !isPromotedOnParent(parent, widget, source)
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

/**
 * Idempotently add preview-exposure entries for interior nodes that either
 * already have a `$$`-style pseudo-widget or are known-preview core node types
 * (PreviewImage, etc.). Safe to call repeatedly on the same host;
 * `promotePreviewViaExposure` deduplicates against existing entries.
 *
 * This is the shared preview-promotion path used by both
 * {@link promoteRecommendedWidgets} (subgraph-converted) and the paste flow
 * — older clipboard data may lack `properties.previewExposures`, so paste
 * needs to re-derive them from interior content.
 */
export function autoExposeKnownPreviewNodes(subgraphNode: SubgraphNode): void {
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
    // Promote preview widgets that already exist (e.g. custom node DOM widgets
    // like VHS videopreview that are created in onNodeCreated).
    promotePreviewWidget()

    // If a preview widget already exists in this frame, there's nothing to
    // defer. Core $$ preview widgets are the lazy path that needs updatePreviews.
    if (hasPreviewWidget()) continue

    // Nodes in CANVAS_IMAGE_PREVIEW_NODE_TYPES support a virtual $$
    // preview widget. Eagerly promote it so getPseudoWidgetPreviewTargets
    // includes this node and onDrawBackground can call updatePreviews on it
    // once execution outputs arrive.
    if (supportsVirtualCanvasImagePreview(node)) {
      promotePreviewViaExposure(subgraphNode, node, CANVAS_IMAGE_PREVIEW_WIDGET)
      continue
    }

    // Also schedule a deferred check: core $$ widgets are created lazily by
    // updatePreviews when node outputs are first loaded.
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
  const { subgraph } = subgraphNode

  return subgraph.nodes.some((interiorNode) =>
    getPromotableWidgets(interiorNode).some(
      (widget) =>
        !widget.computedDisabled &&
        !isPromotedOnParent(subgraphNode, widget, {
          sourceNodeId: String(interiorNode.id),
          sourceWidgetName: widget.name
        })
    )
  )
}
