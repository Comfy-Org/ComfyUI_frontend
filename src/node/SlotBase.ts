import type { CanvasColour, DefaultConnectionColors, INodeSlot, ISlotType, IWidgetLocator, Point, Rect } from "@/interfaces"
import type { LLink } from "@/LLink"
import type { RenderShape } from "@/types/globalEnums"
import type { LinkDirection } from "@/types/globalEnums"

/** Base class for all input & output slots. */

export abstract class SlotBase implements INodeSlot {
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
  widget?: IWidgetLocator
  _floatingLinks?: Set<LLink>
  hasErrors?: boolean

  /** The centre point of the slot. */
  abstract pos?: Point
  readonly boundingRect: Rect

  constructor(name: string, type: ISlotType, boundingRect: Rect) {
    this.name = name
    this.type = type
    this.boundingRect = boundingRect
  }

  abstract get isConnected(): boolean

  renderingColor(colorContext: DefaultConnectionColors): CanvasColour {
    return this.isConnected
      ? this.color_on || colorContext.getConnectedColor(this.type)
      : this.color_off || colorContext.getDisconnectedColor(this.type)
  }
}
