import type { Point, ReadOnlyRect } from "@/interfaces"

import { SubgraphSlot } from "./SubgraphSlotBase"

export class SubgraphOutput extends SubgraphSlot {
  get labelPos(): Point {
    const [x, y, , height] = this.boundingRect
    return [x + height, y + height * 0.5]
  }

  override arrange(rect: ReadOnlyRect): void {
    const [left, top, width, height] = rect
    const { boundingRect: b, pos } = this

    b[0] = left
    b[1] = top
    b[2] = width
    b[3] = height

    pos[0] = left + height * 0.5
    pos[1] = top + height * 0.5
  }
}
