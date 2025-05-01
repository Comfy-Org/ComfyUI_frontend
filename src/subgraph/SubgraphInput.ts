import type { Point, ReadOnlyRect } from "@/interfaces"

import { SubgraphSlot } from "./SubgraphSlotBase"

export class SubgraphInput extends SubgraphSlot {
  get labelPos(): Point {
    const [x, y, , height] = this.boundingRect
    return [x, y + height * 0.5]
  }

  /** For inputs, x is the right edge of the input node. */
  override arrange(rect: ReadOnlyRect): void {
    const [right, top, width, height] = rect
    const { boundingRect: b, pos } = this

    b[0] = right - width
    b[1] = top
    b[2] = width
    b[3] = height

    pos[0] = right - height * 0.5
    pos[1] = top + height * 0.5
  }
}
