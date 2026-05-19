import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { Point } from '@/lib/litegraph/src/interfaces'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { isWidgetValue } from '@/lib/litegraph/src/types/widgets'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import { t } from '@/i18n'
import { nextValueForLinkedTarget } from '@/scripts/valueControl'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import type { WidgetState } from '@/stores/widgetValueStore'
import {
  resolveConcretePromotedWidget,
  resolvePromotedWidgetAtHost
} from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import { matchPromotedInput } from '@/core/graph/subgraph/matchPromotedInput'
import { hasWidgetNode } from '@/core/graph/subgraph/widgetNodeTypeGuard'
import type { WidgetEntityId } from '@/world/entityIds'
import { widgetEntityId } from '@/world/entityIds'
import { ensureWidgetState, getWidgetState } from '@/world/widgetValueIO'

import { isPromotedWidgetView } from './promotedWidgetTypes'
import type { PromotedWidgetView as IPromotedWidgetView } from './promotedWidgetTypes'

export type { PromotedWidgetView } from './promotedWidgetTypes'
export { isPromotedWidgetView } from './promotedWidgetTypes'

interface SubgraphSlotRef {
  name: string
  label?: string
  displayName?: string
}

type LegacyMouseWidget = IBaseWidget & {
  mouse: (e: CanvasPointerEvent, pos: Point, node: LGraphNode) => unknown
}

function hasLegacyMouse(widget: IBaseWidget): widget is LegacyMouseWidget {
  return 'mouse' in widget && typeof widget.mouse === 'function'
}

const designTokenCache = new Map<string, string>()

