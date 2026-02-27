import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { Point } from '@/lib/litegraph/src/interfaces'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import { t } from '@/i18n'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { usePromotionStore } from '@/stores/promotionStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'

import { isPromotedWidgetView } from './promotedWidgetTypes';
import type { PromotedWidgetView as IPromotedWidgetView } from './promotedWidgetTypes';

export type { PromotedWidgetView } from './promotedWidgetTypes'
export { isPromotedWidgetView } from './promotedWidgetTypes'

function resolve(
  subgraphNode: SubgraphNode,
  nodeId: string,
  widgetName: string
): { node: LGraphNode; widget: IBaseWidget } | undefined {
  const node = subgraphNode.subgraph.getNodeById(nodeId)
  if (!node) return undefined

  const widget = node.widgets?.find((w: IBaseWidget) => w.name === widgetName)
  if (widget) return { node, widget }

  if (!node.isSubgraphNode?.()) return undefined

  // Some nested rebind/prune sequences leave the intermediate SubgraphNode
  // without a materialized widgets[] entry for a frame, while input _widget
  // bindings are already updated. Follow that binding to avoid disconnecteds.
  const inputWidget = node.inputs.find(
    (input) => input.name === widgetName
  )?._widget
  return inputWidget ? { node, widget: inputWidget } : undefined
}

function resolveViaPromotionStore(
  graphId: string,
  hostNode: SubgraphNode,
  nodeId: string,
  widgetName: string
): { hostNode: SubgraphNode; nodeId: string; widgetName: string } | undefined {
  const sourceNode = hostNode.subgraph.getNodeById(nodeId)
  if (!sourceNode?.isSubgraphNode?.()) return undefined

  const fallback = usePromotionStore()
    .getPromotionsRef(graphId, sourceNode.id)
    .find((entry) => entry.widgetName === widgetName)
  if (!fallback) return undefined

  return {
    hostNode: sourceNode,
    nodeId: fallback.interiorNodeId,
    widgetName: fallback.widgetName
  }
}

function resolveViaInputLink(
  hostNode: SubgraphNode,
  nodeId: string,
  widgetName: string
): { hostNode: SubgraphNode; nodeId: string; widgetName: string } | undefined {
  const sourceNode = hostNode.subgraph.getNodeById(nodeId)
  if (!sourceNode?.isSubgraphNode?.()) return undefined

  const fallbackMatches: Array<{
    hostNode: SubgraphNode
    nodeId: string
    widgetName: string
    score: number
  }> = []

  for (const sourceSlot of sourceNode.subgraph.inputNode.slots) {
    for (const linkId of sourceSlot.linkIds) {
      const link = sourceNode.subgraph.getLink(linkId)
      if (!link) continue

      const { inputNode } = link.resolve(sourceNode.subgraph)
      if (!inputNode) continue

      const targetInput = inputNode.inputs.find(
        (input) => input.link === linkId
      )
      if (!targetInput) continue

      const targetWidget = inputNode.getWidgetFromSlot(targetInput)
      if (!targetWidget) continue

      let score = 0
      if (sourceSlot.name === widgetName) score = 3
      if (targetWidget.name === widgetName) score = Math.max(score, 2)
      if (
        isPromotedWidgetView(targetWidget) &&
        targetWidget.sourceWidgetName === widgetName
      ) {
        score = Math.max(score, 2)
      }

      if (score === 0) continue

      if (isPromotedWidgetView(targetWidget)) {
        fallbackMatches.push({
          hostNode: targetWidget.node,
          nodeId: targetWidget.sourceNodeId,
          widgetName: targetWidget.sourceWidgetName,
          score
        })
        continue
      }

      fallbackMatches.push({
        hostNode: sourceNode,
        nodeId: String(inputNode.id),
        widgetName: targetWidget.name,
        score
      })
    }
  }

  if (fallbackMatches.length === 0) return undefined
  fallbackMatches.sort((a, b) => b.score - a.score)
  const bestMatch = fallbackMatches[0]
  return {
    hostNode: bestMatch.hostNode,
    nodeId: bestMatch.nodeId,
    widgetName: bestMatch.widgetName
  }
}

