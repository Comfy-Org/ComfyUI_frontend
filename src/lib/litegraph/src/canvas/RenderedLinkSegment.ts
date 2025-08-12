import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LinkId } from '@/lib/litegraph/src/LLink'
import type { RerouteId } from '@/lib/litegraph/src/Reroute'
import type { CanvasColour, LinkSegment } from '@/lib/litegraph/src/interfaces'

/**
 * Lightweight, render-only representation of a link segment used for hit testing and tooltips.
 * Decouples canvas state from the LLink data model.
 */
export class RenderedLinkSegment implements LinkSegment {
  readonly id: LinkId | RerouteId
  readonly origin_id: NodeId
  readonly origin_slot: number
  readonly parentId?: RerouteId

  path?: Path2D
  readonly _pos: Float32Array = new Float32Array(2)
  _centreAngle?: number
  _dragging?: boolean
  colour?: CanvasColour

  constructor(args: {
    id: LinkId | RerouteId
    origin_id: NodeId
    origin_slot: number
    parentId?: RerouteId
  }) {
    this.id = args.id
    this.origin_id = args.origin_id
    this.origin_slot = args.origin_slot
    this.parentId = args.parentId
  }
}
