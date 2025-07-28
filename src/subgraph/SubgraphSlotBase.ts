import type { SubgraphInputNode } from "./SubgraphInputNode"
import type { SubgraphOutputNode } from "./SubgraphOutputNode"
import type { DefaultConnectionColors, Hoverable, INodeInputSlot, INodeOutputSlot, Point, ReadOnlyRect, ReadOnlySize } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"
import type { LinkId, LLink } from "@/LLink"
import type { RerouteId } from "@/Reroute"
import type { CanvasPointerEvent } from "@/types/events"
import type { Serialisable, SubgraphIO } from "@/types/serialisation"

import { SlotShape } from "@/draw"
import { ConstrainedSize } from "@/infrastructure/ConstrainedSize"
import { Rectangle } from "@/infrastructure/Rectangle"
import { LGraphCanvas } from "@/LGraphCanvas"
import { LiteGraph } from "@/litegraph"
import { SlotBase } from "@/node/SlotBase"
import { createUuidv4, type UUID } from "@/utils/uuid"

export interface SubgraphSlotDrawOptions {
  ctx: CanvasRenderingContext2D
  colorContext: DefaultConnectionColors
  lowQuality?: boolean
}

/** Shared base class for the slots used on Subgraph . */
export abstract class SubgraphSlot extends SlotBase implements SubgraphIO, Hoverable, Serialisable<SubgraphIO> {
  static get defaultHeight() {
    return LiteGraph.NODE_SLOT_HEIGHT
  }

  readonly #pos: Point = new Float32Array(2)

  readonly measurement: ConstrainedSize = new ConstrainedSize(SubgraphSlot.defaultHeight, SubgraphSlot.defaultHeight)

  readonly id: UUID
  readonly parent: SubgraphInputNode | SubgraphOutputNode
  override type: string

  readonly linkIds: LinkId[] = []

  override readonly boundingRect: Rectangle = new Rectangle(0, 0, 0, SubgraphSlot.defaultHeight)

  override get pos() {
    return this.#pos
  }

  override set pos(value) {
    if (!value || value.length < 2) return

    this.#pos[0] = value[0]
    this.#pos[1] = value[1]
  }

  /** Whether this slot is connected to another slot. */
  override get isConnected() {
    return this.linkIds.length > 0
  }

  /** The display name of this slot. */
  get displayName() {
    return this.label ?? this.localized_name ?? this.name
  }

  abstract get labelPos(): Point

  constructor(slot: SubgraphIO, parent: SubgraphInputNode | SubgraphOutputNode) {
    super(slot.name, slot.type)

    Object.assign(this, slot)
    this.id = slot.id ?? createUuidv4()
    this.type = slot.type
    this.parent = parent
  }

  isPointerOver: boolean = false

  containsPoint(point: Point): boolean {
    return this.boundingRect.containsPoint(point)
  }

  onPointerMove(e: CanvasPointerEvent): void {
    this.isPointerOver = this.boundingRect.containsXy(e.canvasX, e.canvasY)
  }

  getLinks(): LLink[] {
    const links: LLink[] = []
    const { subgraph } = this.parent

    for (const id of this.linkIds) {
      const link = subgraph.getLink(id)
      if (link) links.push(link)
    }
    return links
  }

  decrementSlots(inputsOrOutputs: "inputs" | "outputs"): void {
    const { links } = this.parent.subgraph
    const linkProperty = inputsOrOutputs === "inputs" ? "origin_slot" : "target_slot"

    for (const linkId of this.linkIds) {
      const link = links.get(linkId)
      if (link) link[linkProperty]--
      else console.warn("decrementSlots: link ID not found", linkId)
    }
  }

  measure(): ReadOnlySize {
    const width = LGraphCanvas._measureText?.(this.displayName) ?? 0

    const { defaultHeight } = SubgraphSlot
    this.measurement.setValues(width + defaultHeight, defaultHeight)
    return this.measurement.toSize()
  }

  abstract arrange(rect: ReadOnlyRect): void

  abstract connect(
    slot: INodeInputSlot | INodeOutputSlot,
    node: LGraphNode,
    afterRerouteId?: RerouteId,
  ): LLink | undefined

  /**
   * Disconnects all links connected to this slot.
   */
  disconnect(): void {
    const { subgraph } = this.parent

    for (const linkId of this.linkIds) {
      subgraph.removeLink(linkId)
    }

    this.linkIds.length = 0
  }

  /** @remarks Leaves the context dirty. */
  drawLabel(ctx: CanvasRenderingContext2D): void {
    if (!this.displayName) return

    const [x, y] = this.labelPos
    ctx.fillStyle = this.isPointerOver ? "white" : "#AAA"

    ctx.fillText(this.displayName, x, y)
  }

  /** @remarks Leaves the context dirty. */
  draw({ ctx, colorContext, lowQuality }: SubgraphSlotDrawOptions): void {
    // Assertion: SlotShape is a subset of RenderShape
    const shape = this.shape as unknown as SlotShape
    const { isPointerOver, pos: [x, y] } = this

    ctx.beginPath()

    // Default rendering for circle, hollow circle.
    const color = this.renderingColor(colorContext)
    if (lowQuality) {
      ctx.fillStyle = color

      ctx.rect(x - 4, y - 4, 8, 8)
      ctx.fill()
    } else if (shape === SlotShape.HollowCircle) {
      ctx.lineWidth = 3
      ctx.strokeStyle = color

      const radius = isPointerOver ? 4 : 3
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      // Normal circle
      ctx.fillStyle = color

      const radius = isPointerOver ? 5 : 4
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  asSerialisable(): SubgraphIO {
    const { id, name, type, linkIds, localized_name, label, dir, shape, color_off, color_on, pos } = this
    return { id, name, type, linkIds, localized_name, label, dir, shape, color_off, color_on, pos }
  }
}