function resolveNestedFallback(
  graphId: string,
  hostNode: SubgraphNode,
  nodeId: string,
  widgetName: string
): { hostNode: SubgraphNode; nodeId: string; widgetName: string } | undefined {
  return (
    resolveViaPromotionStore(graphId, hostNode, nodeId, widgetName) ??
    resolveViaInputLink(hostNode, nodeId, widgetName)
  )
}

function resolveConcrete(
  subgraphNode: SubgraphNode,
  graphId: string,
  nodeId: string,
  widgetName: string
): { node: LGraphNode; widget: IBaseWidget } | undefined {
  const visited = new Set<string>()
  let currentHost = subgraphNode
  let currentNodeId = nodeId
  let currentWidgetName = widgetName

  while (true) {
    const key = `${currentHost.id}:${currentNodeId}:${currentWidgetName}`
    if (visited.has(key)) break
    visited.add(key)

    const current = resolve(currentHost, currentNodeId, currentWidgetName)
    if (current) {
      if (!isPromotedWidgetView(current.widget)) return current

      currentHost = current.widget.node
      currentNodeId = current.widget.sourceNodeId
      currentWidgetName = current.widget.sourceWidgetName
      continue
    }

    const promotedFallback = resolveNestedFallback(
      graphId,
      currentHost,
      currentNodeId,
      currentWidgetName
    )
    if (!promotedFallback) break

    currentHost = promotedFallback.hostNode
    currentNodeId = promotedFallback.nodeId
    currentWidgetName = promotedFallback.widgetName
  }

  return undefined
}

function isWidgetValue(value: unknown): value is IBaseWidget['value'] {
  if (value === undefined) return true
  if (typeof value === 'string') return true
  if (typeof value === 'number') return true
  if (typeof value === 'boolean') return true
  return value !== null && typeof value === 'object'
}

type LegacyMouseWidget = IBaseWidget & {
  mouse: (e: CanvasPointerEvent, pos: Point, node: LGraphNode) => unknown
}

function hasLegacyMouse(widget: IBaseWidget): widget is LegacyMouseWidget {
  return 'mouse' in widget && typeof widget.mouse === 'function'
}

export function createPromotedWidgetView(
  subgraphNode: SubgraphNode,
  nodeId: string,
  widgetName: string,
  displayName?: string
): IPromotedWidgetView {
  return new PromotedWidgetView(subgraphNode, nodeId, widgetName, displayName)
}

class PromotedWidgetView implements IPromotedWidgetView {
  [symbol: symbol]: boolean

  readonly sourceNodeId: string
  readonly sourceWidgetName: string

  readonly serialize = false

  last_y?: number
  computedHeight?: number

  private readonly graphId: string
  private yValue = 0

  private projectedSourceNode?: LGraphNode
  private projectedSourceWidget?: IBaseWidget
  private projectedSourceWidgetType?: IBaseWidget['type']
  private projectedWidget?: BaseWidget

  constructor(
    private readonly subgraphNode: SubgraphNode,
    nodeId: string,
    widgetName: string,
    private readonly displayName?: string
  ) {
    this.sourceNodeId = nodeId
    this.sourceWidgetName = widgetName
    this.graphId = subgraphNode.rootGraph.id
  }

  get node(): SubgraphNode {
    return this.subgraphNode
  }

  get name(): string {
    return this.displayName ?? this.sourceWidgetName
  }

  get y(): number {
    return this.yValue
  }

  set y(value: number) {
    this.yValue = value
    this.syncDomOverride()
  }

  get computedDisabled(): false {
    return false
  }

  set computedDisabled(_value: boolean | undefined) {}

  get type(): IBaseWidget['type'] {
    return this.resolveConcrete()?.widget.type ?? 'button'
  }

  get options(): IBaseWidget['options'] {
    return this.resolveConcrete()?.widget.options ?? {}
  }

  get tooltip(): string | undefined {
    return this.resolveConcrete()?.widget.tooltip
  }

  get linkedWidgets(): IBaseWidget[] | undefined {
    return this.resolveConcrete()?.widget.linkedWidgets
  }

  get value(): IBaseWidget['value'] {
    const state = this.getWidgetState()
    if (state && isWidgetValue(state.value)) return state.value
    return this.resolve()?.widget.value
  }

