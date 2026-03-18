import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type {
  DefaultConnectionColors,
  Hoverable,
  INodeInputSlot,
  INodeOutputSlot,
  Point,
  Positionable
} from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  CanvasColour,
  CanvasPointer,
  CanvasPointerEvent,
  IContextMenuValue
} from '@/lib/litegraph/src/litegraph'
import { snapPoint } from '@/lib/litegraph/src/measure'
import { CanvasItem } from '@/lib/litegraph/src/types/globalEnums'
import type {
  ExportedSubgraphIONode,
  Serialisable
} from '@/lib/litegraph/src/types/serialisation'

import type { EmptySubgraphInput } from './EmptySubgraphInput'
import type { EmptySubgraphOutput } from './EmptySubgraphOutput'
import type { Subgraph } from './Subgraph'
import type { SubgraphInput } from './SubgraphInput'
import type { SubgraphOutput } from './SubgraphOutput'

interface SlotMeasurement<TSlot> {
  slot: TSlot
  width: number
  height: number
}

interface SlotReorderDragState<TSlot> {
  draggedSlot: TSlot
  fromIndex: number
  toIndex: number
  cursorY: number
  grabOffsetY: number
  rowHeight: number
  slotHeight: number
  gapTop: number
}

export abstract class SubgraphIONodeBase<
  TSlot extends SubgraphInput | SubgraphOutput
