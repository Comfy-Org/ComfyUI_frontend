import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { Point } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  DrawWidgetOptions,
  WidgetEventOptions
} from '@/lib/litegraph/src/widgets/BaseWidget'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'

type WidgetValue = IBaseWidget['value']

/**
 * A lightweight widget slot for canvas rendering of promoted subgraph widgets.
 *
 * Unlike the old ProxyWidget (a JavaScript Proxy), this is a plain class that
 * implements IBaseWidget. It owns positional state (y, last_y, width) and
 * delegates value/type/drawing to the resolved interior widget via the
 * WidgetValueStore.
 *
 * When the interior node/widget no longer exists (disconnected state),
 * it renders a "Disconnected" placeholder.
 */
export class PromotedWidgetSlot
  extends BaseWidget<IBaseWidget>
  implements IBaseWidget
{
  readonly sourceNodeId: NodeId
  readonly sourceWidgetName: string
  private readonly subgraphNode: SubgraphNode

  constructor(
    subgraphNode: SubgraphNode,
    sourceNodeId: NodeId,
    sourceWidgetName: string
  ) {
    const name = `${sourceNodeId}: ${sourceWidgetName}`
    super(
      {
        name,
        type: 'button',
        value: undefined,
        options: {},
        y: 0,
        serialize: false
      },
      subgraphNode
    )
    this.sourceNodeId = sourceNodeId
    this.sourceWidgetName = sourceWidgetName
    this.subgraphNode = subgraphNode

    // BaseWidget constructor assigns `this.type` as an own data property,
    // which shadows our prototype getter. Delete it so our getter is used.
    delete (this as Record<string, unknown>).type
  }

  private resolve(): {
    node: LGraphNode
    widget: IBaseWidget
  } | null {
    const node = this.subgraphNode.subgraph.getNodeById(this.sourceNodeId)
    if (!node) return null
    const widget = node.widgets?.find((w) => w.name === this.sourceWidgetName)
    if (!widget) return null
    return { node, widget }
  }

  /**
   * Resolves to the interior widget's type, or 'button' if disconnected.
   * Uses defineProperty to dynamically override the `type` field set by BaseWidget.
   */
  get resolvedType(): string {
    return this.resolve()?.widget.type ?? 'button'
  }

  override get value(): WidgetValue {
    const store = useWidgetValueStore()
    const state = store.getWidget(
      stripGraphPrefix(this.sourceNodeId),
      this.sourceWidgetName
    )
    return state?.value as WidgetValue
  }

  override set value(v: WidgetValue) {
    const resolved = this.resolve()
    if (resolved) {
      resolved.widget.value = v
    }
  }

  override get label(): string | undefined {
    const store = useWidgetValueStore()
    const state = store.getWidget(
      stripGraphPrefix(this.sourceNodeId),
      this.sourceWidgetName
    )
    return state?.label ?? this.name
  }

  override get promoted(): boolean {
    return true
  }

  override get outline_color(): string {
    return LiteGraph.WIDGET_PROMOTED_OUTLINE_COLOR
  }

  override get _displayValue(): string {
    if (this.computedDisabled) return ''
    const v = this.value
    return v != null ? String(v) : ''
  }

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    const resolved = this.resolve()
    if (!resolved) {
      this.drawDisconnectedPlaceholder(ctx, options)
      return
    }

    const concrete = toConcreteWidget(resolved.widget, resolved.node, false)
    if (concrete) {
      const origY = concrete.y
      const origLastY = concrete.last_y
      concrete.y = this.y
      concrete.last_y = this.last_y
      concrete.drawWidget(ctx, options)
      concrete.y = origY
      concrete.last_y = origLastY
    } else {
      this.drawWidgetShape(ctx, options)
      if (options.showText !== false) {
        this.drawTruncatingText({
          ctx,
          ...options,
          leftPadding: 0,
          rightPadding: 0
        })
      }
    }
  }

  private drawDisconnectedPlaceholder(
    ctx: CanvasRenderingContext2D,
    { width, showText }: DrawWidgetOptions
  ): void {
    ctx.save()
    this.drawWidgetShape(ctx, { width, showText })
    if (showText) {
      ctx.fillStyle = LiteGraph.WIDGET_DISABLED_TEXT_COLOR
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Disconnected', width / 2, this.y + this.height / 2)
    }
    ctx.restore()
  }

  onClick(options: WidgetEventOptions): void {
    const resolved = this.resolve()
    if (!resolved) return

    const concrete = toConcreteWidget(resolved.widget, resolved.node, false)
    concrete?.onClick(options)
  }

  override callback(
    value: WidgetValue,
    canvas?: LGraphCanvas,
    _node?: LGraphNode,
    pos?: Point,
    e?: CanvasPointerEvent
  ): void {
    const resolved = this.resolve()
    if (!resolved) return
    resolved.widget.callback?.(value, canvas, resolved.node, pos, e)
  }
}

// Install the dynamic `type` getter via defineProperty on the prototype.
// This avoids the TS2611 error (can't override a property with an accessor).
Object.defineProperty(PromotedWidgetSlot.prototype, 'type', {
  get(this: PromotedWidgetSlot) {
    return this.resolvedType
  },
  configurable: true,
  enumerable: true
})