  set value(value: IBaseWidget['value']) {
    const state = this.getWidgetState()
    if (state) {
      state.value = value
      return
    }

    const resolved = this.resolve()
    if (resolved && isWidgetValue(value)) {
      resolved.widget.value = value
    }
  }

  get label(): string | undefined {
    const state = this.getWidgetState()
    return state?.label ?? this.displayName ?? this.sourceWidgetName
  }

  set label(value: string | undefined) {
    const state = this.getWidgetState()
    if (state) state.label = value
  }

  get hidden(): boolean {
    return this.resolveConcrete()?.widget.hidden ?? false
  }

  get computeLayoutSize(): IBaseWidget['computeLayoutSize'] {
    const resolved = this.resolveConcrete()
    const computeLayoutSize = resolved?.widget.computeLayoutSize
    if (!computeLayoutSize) return undefined
    return (node: LGraphNode) => computeLayoutSize.call(resolved.widget, node)
  }

  get computeSize(): IBaseWidget['computeSize'] {
    const resolved = this.resolveConcrete()
    const computeSize = resolved?.widget.computeSize
    if (!computeSize) return undefined
    return (width?: number) => computeSize.call(resolved.widget, width)
  }

  draw(
    ctx: CanvasRenderingContext2D,
    _node: LGraphNode,
    widgetWidth: number,
    y: number,
    H: number,
    lowQuality?: boolean
  ): void {
    const resolved = this.resolveConcrete()
    if (!resolved) {
      drawDisconnectedPlaceholder(ctx, widgetWidth, y, H)
      return
    }

    if (isBaseDOMWidget(resolved.widget)) return this.syncDomOverride(resolved)

    const projected = this.getProjectedWidget(resolved)
    if (!projected || typeof projected.drawWidget !== 'function') return

    const originalY = projected.y
    const originalComputedHeight = projected.computedHeight
    const originalComputedDisabled = projected.computedDisabled

    projected.y = this.y
    projected.computedHeight = this.computedHeight
    projected.computedDisabled = this.computedDisabled
    projected.value = this.value

    projected.drawWidget(ctx, {
      width: widgetWidth,
      showText: !lowQuality,
      suppressPromotedOutline: true,
      previewImages: resolved.node.imgs
    })

    projected.y = originalY
    projected.computedHeight = originalComputedHeight
    projected.computedDisabled = originalComputedDisabled
  }

  onPointerDown(
    pointer: CanvasPointer,
    _node: LGraphNode,
    canvas: LGraphCanvas
  ): boolean {
    const resolved = this.resolve()
    if (!resolved) return false

    const interior = resolved.widget
    if (typeof interior.onPointerDown === 'function') {
      const handled = interior.onPointerDown(pointer, this.subgraphNode, canvas)
      if (handled) return true
    }

    const concrete = toConcreteWidget(interior, this.subgraphNode, false)
    if (concrete)
      return this.bindConcretePointerHandlers(pointer, canvas, concrete)

    if (hasLegacyMouse(interior))
      return this.handleLegacyMouse(pointer, interior)

    return false
  }

  callback(
    value: unknown,
    canvas?: LGraphCanvas,
    node?: LGraphNode,
    pos?: Point,
    e?: CanvasPointerEvent
  ) {
    this.resolve()?.widget.callback?.(value, canvas, node, pos, e)
  }

  private resolve(): { node: LGraphNode; widget: IBaseWidget } | undefined {
    return resolve(this.subgraphNode, this.sourceNodeId, this.sourceWidgetName)
  }

  private resolveConcrete():
    | { node: LGraphNode; widget: IBaseWidget }
    | undefined {
    return resolveConcrete(
      this.subgraphNode,
      this.graphId,
      this.sourceNodeId,
      this.sourceWidgetName
    )
  }

  private getWidgetState() {
    const lookupTarget = this.resolveStateLookupTarget()
    return useWidgetValueStore().getWidget(
      this.graphId,
      lookupTarget.nodeId,
      lookupTarget.widgetName
    )
  }