>
  implements Positionable, Hoverable, Serialisable<ExportedSubgraphIONode>
{
  static margin = 10
  static minWidth = 100
  static roundedRadius = 14 // Matches NODE_SLOT_HEIGHT * 0.7 for slot alignment

  private readonly _boundingRect: Rectangle = new Rectangle()

  abstract readonly id: NodeId

  get boundingRect(): Rectangle {
    return this._boundingRect
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
    return this.isPointerOver ? 'white' : '#efefef'
  }

  abstract readonly slots: TSlot[]
  abstract get allSlots(): TSlot[]
  protected abstract reorderSlot(fromIndex: number, toIndex: number): void

  protected reorderDragState?: SlotReorderDragState<TSlot>

  constructor(
    /** The subgraph that this node belongs to. */
    readonly subgraph: Subgraph
  ) {}

  move(deltaX: number, deltaY: number): void {
    this.pos[0] += deltaX
    this.pos[1] += deltaY
  }

  /** @inheritdoc */
  snapToGrid(snapTo: number): boolean {
    return this.pinned ? false : snapPoint(this.pos, snapTo)
  }

  abstract onPointerDown(
    e: CanvasPointerEvent,
    pointer: CanvasPointer,
    linkConnector: LinkConnector
  ): void

  // #region Hoverable

  containsPoint(point: Point): boolean {
    return this.boundingRect.containsPoint(point)
  }

  abstract get slotAnchorX(): number

  protected get pinHitAreaWidth(): number {
    return 12
  }

  onPointerMove(e: CanvasPointerEvent): CanvasItem {
    const containsPoint = this.boundingRect.containsXy(e.canvasX, e.canvasY)
    let underPointer = containsPoint
      ? CanvasItem.SubgraphIoNode
      : CanvasItem.Nothing

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
   * Handles double-click on an IO slot to rename it.
   * @param slot The slot that was double-clicked.
   * @param event The event that triggered the double-click.
   */
  protected handleSlotDoubleClick(
    slot: TSlot,
    event: CanvasPointerEvent
  ): void {
    // Only allow renaming non-empty slots
    if (slot !== this.emptySlot) {
      this._promptForSlotRename(slot, event)
    }
  }

  /**
   * Shows the context menu for an IO slot.
   * @param slot The slot to show the context menu for.
   * @param event The event that triggered the context menu.
   */
  protected showSlotContextMenu(slot: TSlot, event: CanvasPointerEvent): void {
    const options: (IContextMenuValue | null)[] = this._getSlotMenuOptions(slot)
    if (!(options.length > 0)) return

    new LiteGraph.ContextMenu(options, {
      event,
      title: slot.name || 'Subgraph Output',
      callback: (item: IContextMenuValue) => {
        this._onSlotMenuAction(item, slot, event)
      }
    })
  }

  /**
   * Gets the context menu options for an IO slot.
   * @param slot The slot to get the context menu options for.
   * @returns The context menu options.
   */
  private _getSlotMenuOptions(slot: TSlot): (IContextMenuValue | null)[] {
    const options: (IContextMenuValue | null)[] = []

    // Disconnect option if slot has connections
    if (slot !== this.emptySlot && slot.linkIds.length > 0) {
      options.push({ content: 'Disconnect Links', value: 'disconnect' })
    }

    // Rename slot option (except for the empty slot)
    if (slot !== this.emptySlot) {
      options.push({ content: 'Rename Slot', value: 'rename' })
    }

    if (slot !== this.emptySlot) {
      options.push(null) // separator
      options.push({
        content: 'Remove Slot',
        value: 'remove',
        className: 'danger'
      })
    }

    return options
  }

  /**
   * Handles the action for an IO slot context menu.
   * @param selectedItem The item that was selected from the context menu.
   * @param slot The slot
   * @param event The event that triggered the context menu.
   */
  private _onSlotMenuAction(
    selectedItem: IContextMenuValue,
    slot: TSlot,
    event: CanvasPointerEvent
  ): void {
    switch (selectedItem.value) {
      // Disconnect all links from this output
      case 'disconnect':
        slot.disconnect()
        break

      // Remove the slot
      case 'remove':
        if (slot !== this.emptySlot) {
          this.removeSlot(slot)
        }
        break

      // Rename the slot
      case 'rename':
        if (slot !== this.emptySlot) {
          this._promptForSlotRename(slot, event)
        }
        break
    }

    this.subgraph.setDirtyCanvas(true)
  }

  /**
   * Prompts the user to rename a slot.
   * @param slot The slot to rename.
   * @param event The event that triggered the rename.
   */
  private _promptForSlotRename(slot: TSlot, event: CanvasPointerEvent): void {
    this.subgraph.canvasAction((c) =>
      c.prompt(
        'Slot name',
        slot.displayName,
        (newName: string) => {
          if (newName) this.renameSlot(slot, newName)
        },
        event
      )
    )
  }

  protected isConnectionDragHit(slot: TSlot, canvasX: number): boolean {
    return Math.abs(canvasX - slot.pos[0]) <= this.pinHitAreaWidth
  }

  protected startSlotReorderDrag(slot: TSlot, cursorY: number): boolean {
    const fromIndex = this.slots.indexOf(slot)
    if (fromIndex === -1) return false

    const [, slotHeight] = slot.measure()
    const slotTop = slot.boundingRect[1]
    const rowHeight = slot.boundingRect[3] || slotHeight

    this.reorderDragState = {
      draggedSlot: slot,
      fromIndex,
      toIndex: fromIndex,
      cursorY,
      grabOffsetY: cursorY - slotTop,
      rowHeight,
      slotHeight,
      gapTop: slotTop
    }

    this.subgraph.setDirtyCanvas(true, true)
    return true
  }

  protected updateSlotReorderDrag(cursorY: number): void {
    const dragState = this.reorderDragState
    if (!dragState) return

    dragState.cursorY = cursorY
    dragState.toIndex = this._getSlotInsertIndex(cursorY, dragState.rowHeight)
    this.subgraph.setDirtyCanvas(true, true)
  }

  protected finishSlotReorderDrag():
    | {
        fromIndex: number
        toIndex: number
      }
    | undefined {
    const dragState = this.reorderDragState
    if (!dragState) return

    this.reorderDragState = undefined
    this.subgraph.setDirtyCanvas(true, true)

    return {
      fromIndex: dragState.fromIndex,
      toIndex: dragState.toIndex
    }
  }

  protected clearSlotReorderDrag(): void {
    if (!this.reorderDragState) return
    this.reorderDragState = undefined
    this.subgraph.setDirtyCanvas(true, true)
  }

  protected setDragCursor(cursor?: string): void {
    this.subgraph.canvasAction((canvas) => {
      canvas.canvas.style.cursor = cursor ?? ''
    })
  }

  private _getSlotInsertIndex(cursorY: number, rowHeight: number): number {
    return Math.max(
      0,
      Math.min(
        this.slots.length - 1,
        Math.floor((cursorY - this._getRailTop()) / rowHeight)
      )
    )
  }

  private _getRailTop(): number {
    return this.boundingRect[1] + SubgraphIONodeBase.roundedRadius
  }

  private _measureSlots(): Array<
    SlotMeasurement<TSlot | typeof this.emptySlot>
  > {
    return this.allSlots.map((slot) => {
      const [width, height] = slot.measure()
      return { slot, width, height }
    })
  }

  /** Arrange the slots in this node. */
  arrange(): void {
    const { minWidth, roundedRadius } = SubgraphIONodeBase
    const [, y] = this.boundingRect
    const { size } = this

    const slotMeasurements = this._measureSlots()
    const maxWidth = slotMeasurements.reduce(
      (currentMax, { width }) => Math.max(currentMax, width),
      minWidth
    )

    size[0] = maxWidth + 2 * roundedRadius

    const x = this.slotAnchorX
    let currentY = this._getRailTop()
    const dragState = this.reorderDragState

    if (!dragState) {
      for (const { slot, width, height } of slotMeasurements) {
        slot.arrange([x, currentY, width, height])
        currentY += height
      }
    } else {
      const draggedMeasurement = slotMeasurements.find(
        ({ slot }) => slot === dragState.draggedSlot
      )
      const emptyMeasurement = slotMeasurements.find(
        ({ slot }) => slot === this.emptySlot
      )

      let gapInserted = false
      let slotIndex = 0

      for (const { slot, width, height } of slotMeasurements) {
        if (slot === dragState.draggedSlot || slot === this.emptySlot) continue

        if (!gapInserted && slotIndex === dragState.toIndex) {
          dragState.gapTop = currentY
          currentY += dragState.slotHeight
          gapInserted = true
          slotIndex += 1
        }

        slot.arrange([x, currentY, width, height])
        currentY += height
        slotIndex += 1
      }

      if (!gapInserted) {
        dragState.gapTop = currentY
        currentY += dragState.slotHeight
      }

      if (draggedMeasurement) {
        dragState.draggedSlot.arrange([
          x,
          dragState.cursorY - dragState.grabOffsetY,
          draggedMeasurement.width,
          draggedMeasurement.height
        ])
      }

      if (emptyMeasurement) {
        this.emptySlot.arrange([
          x,
          currentY,
          emptyMeasurement.width,
          emptyMeasurement.height
        ])
        currentY += emptyMeasurement.height
      }
    }

    size[1] = currentY - y + roundedRadius
  }

  draw(
    ctx: CanvasRenderingContext2D,
    colorContext: DefaultConnectionColors,
    fromSlot?:
      | INodeInputSlot
      | INodeOutputSlot
      | SubgraphInput
      | SubgraphOutput,
    editorAlpha?: number
  ): void {
    const { lineWidth, strokeStyle, fillStyle, font, textBaseline } = ctx
    this.drawProtected(ctx, colorContext, fromSlot, editorAlpha)
    Object.assign(ctx, {
      lineWidth,
      strokeStyle,
      fillStyle,
      font,
      textBaseline
    })
  }

  /** @internal Leaves {@link ctx} dirty. */
  protected abstract drawProtected(
    ctx: CanvasRenderingContext2D,
    colorContext: DefaultConnectionColors,
    fromSlot?:
      | INodeInputSlot
      | INodeOutputSlot
      | SubgraphInput
      | SubgraphOutput,
    editorAlpha?: number
  ): void

  /** @internal Leaves {@link ctx} dirty. */
  protected drawSlots(
    ctx: CanvasRenderingContext2D,
    colorContext: DefaultConnectionColors,
    fromSlot?:
      | INodeInputSlot
      | INodeOutputSlot
      | SubgraphInput
      | SubgraphOutput,
    editorAlpha?: number
  ): void {
    ctx.fillStyle = '#AAA'
    ctx.font = '12px Inter, sans-serif'
    ctx.textBaseline = 'middle'

    const dragState = this.reorderDragState

    for (const slot of this.allSlots) {
      if (slot === dragState?.draggedSlot) continue
      slot.draw({ ctx, colorContext, fromSlot, editorAlpha })
    }

    if (!dragState) return

    dragState.draggedSlot.draw({
      ctx,
      colorContext,
      fromSlot,
      editorAlpha: (editorAlpha ?? 1) * 0.85
    })
  }

  configure(data: ExportedSubgraphIONode): void {
    this._boundingRect.set(data.bounding)
    this.pinned = data.pinned ?? false
  }

  asSerialisable(): ExportedSubgraphIONode {
    return {
      id: this.id,
      bounding: this.boundingRect.export(),
      pinned: this.pinned ? true : undefined
    }
  }
}
