import { toLinkId } from '@comfyorg/graph-model/linkId'
import type { LinkId } from '@comfyorg/graph-model/linkId'
import { toRerouteId } from '@comfyorg/graph-model/rerouteId'
import type { RerouteId } from '@comfyorg/graph-model/rerouteId'

export interface LGraphState {
  /** Counter, not an id — brand at the point a group is constructed. */
  lastGroupId: number
  lastNodeId: number
  lastLinkId: LinkId
  lastRerouteId: RerouteId
}

export function createLGraphState(): LGraphState {
  return {
    lastGroupId: 0,
    lastNodeId: 0,
    lastLinkId: toLinkId(0),
    lastRerouteId: toRerouteId(0)
  }
}
