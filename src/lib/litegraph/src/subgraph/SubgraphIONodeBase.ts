import type { EmptySubgraphInput } from "./EmptySubgraphInput"
import type { EmptySubgraphOutput } from "./EmptySubgraphOutput"
import type { Subgraph } from "./Subgraph"
import type { SubgraphInput } from "./SubgraphInput"
import type { SubgraphOutput } from "./SubgraphOutput"
import type { LinkConnector } from "@/canvas/LinkConnector"
import type { DefaultConnectionColors, Hoverable, INodeInputSlot, INodeOutputSlot, Point, Positionable } from "@/interfaces"
import type { NodeId } from "@/LGraphNode"
import type { ExportedSubgraphIONode, Serialisable } from "@/types/serialisation"

import { Rectangle } from "@/infrastructure/Rectangle"
import { type CanvasColour, type CanvasPointer, type CanvasPointerEvent, type IContextMenuValue, LiteGraph } from "@/litegraph"
import { snapPoint } from "@/measure"
import { CanvasItem } from "@/types/globalEnums"

export abstract class SubgraphIONodeBase<TSlot extends SubgraphInput | SubgraphOutput> implements Positionable, Hoverable, Serialisable<ExportedSubgraphIONode> {
  static margin = 10
  static minWidth = 100
  static roundedRadius = 10

  readonly #boundingRect: Rectangle = new Rectangle()

  abstract readonly id: NodeId

  get boundingRect(): Rectangle {
    return this.#boundingRect
  }

  selected: boolean = false
  pinned: boolean = false
  readonly removable = false

  isPointerOver: boolean = false

  abstract readonly emptySlot: EmptySubgraphInput | EmptySubgraphOutput

  get pos() {
    return this.boundingRect.pos
  }

  set pos(value) {
    this.boundingRect.pos = value
  }

  get size() {
    return this.boundingRect.size
  }

  set size(value) {
    this.boundingRect.size = value
  }

  protected get sideLineWidth(): number {
    return this.isPointerOver ? 2.5 : 2
  }

  protected get sideStrokeStyle(): CanvasColour {
    return this.isPointerOver ? "white" : "#efefef"
  }

  abstract readonly slots: TSlot[]
  abstract get allSlots(): TSlot[]

  constructor(
    /** The subgraph that this node belongs to. */
    readonly subgraph: Subgraph,
  ) {}

  move(deltaX: number, deltaY: number): void {
    this.pos[0] += deltaX
    this.pos[1] += deltaY
  }

  /** @inheritdoc */
  snapToGrid(snapTo: number): boolean {
    return this.pinned ? false : snapPoint(this.pos, snapTo)
  }

  abstract onPointerDown(e: CanvasPointerEvent, pointer: CanvasPointer, linkConnector: LinkConnector): void

  // #region Hoverable

  containsPoint(point: Point): boolean {
    return this.boundingRect.containsPoint(point)
  }

  abstract get slotAnchorX(): number

  onPointerMove(e: CanvasPointerEvent): CanvasItem {
    const containsPoint = this.boundingRect.containsXy(e.canvasX, e.canvasY)
    let underPointer = containsPoint ? CanvasItem.SubgraphIoNode : CanvasItem.Nothing

    if (containsPoint) {
      if (!this.isPointerOver) this.onPointerEnter()

      for (const slot of this.allSlots) {
        slot.onPointerMove(e)
        if (slot.isPointerOver) underPointer |= CanvasItem.SubgraphIoSlot
      }
    } else if (this.isPointerOver) {
      this.onPointerLeave()
    }
    return underPointer
  }

  onPointerEnter() {
    this.isPointerOver = true
  }

  onPointerLeave() {
    this.isPointerOver = false

    for (const slot of this.slots) {
      slot.isPointerOver = false
    }
  }

  // #endregion Hoverable

  /**
   * Renames an IO slot in the subgraph.
   * @param slot The slot to rename.
   * @param name The new name for the slot.
   */
  abstract renameSlot(slot: TSlot, name: string): void

  /**
   * Removes an IO slot from the subgraph.
   * @param slot The slot to remove.
   */
  abstract removeSlot(slot: TSlot): void

  /**
   * Gets the slot at a given position in canvas space.
   * @param x The x coordinate of the position.
   * @param y The y coordinate of the position.
   * @returns The slot at the given position, otherwise `undefined`.
   */
  getSlotInPosition(x: number, y: number): TSlot | undefined {
    for (const slot of this.allSlots) {
      if (slot.boundingRect.containsXy(x, y)) {
        return slot
      }
    }
  }

