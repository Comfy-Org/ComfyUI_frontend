import type { LinkDirection, RenderShape } from './globalEnums'
import type { Point, ReadOnlyRect } from './geometry'

/** Union type for slot connection types - can be a string name or a numeric type code */
export type ISlotType = string | number

/** Colour type for canvas elements */
export type CanvasColour = string | CanvasGradient | CanvasPattern

/**
 * Base interface for node slots (inputs and outputs).
 * Contains common properties shared between input and output slots.
 */
export interface INodeSlotBase {
  /** The unique name of the slot */
  name: string
  /** The type of the slot, used for connection compatibility */
  type: ISlotType
  /** Direction of the link connection */
  dir?: LinkDirection
  /** Whether the slot can be removed */
  removable?: boolean
  /** Visual shape of the slot */
  shape?: RenderShape
  /** Color when disconnected */
  color_off?: CanvasColour
  /** Color when connected */
  color_on?: CanvasColour
  /** Whether the slot is locked from modifications */
  locked?: boolean
  /** Whether the slot name is locked from changes */
  nameLocked?: boolean
  /** Position of the slot relative to the node */
  pos?: Point
  /** Bounding rectangle of the slot for hit detection */
  boundingRect: ReadOnlyRect
}