  private resolveStateLookupTarget(): { nodeId: NodeId; widgetName: string } {
    let currentHost = this.subgraphNode
    let currentNodeId = this.sourceNodeId
    let currentWidgetName = this.sourceWidgetName
    const visited = new Set<string>()

    while (true) {
      const visitKey = `${currentHost.id}:${currentNodeId}:${currentWidgetName}`
      if (visited.has(visitKey)) break
      visited.add(visitKey)

      const resolved = resolve(currentHost, currentNodeId, currentWidgetName)
      if (resolved) {
        if (!isPromotedWidgetView(resolved.widget)) break

        currentHost = resolved.widget.node
        currentNodeId = resolved.widget.sourceNodeId
        currentWidgetName = resolved.widget.sourceWidgetName
        continue
      }

      const promotedFallback = resolveNestedFallback(
        this.graphId,
        currentHost,
        currentNodeId,
        currentWidgetName
      )
      if (!promotedFallback) break

      currentHost = promotedFallback.hostNode
      currentNodeId = promotedFallback.nodeId
      currentWidgetName = promotedFallback.widgetName
    }

    return {
      nodeId: stripGraphPrefix(currentNodeId),
      widgetName: currentWidgetName
    }
  }

  private getProjectedWidget(resolved: {
    node: LGraphNode
    widget: IBaseWidget
  }): BaseWidget | undefined {
    const shouldRebuild =
      !this.projectedWidget ||
      this.projectedSourceNode !== resolved.node ||
      this.projectedSourceWidget !== resolved.widget ||
      this.projectedSourceWidgetType !== resolved.widget.type

    if (!shouldRebuild) return this.projectedWidget

    const concrete = toConcreteWidget(resolved.widget, resolved.node, false)
    if (!concrete) {
      this.projectedWidget = undefined
      this.projectedSourceNode = undefined
      this.projectedSourceWidget = undefined
      this.projectedSourceWidgetType = undefined
      return undefined
    }

    this.projectedWidget = concrete.createCopyForNode(this.subgraphNode)
    this.projectedSourceNode = resolved.node
    this.projectedSourceWidget = resolved.widget
    this.projectedSourceWidgetType = resolved.widget.type
    return this.projectedWidget
  }

  private bindConcretePointerHandlers(
    pointer: CanvasPointer,
    canvas: LGraphCanvas,
    concrete: BaseWidget
  ): boolean {
    const downEvent = pointer.eDown
    if (!downEvent) return false

    pointer.onClick = () =>
      concrete.onClick({
        e: downEvent,
        node: this.subgraphNode,
        canvas
      })
    pointer.onDrag = (eMove) =>
      concrete.onDrag?.({
        e: eMove,
        node: this.subgraphNode,
        canvas
      })
    return true
  }

  private handleLegacyMouse(
    pointer: CanvasPointer,
    interior: LegacyMouseWidget
  ): boolean {
    const downEvent = pointer.eDown
    if (!downEvent) return false

    const downPosition: Point = [
      downEvent.canvasX - this.subgraphNode.pos[0],
      downEvent.canvasY - this.subgraphNode.pos[1]
    ]
    interior.mouse(downEvent, downPosition, this.subgraphNode)

    pointer.finally = () => {
      const upEvent = pointer.eUp
      if (!upEvent) return

      const upPosition: Point = [
        upEvent.canvasX - this.subgraphNode.pos[0],
        upEvent.canvasY - this.subgraphNode.pos[1]
      ]
      interior.mouse(upEvent, upPosition, this.subgraphNode)
    }

    return true
  }

  private syncDomOverride(
    resolved:
      | { node: LGraphNode; widget: IBaseWidget }
      | undefined = this.resolve()
  ) {
    if (!resolved || !isBaseDOMWidget(resolved.widget)) return
    useDomWidgetStore().setPositionOverride(resolved.widget.id, {
      node: this.subgraphNode,
      widget: this
    })
  }
}

/** Checks if a widget is a BaseDOMWidget (DOMWidget or ComponentWidget). */
function isBaseDOMWidget(
  widget: IBaseWidget
): widget is IBaseWidget & { id: string } {
  return 'id' in widget && ('element' in widget || 'component' in widget)
}

function drawDisconnectedPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number,
  H: number
) {
  ctx.save()
  ctx.fillStyle = '#333'
  ctx.fillRect(15, y, width - 30, H)
  ctx.fillStyle = '#999'
  ctx.font = '11px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(t('subgraphStore.disconnected'), width / 2, y + H / 2)
  ctx.restore()
}
