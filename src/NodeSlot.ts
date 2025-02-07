import type { CanvasColour, Dictionary, INodeInputSlot, INodeOutputSlot, INodeSlot, ISlotType, Point } from "./interfaces"
import type { IWidget } from "./types/widgets"
import type { LinkDirection, RenderShape } from "./types/globalEnums"
import type { LinkId } from "./LLink"

export interface ConnectionColorContext {
  default_connection_color: {
    input_off: string
    input_on: string
    output_off: string
    output_on: string
  }
  default_connection_color_byType: Dictionary<CanvasColour>
  default_connection_color_byTypeOff: Dictionary<CanvasColour>
}

export abstract class NodeSlot implements INodeSlot {
  name: string
  localized_name?: string
  label?: string
  type: ISlotType
  dir?: LinkDirection
  removable?: boolean
  shape?: RenderShape
  color_off?: CanvasColour
  color_on?: CanvasColour
  locked?: boolean
  nameLocked?: boolean
  pos?: Point
  widget?: IWidget

  constructor(slot: INodeSlot) {
    Object.assign(this, slot)
    this.name = slot.name
    this.type = slot.type
  }

  /**
   * The label to display in the UI.
   */
  get displayLabel(): string {
    return this.label || this.localized_name || this.name || ""
  }

  abstract isConnected(): boolean

  connectedColor(context: ConnectionColorContext): CanvasColour {
    return this.color_on ||
      context.default_connection_color_byType[this.type] ||
      context.default_connection_color.output_on
  }

  disconnectedColor(context: ConnectionColorContext): CanvasColour {
    return this.color_off ||
      context.default_connection_color_byTypeOff[this.type] ||
      context.default_connection_color_byType[this.type] ||
      context.default_connection_color.output_off
  }

  renderingColor(context: ConnectionColorContext): CanvasColour {
    return this.isConnected()
      ? this.connectedColor(context)
      : this.disconnectedColor(context)
  }
}

export class NodeInputSlot extends NodeSlot implements INodeInputSlot {
  link: LinkId | null

  constructor(slot: INodeInputSlot) {
    super(slot)
    this.link = slot.link
  }

  override isConnected(): boolean {
    return this.link != null
  }
}

export class NodeOutputSlot extends NodeSlot implements INodeOutputSlot {
  links: LinkId[] | null
  _data?: unknown
  slot_index?: number

  constructor(slot: INodeOutputSlot) {
    super(slot)
    this.links = slot.links
    this._data = slot._data
    this.slot_index = slot.slot_index
  }

  override isConnected(): boolean {
    return this.links != null && this.links.length > 0
  }
}
