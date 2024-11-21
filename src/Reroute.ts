import type {
  CanvasColour,
  LinkSegment,
  LinkNetwork,
  Point,
  Positionable,
  ReadOnlyRect,
} from "./interfaces"
import { LLink, type LinkId } from "./LLink"
import type { SerialisableReroute, Serialisable } from "./types/serialisation"
import { distance } from "./measure"
import type { NodeId } from "./LGraphNode"

export type RerouteId = number

/**
 * Represents an additional point on the graph that a link path will travel through.  Used for visual organisation only.
 *
 * Requires no disposal or clean up.
 * Stores only primitive values (IDs) to reference other items in its network,
 * and a `WeakRef` to a {@link LinkNetwork} to resolve them.
 */
export class Reroute implements Positionable, LinkSegment, Serialisable<SerialisableReroute> {
  static radius: number = 10

  #malloc = new Float32Array(8)

  /** The network this reroute belongs to.  Contains all valid links and reroutes. */
  #network: WeakRef<LinkNetwork>

  #parentId?: RerouteId
  /** @inheritdoc */
  public get parentId(): RerouteId {
    return this.#parentId
  }

  /** Ignores attempts to create an infinite loop. @inheritdoc */
  public set parentId(value: RerouteId) {
    if (value === this.id) return
    if (this.getReroutes() === null) return
    this.#parentId = value
  }

  #pos = this.#malloc.subarray(0, 2)
  /** @inheritdoc */
  get pos(): Point {
    return this.#pos
  }

  set pos(value: Point) {
    if (!(value?.length >= 2))
      throw new TypeError("Reroute.pos is an x,y point, and expects an indexable with at least two values.")
    this.#pos[0] = value[0]
    this.#pos[1] = value[1]
  }

  /** @inheritdoc */
  get boundingRect(): ReadOnlyRect {
    const { radius } = Reroute
    const [x, y] = this.#pos
    return [x - radius, y - radius, 2 * radius, 2 * radius]
  }

  /** @inheritdoc */
  selected?: boolean

  /** The ID ({@link LLink.id}) of every link using this reroute */
  linkIds: Set<LinkId>

  /** The averaged angle of every link through this reroute. */
  otherAngle: number = 0

  /** Cached cos */
  cos: number = 0
  sin: number = 0

  /** Bezier curve control point for the "target" (input) side of the link */
  controlPoint: Point = this.#malloc.subarray(4, 6)

  /** @inheritdoc */
  path?: Path2D
  /** @inheritdoc */
  _centreAngle?: number
  /** @inheritdoc */
  _pos: Float32Array = this.#malloc.subarray(6, 8)

  /** Colour of the first link that rendered this reroute */
  _colour?: CanvasColour

  /**
   * Used to ensure reroute angles are only executed once per frame.
   * @todo Calculate on change instead.
   */
  #lastRenderTime: number = -Infinity
  #buffer: Point = this.#malloc.subarray(2, 4)

  /** @inheritdoc */
  get origin_id(): NodeId | undefined {
    // if (!this.linkIds.size) return this.#network.deref()?.reroutes.get(this.parentId)
    return this.#network.deref()
      ?.links.get(this.linkIds.values().next().value)
      ?.origin_id
  }

  /** @inheritdoc */
  get origin_slot(): number | undefined {
    return this.#network.deref()
      ?.links.get(this.linkIds.values().next().value)
      ?.origin_slot
  }

  /**
   * Initialises a new link reroute object.
   * @param id Unique identifier for this reroute
   * @param network The network of links this reroute belongs to.  Internally converted to a WeakRef.
   * @param pos Position in graph coordinates
   * @param linkIds Link IDs ({@link LLink.id}) of all links that use this reroute
   */
  constructor(
    public readonly id: RerouteId,
    network: LinkNetwork,
    pos?: Point,
    parentId?: RerouteId,
    linkIds?: Iterable<LinkId>,
  ) {
    this.#network = new WeakRef(network)
    this.update(parentId, pos, linkIds)
    this.linkIds ??= new Set()
  }

  /**
   * Applies a new parentId to the reroute, and optinoally a new position and linkId.
   * Primarily used for deserialisation.
   * @param parentId The ID of the reroute prior to this reroute, or
   * `undefined` if it is the first reroute connected to a nodes output
   * @param pos The position of this reroute
   * @param linkIds All link IDs that pass through this reroute
   */
  update(
    parentId: RerouteId | undefined,
    pos?: Point,
    linkIds?: Iterable<LinkId>,
  ): void {
    this.parentId = parentId
    if (pos) this.pos = pos
    if (linkIds) this.linkIds = new Set(linkIds)
  }

  /**
   * Validates the linkIds this reroute has.  Removes broken links.
   * @param links Collection of valid links
   * @returns true if any links remain after validation
   */
  validateLinks(links: Map<LinkId, LLink>): boolean {
    const { linkIds } = this
    for (const linkId of linkIds) {
      if (!links.get(linkId)) linkIds.delete(linkId)
    }
    return linkIds.size > 0
  }

