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
 * The shared-doc contract's coordination-free id range, quoted from the
 * pinned `@comfyorg/comfy-multi-player` `NodeId` doc: "comfy-cli mints ints
 * (`mint_id()`, `[2^40, 2^53)`)". The floor keeps minted ids disjoint from
 * every counter-allocated id, and the ceiling stays inside
 * `Number.MAX_SAFE_INTEGER`.
 */
export const MINT_ID_MIN = 2 ** 40
export const MINT_ID_CEILING = 2 ** 53
const MINT_ID_SPAN = MINT_ID_CEILING - MINT_ID_MIN

const coordinationFreeStates = new WeakSet<LGraphState>()

/**
 * Arm the contract's coordination-free id scheme for node and link
 * allocation against ONE graph's state. Armed only while a semantic doc is
 * bound to that graph: two replicas seeded from one snapshot then cannot
 * allocate the same next id, so concurrent `add_node`/`add_link` operations
 * never alias one document entry. Every allocation against an armed state
 * mints - load, paste, and collision remints included by design, since any
 * id born on a doc-bound graph must be alias-free. While armed, the
 * sequential counters are not advanced; every other graph state keeps
 * counter allocation byte-identically, and `LGraph.clear()` replaces the
 * state object, so a swapped-in graph starts unarmed (fails closed) until
 * its owner re-arms it. Groups and reroutes are canvas-local (not
 * shared-doc entities) and stay on counters in both modes.
 */
export function setCoordinationFreeIds(
  state: LGraphState,
  enabled: boolean
): void {
  if (enabled) coordinationFreeStates.add(state)
  else coordinationFreeStates.delete(state)
}

export function mintCoordinationFreeId(
  random: () => number = Math.random
): number {
  return MINT_ID_MIN + Math.floor(random() * MINT_ID_SPAN)
}

export function mintNodeId(state: LGraphState): NodeId {
  if (coordinationFreeStates.has(state))
    return toNodeId(mintCoordinationFreeId())
  if (state.lastNodeId + 1 >= MINT_ID_MIN) {
    throw new RangeError(
      'Node id counter exhausted below coordination-free range'
    )
  }
  return toNodeId(++state.lastNodeId)
}

export function mintGroupId(state: LGraphState): GroupId {
  return toGroupId(++state.lastGroupId)
}

export function mintLinkId(state: LGraphState): LinkId {
  if (coordinationFreeStates.has(state))
    return toLinkId(mintCoordinationFreeId())
  if (Number(state.lastLinkId) + 1 >= MINT_ID_MIN) {
    throw new RangeError(
      'Link id counter exhausted below coordination-free range'
    )
  }
  state.lastLinkId = toLinkId(Number(state.lastLinkId) + 1)
  return state.lastLinkId
}

export function mintRerouteId(state: LGraphState): RerouteId {
  state.lastRerouteId = toRerouteId(Number(state.lastRerouteId) + 1)
  return state.lastRerouteId
}

/**
 * Ids at or above `MINT_ID_MIN - 1` never seed a counter (the boundary
 * value's own next ++ would allocate exactly the floor): absorbing a minted id
 * would advance `lastNodeId`/`lastLinkId` into the mint range, and the next
 * counter allocation on any replica could then alias a minted entry - the
 * disjointness the range exists to guarantee, in the other direction.
 */
export function observeNodeId(state: LGraphState, id: NodeId): void {
  const numericId = Number(id)
  if (
    Number.isInteger(numericId) &&
    numericId < MINT_ID_MIN - 1 &&
    numericId > state.lastNodeId
  ) {
    state.lastNodeId = numericId
  }
}

export function observeGroupId(state: LGraphState, id: GroupId): void {
  if (id > state.lastGroupId) state.lastGroupId = id
}

export function observeLinkId(state: LGraphState, id: LinkId): void {
  if (
    Number.isInteger(Number(id)) &&
    id < MINT_ID_MIN - 1 &&
    id > state.lastLinkId
  )
    state.lastLinkId = id
}

export function observeRerouteId(state: LGraphState, id: RerouteId): void {
  if (id > state.lastRerouteId) state.lastRerouteId = id
}
