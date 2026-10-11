import type { CanvasColour, ISlotType } from '../interfaces'
import { litegraph } from '../litegraphInstance'

/**
 * Resolve the colour used while rendering or previewing a connection of a given slot type.
 */
export function resolveConnectingLinkColor(
  type: ISlotType | undefined
): CanvasColour {
  return type === litegraph().EVENT
    ? litegraph().EVENT_LINK_COLOR
    : litegraph().CONNECTING_LINK_COLOR
}
