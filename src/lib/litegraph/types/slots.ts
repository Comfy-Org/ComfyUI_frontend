/**
 * Slot-related types for litegraph.
 * These have minimal dependencies and can be imported without pulling in runtime code.
 */

import type { LinkDirection, RenderShape } from '../src/types/globalEnums'
import type { CanvasColour, Point, ReadOnlyRect } from './geometry'
import type { LinkId } from './ids'

/**
 * A string that represents a specific data / slot type, e.g. `STRING`.
 *
 * Can be comma-delimited to specify multiple allowed types, e.g. `STRING,INT`.
 */
export type ISlotType = number | string

/**
 * Any object that has a {@link boundingRect}.
 */
export interface HasBoundingRect {
  /**
   * A rectangle that represents the outer edges of the item.
   *
   * Used for various calculations, such as overlap, selective rendering, and click checks.
   * For most items, this is cached position & size as `x, y, width, height`.
   * Some items (such as nodes and slots) may extend above and/or to the left of their {@link pos}.
   * @readonly
   * @see {@link move}
   */
  readonly boundingRect: ReadOnlyRect
}

/**
 * Base slot interface without runtime-dependent properties.
 * The full INodeSlot in interfaces.ts extends this with runtime properties.
 */
export interface INodeSlotBase extends HasBoundingRect {
  /**
   * The name of the slot in English.
   * Will be included in the serialized data.
   */
  name: string
  /**
   * The localized name of the slot to display in the UI.
   * Takes higher priority than {@link name} if set.
   * Will be included in the serialized data.
   */
  localized_name?: string
  /**
   * The name of the slot to display in the UI, modified by the user.
   * Takes higher priority than {@link display_name} if set.
   * Will be included in the serialized data.
   */
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
  /** @remarks Automatically calculated; not included in serialisation. */
  boundingRect: ReadOnlyRect
  /**
   * Whether the slot has errors. It is **not** serialized.
   */
  hasErrors?: boolean
}

/**
 * A widget that is linked to a slot.
 *
 * This is set by the ComfyUI_frontend logic. See
 * https://github.com/Comfy-Org/ComfyUI_frontend/blob/b80e0e1a3c74040f328c4e344326c969c97f67e0/src/extensions/core/widgetInputs.ts#L659
 */
export interface IWidgetLocator {
  name: string
  type?: string
}

/**
 * Base input slot interface without runtime-dependent properties.
 */
export interface INodeInputSlotBase extends INodeSlotBase {
  link: LinkId | null
  widget?: IWidgetLocator
  alwaysVisible?: boolean
}

export interface IWidgetInputSlotBase extends INodeInputSlotBase {
  widget: IWidgetLocator
}

/**
 * Base output slot interface without runtime-dependent properties.
 */
export interface INodeOutputSlotBase extends INodeSlotBase {
  links: LinkId[] | null
  _data?: unknown
  slot_index?: number
}

export interface INodeFlags {
  skip_repeated_outputs?: boolean
  allow_interaction?: boolean
  pinned?: boolean
  collapsed?: boolean
  /** Configuration setting for {@link LGraphNode.connectInputToOutput} */
  keepAllLinksOnBypass?: boolean
}
