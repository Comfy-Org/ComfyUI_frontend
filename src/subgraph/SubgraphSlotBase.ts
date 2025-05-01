import type { SubgraphIONodeBase } from "./SubgraphIONodeBase"
import type { Point, ReadOnlyRect, Rect } from "@/interfaces"
import type { LinkId } from "@/LLink"
import type { Serialisable, SubgraphIO } from "@/types/serialisation"

import { LiteGraph } from "@/litegraph"
import { SlotBase } from "@/node/SlotBase"
import { createUuidv4, type UUID } from "@/utils/uuid"

/** Shared base class for the slots used on Subgraph . */
export abstract class SubgraphSlot extends SlotBase implements SubgraphIO, Serialisable<SubgraphIO> {
  static get defaultHeight() {
    return LiteGraph.NODE_SLOT_HEIGHT
  }

  readonly #pos: Point = new Float32Array(2)

  readonly id: UUID
  readonly parent: SubgraphIONodeBase
  override type: string

  readonly linkIds: LinkId[] = []

  readonly boundingRect: Rect = [0, 0, 0, SubgraphSlot.defaultHeight]

  override get pos() {
    return this.#pos
  }

  override set pos(value) {
    if (!value || value.length < 2) return

    this.#pos[0] = value[0]
    this.#pos[1] = value[1]
  }

  /** Whether this slot is connected to another slot. */
  override get isConnected() {
    return this.linkIds.length > 0
  }

  /** The display name of this slot. */
  get displayName() {
    return this.label ?? this.localized_name ?? this.name
  }

  abstract get labelPos(): Point

  constructor(slot: SubgraphIO, parent: SubgraphIONodeBase) {
    super(slot.name, slot.type, slot.boundingRect)

    Object.assign(this, slot)
    this.id = slot.id ?? createUuidv4()
    this.type = slot.type
    this.parent = parent
  }

  abstract arrange(rect: ReadOnlyRect): void

  asSerialisable(): SubgraphIO {
    const { id, name, type, linkIds, localized_name, label, dir, shape, color_off, color_on, pos, boundingRect } = this
    return { id, name, type, linkIds, localized_name, label, dir, shape, color_off, color_on, pos, boundingRect }
  }
}
