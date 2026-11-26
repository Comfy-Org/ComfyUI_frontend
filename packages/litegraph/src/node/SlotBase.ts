import { Rectangle } from '#/infrastructure/Rectangle'
import type {
  CanvasColour,
  DefaultConnectionColors,
  INodeSlot,
  ISlotType
} from '@comfyorg/graph-model/interfaces'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import type {
  LinkDirection,
  RenderShape
} from '@comfyorg/graph-model/globalEnums'

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
  widget?: INodeInputSlot['widget']
  hasErrors?: boolean

  /** The centre point of the slot. */
  abstract pos?: Point
  readonly boundingRect: Rectangle

  constructor(name: string, type: ISlotType, boundingRect?: Rectangle) {
    this.name = name
    this.type = type
    this.boundingRect = boundingRect ?? new Rectangle()
  }

  abstract get isConnected(): boolean

  renderingColor(colorContext: DefaultConnectionColors): CanvasColour {
    return this.isConnected
      ? this.color_on || colorContext.getConnectedColor(this.type)
      : this.color_off || colorContext.getDisconnectedColor(this.type)
  }
}
