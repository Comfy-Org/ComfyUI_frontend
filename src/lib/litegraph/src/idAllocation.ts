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
 * mints for the same doc — see {@link mintCrdtDisjointNodeId}.
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
 * ever changes there, this partition silently stops holding, and the runtime
 * guard in `agentNodeMaterializer.ts` catches only part of that: it reports a
 * remote id with BOTH reserved bits clear (see
 * {@link matchesReservedBitConvention}). An agent mint that stopped setting
 * bit 40 but happened to set bit 41 would still pass it silently — and would
 * then be inside this app's own range.
 */
export const AGENT_RESERVED_BIT = 1n << 40n
export const CRDT_DISJOINT_FLOOR = 1n << 41n
const CRDT_RANDOM_BIT_COUNT = 52

function mintCrdtDisjointNodeId(): NodeId {
  const random = BigInt(Math.floor(Math.random() * 2 ** CRDT_RANDOM_BIT_COUNT))
  const id = (random & ~AGENT_RESERVED_BIT) | CRDT_DISJOINT_FLOOR
  return toNodeId(Number(id))
}

/**
 * Whether the reserved-bit convention says anything about `id` at all: a
 * numeric integer at or above the agent's mint floor. A nonnumeric id — a
 * legacy `"named"` node, a `"57:3"` subgraph-scoped address — predates both
 * mints and carries no reservation to check (and is not a `BigInt`).
 */
export function isReservedBitRangeNodeId(id: NodeId): boolean {
  const numeric = Number(id)
  return Number.isSafeInteger(numeric) && BigInt(numeric) >= AGENT_RESERVED_BIT
}

/**
 * Whether `id` carries EITHER reserved bit: the agent's
 * (`AGENT_RESERVED_BIT`) or this app's own disjoint floor
 * (`CRDT_DISJOINT_FLOOR`). It is deliberately this weak — it cannot tell the
 * two mints apart, and it accepts any id with bit 41 set whatever minted it.
 * So its exact guarantee is only that an id failing it has BOTH reserved bits
 * clear, i.e. it came from neither convention.
 *
 * Safe to call with any legal `NodeId`, including a nonnumeric legacy id
 * (`"named"`, `"57:3"`): those predate both mint conventions and carry no
 * reservation, so they return `false` here rather than throwing. Callers
 * that need to distinguish "carries no reservation because it's legacy"
 * from "carries no reservation despite being eligible" should check
 * {@link isReservedBitRangeNodeId} themselves.
 */
export function matchesReservedBitConvention(id: NodeId): boolean {
  if (!isReservedBitRangeNodeId(id)) return false
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
