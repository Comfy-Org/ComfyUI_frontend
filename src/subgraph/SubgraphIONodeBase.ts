import type { Subgraph } from "./Subgraph"
import type { SubgraphInput } from "./SubgraphInput"
import type { SubgraphOutput } from "./SubgraphOutput"
import type { Point, Positionable, ReadOnlyRect, Rect } from "@/interfaces"
import type { NodeId } from "@/LGraphNode"
import type { ExportedSubgraphIONode, Serialisable } from "@/types/serialisation"

import { isPointInRect, snapPoint } from "@/measure"

export abstract class SubgraphIONodeBase implements Positionable, Serialisable<ExportedSubgraphIONode> {
  static margin = 10
  static defaultWidth = 100
  static roundedRadius = 10

  readonly #boundingRect: Float32Array = new Float32Array(4)
  readonly #pos: Point = this.#boundingRect.subarray(0, 2)
  readonly #size: Point = this.#boundingRect.subarray(2, 4)

  abstract readonly id: NodeId

  get boundingRect(): Rect {
    return this.#boundingRect
  }

  selected: boolean = false
  pinned: boolean = false

  get pos() {
    return this.#pos
  }

  set pos(value) {
    if (!value || value.length < 2) return

    this.#pos[0] = value[0]
    this.#pos[1] = value[1]
  }

  get size() {
    return this.#size
  }

  set size(value) {
    if (!value || value.length < 2) return

    this.#size[0] = value[0]
    this.#size[1] = value[1]
  }

  abstract readonly slots: SubgraphInput[] | SubgraphOutput[]

  constructor(
    /** The subgraph that this node belongs to. */
    readonly subgraph: Subgraph,
  ) {}

  move(deltaX: number, deltaY: number): void {
    this.pos[0] += deltaX
    this.pos[1] += deltaY
  }

  /** @inheritdoc */
  snapToGrid(snapTo: number): boolean {
    return this.pinned ? false : snapPoint(this.pos, snapTo)
  }

  containsPoint(point: Point): boolean {
    return isPointInRect(point, this.boundingRect)
  }

  asSerialisable(): ExportedSubgraphIONode {
    return {
      id: this.id,
      bounding: serialiseRect(this.boundingRect),
      pinned: this.pinned ? true : undefined,
    }
  }
}

function serialiseRect(rect: ReadOnlyRect): [number, number, number, number] {
  return [rect[0], rect[1], rect[2], rect[3]]
}