export function createPromotedWidgetView(
  subgraphNode: SubgraphNode,
  nodeId: string,
  widgetName: string,
  displayName?: string,
  identityName?: string
): IPromotedWidgetView {
  return new PromotedWidgetView(
    subgraphNode,
    nodeId,
    widgetName,
    displayName,
    identityName
  )
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
  private _computedDisabled = false

  private projectedSourceNode?: LGraphNode
  private projectedSourceWidget?: IBaseWidget
  private projectedSourceWidgetType?: IBaseWidget['type']
  private projectedWidget?: BaseWidget
  private cachedDeepestByFrame?: { node: LGraphNode; widget: IBaseWidget }
  private cachedDeepestFrame = -1

  /** Cached reference to the bound subgraph slot, set at construction. */
  private _boundSlot?: SubgraphSlotRef
  private _boundSlotVersion = -1

  /** Sentinel for the last auto-seeded host value, so re-seed can detect an unedited host state and refresh it from a later interior hydration. */
  private _lastAutoSeededValue?: IBaseWidget['value']

  constructor(
    private readonly subgraphNode: SubgraphNode,
    nodeId: string,
    widgetName: string,
    private readonly displayName?: string,
    private readonly identityName?: string
  ) {
    this.sourceNodeId = nodeId
    this.sourceWidgetName = widgetName
    this.graphId = subgraphNode.rootGraph.id
  }

  get node(): SubgraphNode {
    return this.subgraphNode
  }

  get name(): string {
    return this.identityName ?? this.sourceWidgetName
  }

  /** Host-scoped identity `(host node, subgraph input name)` per ADR 0009; distinct host instances keep independent values. */
  get entityId(): WidgetEntityId {
    return widgetEntityId(this.graphId, this.subgraphNode.id, this.name)
  }

  get y(): number {
    return this.yValue
  }

  set y(value: number) {
    this.yValue = value
    this.syncDomOverride()
  }

  get computedDisabled(): boolean {
    return this._computedDisabled
  }

  set computedDisabled(value: boolean | undefined) {
    this._computedDisabled = value ?? false
  }

  get type(): IBaseWidget['type'] {
    return this.resolveDeepest()?.widget.type ?? 'button'
  }

  get options(): IBaseWidget['options'] {
    return this.resolveDeepest()?.widget.options ?? {}
  }

  get tooltip(): string | undefined {
    return this.resolveDeepest()?.widget.tooltip
  }

  get linkedWidgets(): IBaseWidget[] | undefined {
    return this.resolveDeepest()?.widget.linkedWidgets
  }

  get value(): IBaseWidget['value'] {
    const hostState = this.getHostWidgetState()
    if (hostState && isWidgetValue(hostState.value)) return hostState.value

    const state = this.getWidgetState()
    if (state && isWidgetValue(state.value)) return state.value
    return this.resolveAtHost()?.widget.value
  }

  set value(value: IBaseWidget['value']) {
    this.setHostWidgetState(value)

    const linkedWidgets = this.getLinkedInputWidgets()
    if (linkedWidgets.length > 0) {
      const widgetStore = useWidgetValueStore()
      let didUpdateState = false
      for (const linkedWidget of linkedWidgets) {
        const state = widgetStore.getWidget(
          this.graphId,
          linkedWidget.nodeId,
          linkedWidget.widgetName
        )
        if (state) {
          state.value = value
          didUpdateState = true
        }
      }

      const resolved = this.resolveDeepest()
      if (resolved) {
        const resolvedState = widgetStore.getWidget(
          this.graphId,
          stripGraphPrefix(String(resolved.node.id)),
          resolved.widget.name
        )
        if (resolvedState) {
          resolvedState.value = value
          didUpdateState = true
        }
      }

      if (didUpdateState) return
    }

    const state = this.getWidgetState()
    if (state) {
      state.value = value
      return
    }

    const resolved = this.resolveAtHost()
    if (resolved && isWidgetValue(value)) {
      resolved.widget.value = value
    }
  }

  private getHostWidgetState(): WidgetState | undefined {
    return getWidgetState(this.entityId)
  }

  private setHostWidgetState(value: IBaseWidget['value']): void {
    if (!isWidgetValue(value)) return

    const state = this.getHostWidgetState()
    if (state) {
      state.value = value
      this._lastAutoSeededValue = undefined
      return
    }

    this.registerHostWidgetState(value)
    this._lastAutoSeededValue = undefined
  }

  /** Idempotently seed (and re-seed if interior hydrated later) the host widget state entry that Vue rendering reads. */
  ensureHostWidgetState(): void {
    const fallback = this.fallbackEffectiveValue()
    const existing = this.getHostWidgetState()

    if (existing) {
      if (
        this._lastAutoSeededValue !== undefined &&
        existing.value === this._lastAutoSeededValue &&
        isWidgetValue(fallback) &&
        fallback !== existing.value
      ) {
        existing.value = fallback
        this._lastAutoSeededValue = fallback
      }
      return
    }

    this.registerHostWidgetState(fallback)
    this._lastAutoSeededValue = fallback
  }

  /** Resolves the effective value bypassing host state, so re-seeding can detect a stale host value. */
  private fallbackEffectiveValue(): IBaseWidget['value'] {
    const state = this.getWidgetState()
    if (state && isWidgetValue(state.value)) return state.value
    return this.resolveAtHost()?.widget.value
  }

  private registerHostWidgetState(value: IBaseWidget['value']): void {
    const resolved = this.resolveDeepest()
    ensureWidgetState(this.entityId, {
      type: resolved?.widget.type ?? 'button',
      value,
      // Clone: sharing the interior options ref leaks host mutations across all SubgraphNode instances.
      options: { ...(resolved?.widget.options ?? {}) },
      label: this.displayName,
      serialize: this.serialize,
      disabled: this.computedDisabled
    })
  }

  get label(): string | undefined {
    const slot = this.getBoundSubgraphSlot()
    if (slot) return slot.label ?? slot.displayName ?? slot.name
    // Fall back to persisted widget state (survives save/reload before
    // the slot binding is established) then to construction displayName.
    const state = this.getWidgetState()
    return state?.label ?? this.displayName
  }

  set label(value: string | undefined) {
    const slot = this.getBoundSubgraphSlot()
    if (slot) slot.label = value || undefined
    // Also persist to widget state store for save/reload resilience
    const state = this.getWidgetState()
    if (state) state.label = value
  }

  /** Per-instance hydration that writes only to host state; safe during configure/clone where interior nodes are shared. */
  hydrateHostValue(value: IBaseWidget['value']): void {
    this.setHostWidgetState(value)
  }

  /**
   * Returns the cached bound subgraph slot reference, refreshing only when
   * the subgraph node's input list has changed (length mismatch).
   *
   * Note: Using length as the cache key works because the returned reference
   * is the same mutable slot object. When slot properties (label, name) change,
   * the caller reads fresh values from that reference.  The cache only needs
   * to invalidate when slots are added or removed, which changes length.
   */
  private getBoundSubgraphSlot(): SubgraphSlotRef | undefined {
    const version = this.subgraphNode.inputs?.length ?? 0
    if (this._boundSlotVersion === version) return this._boundSlot

    this._boundSlot = this.findBoundSubgraphSlot()
    this._boundSlotVersion = version
    return this._boundSlot
  }

  private findBoundSubgraphSlot(): SubgraphSlotRef | undefined {
    for (const input of this.subgraphNode.inputs ?? []) {
      const slot = input._subgraphSlot as SubgraphSlotRef | undefined
      if (!slot) continue

      const w = input._widget
      if (
        w &&
        isPromotedWidgetView(w) &&
        w.sourceNodeId === this.sourceNodeId &&
        w.sourceWidgetName === this.sourceWidgetName
      ) {
        return slot
      }
    }
    return undefined
  }

  get hidden(): boolean {
    return this.resolveDeepest()?.widget.hidden ?? false
  }

  get computeLayoutSize(): IBaseWidget['computeLayoutSize'] {
    const resolved = this.resolveDeepest()
    const computeLayoutSize = resolved?.widget.computeLayoutSize
    if (!computeLayoutSize) return undefined
    return (node: LGraphNode) => computeLayoutSize.call(resolved.widget, node)
  }

  get computeSize(): IBaseWidget['computeSize'] {
    const resolved = this.resolveDeepest()
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
    const resolved = this.resolveDeepest()
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

    const originalLabel = projected.label

    projected.y = this.y
    projected.computedHeight = this.computedHeight
    projected.computedDisabled = this.computedDisabled
    projected.value = this.value
    projected.label = this.label

    try {
      projected.drawWidget(ctx, {
        width: widgetWidth,
        showText: !lowQuality,
        previewImages: resolved.node.imgs
      })
    } finally {
      projected.y = originalY
      projected.computedHeight = originalComputedHeight
      projected.computedDisabled = originalComputedDisabled
      projected.label = originalLabel
    }
  }

  onPointerDown(
    pointer: CanvasPointer,
    _node: LGraphNode,
    canvas: LGraphCanvas
  ): boolean {
    const resolved = this.resolveAtHost()
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
    this.resolveAtHost()?.widget.callback?.(value, canvas, node, pos, e)
  }

  // No beforeQueued: linked source widgets are inert for prompt serialization (ADR 0009);
  // control-after-generate is applied to the host value in afterQueued instead.
  afterQueued({
    isPartialExecution
  }: { isPartialExecution?: boolean } = {}): void {
    this.applyValueControlToHost(isPartialExecution)
  }

  private applyValueControlToHost(isPartialExecution?: boolean): void {
    const resolved = this.resolveAtHost()
    const next = nextValueForLinkedTarget({
      target: this,
      linkedWidgets: resolved?.widget.linkedWidgets,
      nodeId: this.subgraphNode.id,
      isPartialExecution
    })
    if (next === undefined) return

    this.hydrateHostValue(next)
  }

  private resolveAtHost():
    | { node: LGraphNode; widget: IBaseWidget }
    | undefined {
    return resolvePromotedWidgetAtHost(
      this.subgraphNode,
      this.sourceNodeId,
      this.sourceWidgetName
    )
  }

  private resolveDeepest():
    | { node: LGraphNode; widget: IBaseWidget }
    | undefined {
    const frame = this.subgraphNode.rootGraph.primaryCanvas?.frame
    if (frame !== undefined && this.cachedDeepestFrame === frame)
      return this.cachedDeepestByFrame

    const result = resolveConcretePromotedWidget(
      this.subgraphNode,
      this.sourceNodeId,
      this.sourceWidgetName
    )
    const resolved = result.status === 'resolved' ? result.resolved : undefined

    if (frame !== undefined) {
      this.cachedDeepestFrame = frame
      this.cachedDeepestByFrame = resolved
    }

    return resolved
  }

  private getWidgetState() {
    const linkedState = this.getLinkedInputWidgetStates()[0]
    if (linkedState) return linkedState

    const resolved = this.resolveDeepest()
    if (!resolved) return undefined
    return useWidgetValueStore().getWidget(
      this.graphId,
      stripGraphPrefix(String(resolved.node.id)),
      resolved.widget.name
    )
  }

  private getLinkedInputWidgets(): Array<{
    nodeId: NodeId
    widgetName: string
    widget: IBaseWidget
  }> {
    const linkedInputSlot = this.subgraphNode.inputs.find((input) => {
      if (!input._subgraphSlot) return false
      if (matchPromotedInput([input], this) !== input) return false

      const boundWidget = input._widget
      if (boundWidget === this) return true

      if (boundWidget && isPromotedWidgetView(boundWidget)) {
        return (
          boundWidget.sourceNodeId === this.sourceNodeId &&
          boundWidget.sourceWidgetName === this.sourceWidgetName
        )
      }

      return input._subgraphSlot
        .getConnectedWidgets()
        .filter(hasWidgetNode)
        .some(
          (widget) =>
            String(widget.node.id) === this.sourceNodeId &&
            widget.name === this.sourceWidgetName
        )
    })
    const linkedInput = linkedInputSlot?._subgraphSlot
    if (!linkedInput) return []

    return linkedInput
      .getConnectedWidgets()
      .filter(hasWidgetNode)
      .map((widget) => ({
        nodeId: stripGraphPrefix(String(widget.node.id)),
        widgetName: widget.name,
        widget
      }))
  }

  private getLinkedInputWidgetStates(): WidgetState[] {
    const widgetStore = useWidgetValueStore()

    return this.getLinkedInputWidgets()
      .map(({ nodeId, widgetName }) =>
        widgetStore.getWidget(this.graphId, nodeId, widgetName)
      )
      .filter((state): state is WidgetState => state !== undefined)
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
      | undefined = this.resolveAtHost()
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
  const backgroundColor = readDesignToken(
    '--color-secondary-background',
    '#333'
  )
  const textColor = readDesignToken('--color-text-secondary', '#999')
  const fontSize = readDesignToken('--text-2xs', '11px')
  const fontFamily = readDesignToken('--font-inter', 'sans-serif')

  ctx.save()
  ctx.fillStyle = backgroundColor
  ctx.fillRect(15, y, width - 30, H)
  ctx.fillStyle = textColor
  ctx.font = `${fontSize} ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(t('subgraphStore.disconnected'), width / 2, y + H / 2)
  ctx.restore()
}

function readDesignToken(token: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback

  const cachedValue = designTokenCache.get(token)
  if (cachedValue) return cachedValue

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim()
  const resolvedValue = value || fallback
  designTokenCache.set(token, resolvedValue)
  return resolvedValue
}
