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
 * `'sequential'` (default) is the plain-local `++lastNodeId` counter.
 * `'crdt-disjoint'` is for a graph bound to the in-app agent's collaborative
 * doc, where a local mint can otherwise land on an id the agent independently
 * mints for the same doc (PM-1251) — see {@link mintCrdtDisjointNodeId}.
 */
export type NodeIdMintMode = 'sequential' | 'crdt-disjoint'

/**
 * The agent mints node ids as `2**40 | random52bits` (comfy-cli's
 * `mint_id()`), so bit 40 is always set. Forcing it CLEAR here, with bit 41
 * forced SET, partitions the two actors' ranges by construction (KA-5) — not
 * by odds — regardless of what `observeNodeId` has observed.
 *
 * Source of the `2**40 | random52bits` premise:
 * https://github.com/Comfy-Org/comfy-cli/blob/aec5220c4573fdc3ea89794572305d12a4d24e70/comfy_cli/workflow_ops.py#L65-L72
 * (`Comfy-Org/comfy-cli`'s `comfy_cli/workflow_ops.py:65-72`: `_ID_FLOOR = 1 << 40`,
 * `mint_id() -> _ID_FLOOR | random.getrandbits(52)`). If that reservation bit
 * ever changes there, this partition silently stops holding — see the
 * runtime guard in `agentNodeMaterializer.ts`, which surfaces a bit-40-clear
 * remote id via `reportError()` instead of failing silently.
 */
export const AGENT_RESERVED_BIT = 1n << 40n
const CRDT_DISJOINT_FLOOR = 1n << 41n
const CRDT_RANDOM_BIT_COUNT = 52

function mintCrdtDisjointNodeId(): NodeId {
  const random = BigInt(Math.floor(Math.random() * 2 ** CRDT_RANDOM_BIT_COUNT))
  const id = (random & ~AGENT_RESERVED_BIT) | CRDT_DISJOINT_FLOOR
  return toNodeId(Number(id))
}

/**
 * Whether `id` is shaped like one of the two valid mints for a CRDT-bound
 * graph: the agent's (`AGENT_RESERVED_BIT` set) or this app's own disjoint
 * mint (`CRDT_DISJOINT_FLOOR` set). A remote id matching neither means the
 * reserved-bit premise this partition rests on (see `AGENT_RESERVED_BIT`'s
 * doc comment) no longer holds for whatever minted it.
 */
export function matchesReservedBitConvention(id: NodeId): boolean {
  const big = BigInt(id)
  return (big & AGENT_RESERVED_BIT) !== 0n || (big & CRDT_DISJOINT_FLOOR) !== 0n
}

export function mintNodeId(
  state: LGraphState,
  mode: NodeIdMintMode = 'sequential'
): NodeId {
  return mode === 'crdt-disjoint'
    ? mintCrdtDisjointNodeId()
    : toNodeId(++state.lastNodeId)
}

export function mintGroupId(state: LGraphState): GroupId {
  return toGroupId(++state.lastGroupId)
}

export function mintLinkId(state: LGraphState): LinkId {
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
