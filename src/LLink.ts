import type {
  CanvasColour,
  LinkNetwork,
  ISlotType,
  LinkSegment,
} from "./interfaces"
import type { NodeId } from "./LGraphNode"
import type { Reroute, RerouteId } from "./Reroute"
import type { Serialisable, SerialisableLLink } from "./types/serialisation"

export type LinkId = number

export type SerialisedLLinkArray = [
  id: LinkId,
  origin_id: NodeId,
  origin_slot: number,
  target_id: NodeId,
  target_slot: number,
  type: ISlotType,
]

// this is the class in charge of storing link information
export class LLink implements LinkSegment, Serialisable<SerialisableLLink> {
  /** Link ID */
  id: LinkId
  parentId?: RerouteId
  type: ISlotType
  /** Output node ID */
  origin_id: NodeId
  /** Output slot index */
  origin_slot: number
  /** Input node ID */
  target_id: NodeId
  /** Input slot index */
  target_slot: number

  data?: number | string | boolean | { toToolTip?(): string }
  _data?: unknown
  /** Centre point of the link, calculated during render only - can be inaccurate */
  _pos: Float32Array
  /** @todo Clean up - never implemented in comfy. */
  _last_time?: number
  /** The last canvas 2D path that was used to render this link */
  path?: Path2D
  /** @inheritdoc */
  _centreAngle?: number

  #color?: CanvasColour
  /** Custom colour for this link only */
  public get color(): CanvasColour {
    return this.#color
  }

  public set color(value: CanvasColour) {
    this.#color = value === "" ? null : value
  }

  constructor(
    id: LinkId,
    type: ISlotType,
    origin_id: NodeId,
    origin_slot: number,
    target_id: NodeId,
    target_slot: number,
    parentId?: RerouteId,
  ) {
    this.id = id
    this.type = type
    this.origin_id = origin_id
    this.origin_slot = origin_slot
    this.target_id = target_id
    this.target_slot = target_slot
    this.parentId = parentId

    this._data = null
    this._pos = new Float32Array(2) // center
  }

  /** @deprecated Use {@link LLink.create} */
  static createFromArray(data: SerialisedLLinkArray): LLink {
    return new LLink(data[0], data[5], data[1], data[2], data[3], data[4])
  }

  /**
   * LLink static factory: creates a new LLink from the provided data.
   * @param data Serialised LLink data to create the link from
   * @returns A new LLink
   */
  static create(data: SerialisableLLink): LLink {
    return new LLink(
      data.id,
      data.type,
      data.origin_id,
      data.origin_slot,
      data.target_id,
      data.target_slot,
      data.parentId,
    )
  }

  /**
   * Gets all reroutes from the output slot to this segment.  If this segment is a reroute, it will be the last element.
   * @returns An ordered array of all reroutes from the node output to
   * this reroute or the reroute before it.  Otherwise, an empty array.
   */
  static getReroutes(
    network: LinkNetwork,
    linkSegment: LinkSegment,
  ): Reroute[] {
    return network.reroutes.get(linkSegment.parentId)
      ?.getReroutes() ?? []
  }

  /**
   * Finds the reroute in the chain after the provided reroute ID.
   * @param network The network this link belongs to
   * @param linkSegment The starting point of the search (input side).
   * Typically the LLink object itself, but can be any link segment.
   * @param rerouteId The matching reroute will have this set as its {@link parentId}.
   * @returns The reroute that was found, `undefined` if no reroute was found, or `null` if an infinite loop was detected.
   */
  static findNextReroute(
    network: LinkNetwork,
    linkSegment: LinkSegment,
    rerouteId: RerouteId,
  ): Reroute | null | undefined {
    return network.reroutes.get(linkSegment.parentId)
      ?.findNextReroute(rerouteId)
  }

  configure(o: LLink | SerialisedLLinkArray) {
    if (Array.isArray(o)) {
      this.id = o[0]
      this.origin_id = o[1]
      this.origin_slot = o[2]
      this.target_id = o[3]
      this.target_slot = o[4]
      this.type = o[5]
    } else {
      this.id = o.id
      this.type = o.type
      this.origin_id = o.origin_id
      this.origin_slot = o.origin_slot
      this.target_id = o.target_id
      this.target_slot = o.target_slot
      this.parentId = o.parentId
    }
  }

  /**
   * Disconnects a link and removes it from the graph, cleaning up any reroutes that are no longer used
   * @param network The container (LGraph) where reroutes should be updated
   * @param keepReroutes If `true`, reroutes will not be garbage collected.
   */
  disconnect(network: LinkNetwork, keepReroutes?: boolean): void {
    const reroutes = LLink.getReroutes(network, this)

    for (const reroute of reroutes) {
      reroute.linkIds.delete(this.id)
      if (!keepReroutes && !reroute.linkIds.size)
        network.reroutes.delete(reroute.id)
    }
    network.links.delete(this.id)
  }

  /**
   * @deprecated Prefer {@link LLink.asSerialisable} (returns an object, not an array)
   * @returns An array representing this LLink
   */
  serialize(): SerialisedLLinkArray {
    return [
      this.id,
      this.origin_id,
      this.origin_slot,
      this.target_id,
      this.target_slot,
      this.type,
    ]
  }

  asSerialisable(): SerialisableLLink {
    const copy: SerialisableLLink = {
      id: this.id,
      origin_id: this.origin_id,
      origin_slot: this.origin_slot,
      target_id: this.target_id,
      target_slot: this.target_slot,
      type: this.type,
    }
    if (this.parentId) copy.parentId = this.parentId
    return copy
  }
}
