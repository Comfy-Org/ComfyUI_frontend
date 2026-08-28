import { toGroupId } from '@/types/groupId'
import type { GroupId } from '@/types/groupId'
import { toLinkId } from '@/types/linkId'
import type { LinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import type { RerouteId } from '@/types/rerouteId'

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

/**
 * The shared-doc contract's coordination-free id range: comfy-cli's
 * `mint_id()` draws integers in `[2^40, 2^53)` (see the `NodeId` note in
 * `@comfyorg/comfy-multi-player`'s types). The floor keeps minted ids
 * disjoint from every counter-allocated id, and the ceiling stays inside
 * `Number.MAX_SAFE_INTEGER`.
 */
const MINT_ID_MIN = 2 ** 40
const MINT_ID_SPAN = 2 ** 53 - MINT_ID_MIN

let coordinationFreeIds = false

/**
 * Arm the contract's coordination-free id scheme for node and link
 * allocation. Armed only while a semantic doc is bound to the active
 * workflow: two replicas seeded from one snapshot then cannot allocate the
 * same next id, so concurrent `add_node`/`add_link` operations never alias
 * one document entry. While armed, the sequential counters are not
 * advanced; unbound graphs keep counter allocation byte-identically.
 * Groups and reroutes are canvas-local (not shared-doc entities) and stay
 * on counters in both modes.
 */
export function setCoordinationFreeIds(enabled: boolean): void {
  coordinationFreeIds = enabled
}

function mintCoordinationFreeId(): number {
  return MINT_ID_MIN + Math.floor(Math.random() * MINT_ID_SPAN)
}

export function mintNodeId(state: LGraphState): NodeId {
  if (coordinationFreeIds) return toNodeId(mintCoordinationFreeId())
  return toNodeId(++state.lastNodeId)
}

export function mintGroupId(state: LGraphState): GroupId {
  return toGroupId(++state.lastGroupId)
}

export function mintLinkId(state: LGraphState): LinkId {
  if (coordinationFreeIds) return toLinkId(mintCoordinationFreeId())
  state.lastLinkId = toLinkId(Number(state.lastLinkId) + 1)
  return state.lastLinkId
}

export function mintRerouteId(state: LGraphState): RerouteId {
  state.lastRerouteId = toRerouteId(Number(state.lastRerouteId) + 1)
  return state.lastRerouteId
}

export function observeNodeId(state: LGraphState, id: NodeId): void {
  const numericId = Number(id)
  if (Number.isInteger(numericId) && numericId > state.lastNodeId) {
    state.lastNodeId = numericId
  }
}

export function observeGroupId(state: LGraphState, id: GroupId): void {
  if (id > state.lastGroupId) state.lastGroupId = id
}

export function observeLinkId(state: LGraphState, id: LinkId): void {
  if (id > state.lastLinkId) state.lastLinkId = id
}

export function observeRerouteId(state: LGraphState, id: RerouteId): void {
  if (id > state.lastRerouteId) state.lastRerouteId = id
}