  /**
   * Retrieves an ordered array of all reroutes from the node output.
   * @param visited Internal.  A set of reroutes that this function
   * has already visited whilst recursing up the chain.
   * @returns An ordered array of all reroutes from the node output to this reroute, inclusive.
   * `null` if an infinite loop is detected.
   * `undefined` if the reroute chain or {@link LinkNetwork} are invalid.
   */
  getReroutes(visited = new Set<Reroute>()): Reroute[] | null | undefined {
    // No parentId - last in the chain
    if (this.#parentId === undefined) return [this]
    // Invalid chain - looped
    if (visited.has(this)) return null
    visited.add(this)

    const parent = this.#network.deref()?.reroutes.get(this.#parentId)
    // Invalid parent (or network) - drop silently to recover
    if (!parent) {
      this.#parentId = undefined
      return [this]
    }

    const reroutes = parent.getReroutes(visited)
    reroutes?.push(this)
    return reroutes
  }

  /**
   * Internal.  Called by {@link LLink.findNextReroute}.  Not intended for use by itself.
   * @param withParentId The rerouteId to look for
   * @param visited A set of reroutes that have already been visited
   * @returns The reroute that was found, `undefined` if no reroute was found, or `null` if an infinite loop was detected.
   */
  findNextReroute(
    withParentId: RerouteId,
    visited = new Set<Reroute>(),
  ): Reroute | null | undefined {
    if (this.#parentId === withParentId) return this
    if (visited.has(this)) return null
    visited.add(this)

    return this.#network
      .deref()
      ?.reroutes.get(this.#parentId)
      ?.findNextReroute(withParentId, visited)
  }

  /** @inheritdoc */
  move(deltaX: number, deltaY: number) {
    this.#pos[0] += deltaX
    this.#pos[1] += deltaY
  }

  /** @inheritdoc */
  snapToGrid(snapTo: number): boolean {
    if (!snapTo) return false

    const { pos } = this
    pos[0] = snapTo * Math.round(pos[0] / snapTo)
    pos[1] = snapTo * Math.round(pos[1] / snapTo)
    return true
  }

  calculateAngle(lastRenderTime: number, network: LinkNetwork, linkStart: Point): void {
    // Ensure we run once per render
    if (!(lastRenderTime > this.#lastRenderTime)) return
    this.#lastRenderTime = lastRenderTime

    const { links } = network
    const { linkIds, id } = this
    const angles: number[] = []
    let sum = 0
    for (const linkId of linkIds) {
      const link = links.get(linkId)
      // Remove the linkId or just ignore?
      if (!link) continue

      const pos = LLink.findNextReroute(network, link, id)?.pos ??
        network.getNodeById(link.target_id)
          ?.getConnectionPos(true, link.target_slot, this.#buffer)
      if (!pos) continue

      // TODO: Store points/angles, check if changed, skip calcs.
      const angle = Math.atan2(pos[1] - this.#pos[1], pos[0] - this.#pos[0])
      angles.push(angle)
      sum += angle
    }
    if (!angles.length) return

    sum /= angles.length

    const originToReroute = Math.atan2(
      this.#pos[1] - linkStart[1],
      this.#pos[0] - linkStart[0],
    )
    let diff = (originToReroute - sum) * 0.5
    if (Math.abs(diff) > Math.PI * 0.5) diff += Math.PI
    const dist = Math.min(80, distance(linkStart, this.#pos) * 0.25)

    // Store results
    const originDiff = originToReroute - diff
    const cos = Math.cos(originDiff)
    const sin = Math.sin(originDiff)

    this.otherAngle = originDiff
    this.cos = cos
    this.sin = sin
    this.controlPoint[0] = dist * -cos
    this.controlPoint[1] = dist * -sin
    return
  }

  /**
   * Renders the reroute on the canvas.
   * @param ctx Canvas context to draw on
   * @remarks Leaves {@link ctx}.fillStyle, strokeStyle, and lineWidth dirty (perf.).
   */
  draw(ctx: CanvasRenderingContext2D): void {
    const { pos } = this
    ctx.fillStyle = this._colour
    ctx.beginPath()
    ctx.arc(pos[0], pos[1], Reroute.radius, 0, 2 * Math.PI)
    ctx.fill()

    ctx.lineWidth = 1
    ctx.strokeStyle = "rgb(0,0,0,0.5)"
    ctx.stroke()

    ctx.fillStyle = "#ffffff55"
    ctx.strokeStyle = "rgb(0,0,0,0.3)"
    ctx.beginPath()
    ctx.arc(pos[0], pos[1], 8, 0, 2 * Math.PI)
    ctx.fill()
    ctx.stroke()

    if (this.selected) {
      ctx.strokeStyle = "#fff"
      ctx.beginPath()
      ctx.arc(pos[0], pos[1], 12, 0, 2 * Math.PI)
      ctx.stroke()
    }
  }

  /** @inheritdoc */
  asSerialisable(): SerialisableReroute {
    return {
      id: this.id,
      parentId: this.parentId,
      pos: [this.pos[0], this.pos[1]],
      linkIds: [...this.linkIds],
    }
  }
}