  /**
   * Shows the context menu for an IO slot.
   * @param slot The slot to show the context menu for.
   * @param event The event that triggered the context menu.
   */
  protected showSlotContextMenu(slot: TSlot, event: CanvasPointerEvent): void {
    const options: IContextMenuValue[] = this.#getSlotMenuOptions(slot)
    if (!(options.length > 0)) return

    new LiteGraph.ContextMenu(
      options,
      {
        event: event as any,
        title: slot.name || "Subgraph Output",
        callback: (item: IContextMenuValue) => {
          this.#onSlotMenuAction(item, slot, event)
        },
      },
    )
  }

  /**
   * Gets the context menu options for an IO slot.
   * @param slot The slot to get the context menu options for.
   * @returns The context menu options.
   */
  #getSlotMenuOptions(slot: TSlot): IContextMenuValue[] {
    const options: IContextMenuValue[] = []

    // Disconnect option if slot has connections
    if (slot !== this.emptySlot && slot.linkIds.length > 0) {
      options.push({ content: "Disconnect Links", value: "disconnect" })
    }

    // Remove / rename slot option (except for the empty slot)
    if (slot !== this.emptySlot) {
      options.push(
        { content: "Remove Slot", value: "remove" },
        { content: "Rename Slot", value: "rename" },
      )
    }

    return options
  }

  /**
   * Handles the action for an IO slot context menu.
   * @param selectedItem The item that was selected from the context menu.
   * @param slot The slot
   * @param event The event that triggered the context menu.
   */
  #onSlotMenuAction(selectedItem: IContextMenuValue, slot: TSlot, event: CanvasPointerEvent): void {
    switch (selectedItem.value) {
    // Disconnect all links from this output
    case "disconnect":
      slot.disconnect()
      break

    // Remove the slot
    case "remove":
      if (slot !== this.emptySlot) {
        this.removeSlot(slot)
      }
      break

    // Rename the slot
    case "rename":
      if (slot !== this.emptySlot) {
        this.subgraph.canvasAction(c => c.prompt(
          "Slot name",
          slot.name,
          (newName: string) => {
            if (newName) this.renameSlot(slot, newName)
          },
          event,
        ))
      }
      break
    }

    this.subgraph.setDirtyCanvas(true)
  }

  /** Arrange the slots in this node. */
  arrange(): void {
    const { minWidth, roundedRadius } = SubgraphIONodeBase
    const [, y] = this.boundingRect
    const x = this.slotAnchorX
    const { size } = this

    let maxWidth = minWidth
    let currentY = y + roundedRadius

    for (const slot of this.allSlots) {
      const [slotWidth, slotHeight] = slot.measure()
      slot.arrange([x, currentY, slotWidth, slotHeight])

      currentY += slotHeight
      if (slotWidth > maxWidth) maxWidth = slotWidth
    }

    size[0] = maxWidth + 2 * roundedRadius
    size[1] = currentY - y + roundedRadius
  }

  draw(ctx: CanvasRenderingContext2D, colorContext: DefaultConnectionColors, fromSlot?: INodeInputSlot | INodeOutputSlot | SubgraphInput | SubgraphOutput, editorAlpha?: number): void {
    const { lineWidth, strokeStyle, fillStyle, font, textBaseline } = ctx
    this.drawProtected(ctx, colorContext, fromSlot, editorAlpha)
    Object.assign(ctx, { lineWidth, strokeStyle, fillStyle, font, textBaseline })
  }

  /** @internal Leaves {@link ctx} dirty. */
  protected abstract drawProtected(ctx: CanvasRenderingContext2D, colorContext: DefaultConnectionColors, fromSlot?: INodeInputSlot | INodeOutputSlot | SubgraphInput | SubgraphOutput, editorAlpha?: number): void

  /** @internal Leaves {@link ctx} dirty. */
  protected drawSlots(ctx: CanvasRenderingContext2D, colorContext: DefaultConnectionColors, fromSlot?: INodeInputSlot | INodeOutputSlot | SubgraphInput | SubgraphOutput, editorAlpha?: number): void {
    ctx.fillStyle = "#AAA"
    ctx.font = "12px Arial"
    ctx.textBaseline = "middle"

    for (const slot of this.allSlots) {
      slot.draw({ ctx, colorContext, fromSlot, editorAlpha })
    }
  }

  configure(data: ExportedSubgraphIONode): void {
    this.#boundingRect.set(data.bounding)
    this.pinned = data.pinned ?? false
  }

  asSerialisable(): ExportedSubgraphIONode {
    return {
      id: this.id,
      bounding: this.boundingRect.export(),
      pinned: this.pinned ? true : undefined,
    }
  }
}
