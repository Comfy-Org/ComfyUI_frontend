import type {
  LinkConnector,
  Subgraph,
  SubgraphInput,
  SubgraphOutput
} from '@comfyorg/graph-model/entityRegistry'
import { toSelectableKey } from '@/core/selection/selectionState'
import { isSelectedIn, setSelectedIn } from '@/core/selection/selectionStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { serializeNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type {
  DefaultConnectionColors,
  Positionable,
  CanvasColour
} from '@comfyorg/graph-model/interfaces'
import type {
  PointTuple as Point,
  ReadOnlyRect
} from '@comfyorg/shared-frontend-utils/geometry'
import type { SlotDirection } from '@comfyorg/graph-model/slotId'
import type {
  Hoverable,
  CanvasPointerEvent
} from '@comfyorg/graph-model/events'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@comfyorg/graph-model/slots'
import { LiteGraph } from '@/lib/litegraph/src/litegraphInstance'
import type { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'
import { snapPoint } from '@/lib/litegraph/src/measure'
import { CanvasItem } from '@comfyorg/graph-model/globalEnums'
import type {
  ExportedSubgraphIONode,
  Serialisable
} from '@comfyorg/graph-model/serialisation'

import type { EmptySubgraphInput } from './EmptySubgraphInput'
import type { EmptySubgraphOutput } from './EmptySubgraphOutput'

/** Geometry of an IO node drawn outside the canvas, in canvas units relative to its bounding rect. */
export interface SubgraphIORenderedLayout {
  readonly width: number
  readonly height: number
  /** The hit area of each slot's port, in {@link SubgraphIONodeBase.allSlots} order. */
  readonly ports: readonly ReadOnlyRect[]
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
  abstract readonly slotDirection: SlotDirection

  /** Set by the renderer that draws this node in place of the canvas. */
  renderedLayout: SubgraphIORenderedLayout | undefined

  get boundingRect(): Rectangle {
    const { renderedLayout } = this
    if (!renderedLayout) return this._boundingRect
    const [x, y, width] = this._boundingRect
    const offsetX =
      this.slotDirection === 'output' ? width - renderedLayout.width : 0
    return new Rectangle(
      x + offsetX,
      y,
      renderedLayout.width,
      renderedLayout.height
    )
  }

  get selected(): boolean {
    return isSelectedIn(
      graphScopeOf(this.subgraph),
      toSelectableKey('io', this.id)
    )
  }

  set selected(value: boolean) {
    setSelectedIn(
      graphScopeOf(this.subgraph),
      toSelectableKey('io', this.id),
      value
    )
  }

  pinned: boolean = false
  readonly removable = false

  isPointerOver: boolean = false

  abstract readonly emptySlot: EmptySubgraphInput | EmptySubgraphOutput

  get pos() {
    return this._boundingRect.pos
  }

  set pos(value) {
    this._boundingRect.pos = value
  }

  get size() {
    return this._boundingRect.size
  }

  set size(value) {
    this._boundingRect.size = value
  }

  protected get sideLineWidth(): number {
    return this.isPointerOver ? 2.5 : 2
  }

  protected get sideStrokeStyle(): CanvasColour {
    return this.isPointerOver ? 'white' : '#efefef'
  }

  abstract readonly slots: TSlot[]
  abstract get allSlots(): TSlot[]

  constructor(
    /** The subgraph that this node belongs to. */
    readonly subgraph: Subgraph
  ) {}

  move(deltaX: number, deltaY: number): void {
    this.pos = [this.pos[0] + deltaX, this.pos[1] + deltaY]
  }

  /** @inheritdoc */
  snapToGrid(snapTo: number): boolean {
    if (this.pinned || !snapTo) return false

    const snapped: Point = [this.pos[0], this.pos[1]]
    snapPoint(snapped, snapTo)
    if (snapped[0] === this.pos[0] && snapped[1] === this.pos[1]) return false

    this.pos = snapped
    return true
  }

  protected abstract dragNewLink(
    linkConnector: LinkConnector,
    slot: TSlot
  ): void

  onPointerDown(
    e: CanvasPointerEvent,
    pointer: CanvasPointer,
    linkConnector: LinkConnector
  ): void {
    const slot = this.getSlotInPosition(e.canvasX, e.canvasY)
    if (!slot) return
    if (e.button === 2) {
      this.showSlotContextMenu(slot, e)
      return
    }
    if (e.button !== 0) return

    if (
      LiteGraph.ctrl_alt_click_do_break_link &&
      (e.ctrlKey || e.metaKey) &&
      e.altKey &&
      !e.shiftKey
    ) {
      pointer.onClick = () => {
        this.subgraph.beforeChange()
        slot.disconnect()
        this.subgraph.afterChange()
      }
      return
    }
    pointer.onDragStart = () => this.dragNewLink(linkConnector, slot)
    pointer.onDragEnd = (eUp) => linkConnector.dropLinks(this.subgraph, eUp)
    pointer.onDoubleClick = () => this.handleSlotDoubleClick(slot, e)
    pointer.finally = () => linkConnector.reset(true)
  }

  // #region Hoverable

  containsPoint(point: Point): boolean {
    return (
      this.boundingRect.containsPoint(point) ||
      this.allSlots.some((slot) => slot.boundingRect.containsPoint(point))
    )
  }

  abstract get slotAnchorX(): number

  onPointerMove(e: CanvasPointerEvent): CanvasItem {
    const containsPoint = this.containsPoint([e.canvasX, e.canvasY])
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

    this.subgraph.setDirtyCanvas(true, true)
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

  arrange(): void {
    const { minWidth, roundedRadius } = SubgraphIONodeBase
    const [x, y] = this.boundingRect
    const { renderedLayout } = this
    const anchorSide = this.slotDirection === 'output' ? 1 : -1

    let maxWidth = minWidth
    let anchorX = this.slotAnchorX
    let currentY = y + roundedRadius

    for (const [index, slot] of this.allSlots.entries()) {
      const [slotWidth, slotHeight] = slot.measure()
      const port = renderedLayout?.ports[index]
      if (port) {
        const [portX, portY, portWidth, portHeight] = port
        anchorX = x + portX + (portWidth + anchorSide * slotHeight) / 2
        currentY = y + portY + (portHeight - slotHeight) / 2
      }
      slot.arrange([anchorX, currentY, slotWidth, slotHeight])
      if (port) includePort(slot.boundingRect, x, y, port)

      currentY += slotHeight
      if (slotWidth > maxWidth) maxWidth = slotWidth
    }

    if (!renderedLayout)
      this.size = [maxWidth + 2 * roundedRadius, currentY - y + roundedRadius]
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
    if (this.renderedLayout) return
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

    for (const slot of this.allSlots) {
      slot.draw({ ctx, colorContext, fromSlot, editorAlpha })
    }
  }

  configure(data: ExportedSubgraphIONode): void {
    this._boundingRect.set(data.bounding)
    this.pinned = data.pinned ?? false
  }

  asSerialisable(): ExportedSubgraphIONode {
    return {
      id: serializeNodeId(this.id),
      bounding: this._boundingRect.export(),
      pinned: this.pinned ? true : undefined
    }
  }
}

function includePort(
  rect: Rectangle,
  originX: number,
  originY: number,
  [x, y, width, height]: ReadOnlyRect
): void {
  const left = originX + x
  const top = originY + y
  rect.resizeTopLeft(Math.min(rect.left, left), Math.min(rect.top, top))
  rect.resizeBottomRight(
    Math.max(rect.right, left + width),
    Math.max(rect.bottom, top + height)
  )
}

type RegisteredSubgraphIONode = SubgraphIONodeBase<
  SubgraphInput | SubgraphOutput
>

declare module '@comfyorg/graph-model/entityRegistry' {
  interface SubgraphIONode extends RegisteredSubgraphIONode {}
}
