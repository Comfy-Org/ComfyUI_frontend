import { NodeIdSpaceExhaustedError } from './infrastructure/NodeIdSpaceExhaustedError'
import { toGroupId } from '@/types/groupId'
import type { GroupId } from '@/types/groupId'
import { toLinkId } from '@/types/linkId'
import type { LinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import type { RerouteId } from '@/types/rerouteId'

/** Hard ceiling shared by every counter — a true safety cap, not a working limit. */
export const MAX_ID = 100_000_000

export interface LGraphState {
  /** Counter, not an id — brand at the point a group is constructed. */
  lastGroupId: number
  lastNodeId: number
  lastLinkId: LinkId
  lastRerouteId: RerouteId
  /** IDs freed by a removed node/group/link/reroute, reused before minting past the counter. */
  freeNodeIds: Set<number>
  freeGroupIds: Set<number>
  freeLinkIds: Set<number>
  freeRerouteIds: Set<number>
}

export function createLGraphState(): LGraphState {
  return {
    lastGroupId: 0,
    lastNodeId: 0,
    lastLinkId: toLinkId(0),
    lastRerouteId: toRerouteId(0),
    freeNodeIds: new Set(),
    freeGroupIds: new Set(),
    freeLinkIds: new Set(),
    freeRerouteIds: new Set()
  }
}

/**
 * A disposable copy of `state`, safe for an operation to mutate speculatively
 * (minting, observing, recycling) and discard on failure via
 * {@link commitLGraphState} only once it fully succeeds.
 */
export function cloneLGraphState(state: LGraphState): LGraphState {
  return {
    lastGroupId: state.lastGroupId,
    lastNodeId: state.lastNodeId,
    lastLinkId: state.lastLinkId,
    lastRerouteId: state.lastRerouteId,
    freeNodeIds: new Set(state.freeNodeIds),
    freeGroupIds: new Set(state.freeGroupIds),
    freeLinkIds: new Set(state.freeLinkIds),
    freeRerouteIds: new Set(state.freeRerouteIds)
  }
}

/**
 * Projects only the four persisted counters off `state`, leaving its free-id
 * pools behind. `asSerialisable()` uses this instead of returning `state`
 * itself, so a saved workflow or clipboard payload never carries the live,
 * mutable free-id `Set`s by reference — those are transient allocator
 * bookkeeping, not part of the persisted schema.
 */
export function counterSnapshot(state: LGraphState): {
  lastGroupId: number
  lastNodeId: number
  lastLinkId: number
  lastRerouteId: number
} {
  return {
    lastGroupId: state.lastGroupId,
    lastNodeId: state.lastNodeId,
    lastLinkId: state.lastLinkId,
    lastRerouteId: state.lastRerouteId
  }
}

/** Copies every counter and free-id pool from `source` onto `target`, in place. */
export function commitLGraphState(
  target: LGraphState,
  source: LGraphState
): void {
  target.lastGroupId = source.lastGroupId
  target.lastNodeId = source.lastNodeId
  target.lastLinkId = source.lastLinkId
  target.lastRerouteId = source.lastRerouteId
  target.freeNodeIds = source.freeNodeIds
  target.freeGroupIds = source.freeGroupIds
  target.freeLinkIds = source.freeLinkIds
  target.freeRerouteIds = source.freeRerouteIds
}

/** The next value from `freeIds`, removed from the set, or `undefined` when empty. */
function takeFreeId(freeIds: Set<number>): number | undefined {
  const { done, value } = freeIds.values().next()
  if (done) return undefined
  freeIds.delete(value)
  return value
}

/** Whether `value` is a well-formed counter candidate — a non-negative integer. */
function isValidCounterCandidate(value: number): boolean {
  return Number.isInteger(value) && value >= 0
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
 * Whether `text` denotes an EXACT integer, expanding exponent notation by
 * shifting the decimal point over `text`'s own digits rather than through
 * `Number`. `Number('4398046511104.0001')` rounds to exactly
 * `4398046511104` — a float can't distinguish that from a true integer —
 * so the fractional check has to run on the source digits, not the
 * coerced value.
 */
function isExactIntegerLiteral(text: string): boolean {
  const match = /^[+-]?(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/i.exec(
    text
  )
  if (!match) return false
  const intPart = match.at(1) ?? ''
  const fracPart = match.at(2) || match.at(3) || ''
  const expPart = match.at(4)
  const pointIndex = intPart.length + (expPart ? Number(expPart) : 0)
  return /^0*$/.test((intPart + fracPart).slice(Math.max(0, pointIndex)))
}

/**
 * `id`'s numeric value if it is a `NodeId` denoting an exact, safe-integer
 * value, or `undefined` for every non-exact or unsafe-integer
 * representation — a nonnumeric legacy id (`"named"`, `"57:3"`), a
 * fractional numeral (`"4398046511104.0001"`), or an integer outside the
 * safe range. Callers convert THIS value to a `BigInt`, rather than parsing
 * `id` itself with `BigInt(id)`: `Number` accepts exponent-form numeric
 * strings (`Number('2e12')` is a safe integer) but `BigInt`'s string
 * parsing does not, so `BigInt(id)` throws on exactly the ids this already
 * validated as in range.
 */
function safeIntegerValueOf(id: NodeId): number | undefined {
  if (!isExactIntegerLiteral(id)) return undefined
  const numeric = Number(id)
  return Number.isSafeInteger(numeric) ? numeric : undefined
}

/**
 * Whether the reserved-bit convention says anything about `id` at all: a
 * numeric integer at or above the agent's mint floor. A nonnumeric id — a
 * legacy `"named"` node, a `"57:3"` subgraph-scoped address — predates both
 * mints and carries no reservation to check (and is not a `BigInt`).
 */
export function isReservedBitRangeNodeId(id: NodeId): boolean {
  const numeric = safeIntegerValueOf(id)
  return numeric !== undefined && BigInt(numeric) >= AGENT_RESERVED_BIT
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
  const numeric = safeIntegerValueOf(id)
  if (numeric === undefined) return false
  const big = BigInt(numeric)
  if (big < AGENT_RESERVED_BIT) return false
  return (big & AGENT_RESERVED_BIT) !== 0n || (big & CRDT_DISJOINT_FLOOR) !== 0n
}

/** Advances a counter by one, throwing rather than minting past `MAX_ID`. */
function advanceCounter(lastValue: number): number {
  const next = lastValue + 1
  if (next > MAX_ID) throw new NodeIdSpaceExhaustedError()
  return next
}

export function mintNodeId(
  state: LGraphState,
  mode: NodeIdMintMode = 'sequential'
): NodeId {
  if (mode === 'crdt-disjoint') return mintCrdtDisjointNodeId()
  const recycled = takeFreeId(state.freeNodeIds)
  if (recycled !== undefined) return toNodeId(recycled)
  state.lastNodeId = advanceCounter(state.lastNodeId)
  return toNodeId(state.lastNodeId)
}

export function mintGroupId(state: LGraphState): GroupId {
  const recycled = takeFreeId(state.freeGroupIds)
  if (recycled !== undefined) return toGroupId(recycled)
  state.lastGroupId = advanceCounter(state.lastGroupId)
  return toGroupId(state.lastGroupId)
}

export function mintLinkId(state: LGraphState): LinkId {
  const recycled = takeFreeId(state.freeLinkIds)
  if (recycled !== undefined) return toLinkId(recycled)
  state.lastLinkId = toLinkId(advanceCounter(Number(state.lastLinkId)))
  return state.lastLinkId
}

export function mintRerouteId(state: LGraphState): RerouteId {
  const recycled = takeFreeId(state.freeRerouteIds)
  if (recycled !== undefined) return toRerouteId(recycled)
  state.lastRerouteId = toRerouteId(advanceCounter(Number(state.lastRerouteId)))
  return state.lastRerouteId
}

/**
 * Returns `id` to `state`'s free-node pool so a later mint reuses it before
 * advancing `lastNodeId`. Ignored for a nonnumeric legacy id and for one in
 * the agent/CRDT reserved-bit range (see {@link AGENT_RESERVED_BIT}), which
 * this counter never mints into.
 */
export function releaseNodeId(state: LGraphState, id: NodeId): void {
  const numeric = safeIntegerValueOf(id)
  if (numeric === undefined || numeric <= 0 || numeric > MAX_ID) return
  if (BigInt(numeric) >= AGENT_RESERVED_BIT) return
  state.freeNodeIds.add(numeric)
}

export function releaseGroupId(state: LGraphState, id: GroupId): void {
  if (!Number.isInteger(id) || id <= 0 || id > MAX_ID) return
  state.freeGroupIds.add(id)
}

export function releaseLinkId(state: LGraphState, id: LinkId): void {
  const numeric = Number(id)
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > MAX_ID) return
  state.freeLinkIds.add(numeric)
}

export function releaseRerouteId(state: LGraphState, id: RerouteId): void {
  const numeric = Number(id)
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > MAX_ID) return
  state.freeRerouteIds.add(numeric)
}

/**
 * Records that `id` is in use, raising `lastNodeId` to match when it is
 * higher. Never clamped to `MAX_ID`: an observed id is proof an entity with
 * that id already exists, so lying about the high-water mark would let a
 * later mint hand out an id the observed entity already owns. An id in the
 * agent/CRDT reserved-bit range (see {@link AGENT_RESERVED_BIT}) is ignored
 * for this purpose the same way {@link releaseNodeId} ignores it for
 * recycling — that range is a disjoint id space the sequential counter never
 * mints into, so observing it must not drag `lastNodeId` up to match.
 */
export function observeNodeId(state: LGraphState, id: NodeId): void {
  const numericId = Number(id)
  state.freeNodeIds.delete(numericId)
  if (!isValidCounterCandidate(numericId)) return
  if (BigInt(numericId) >= AGENT_RESERVED_BIT) return
  if (numericId > state.lastNodeId) state.lastNodeId = numericId
}

export function observeGroupId(state: LGraphState, id: GroupId): void {
  state.freeGroupIds.delete(id)
  if (isValidCounterCandidate(id) && id > state.lastGroupId) {
    state.lastGroupId = id
  }
}

export function observeLinkId(state: LGraphState, id: LinkId): void {
  const numericId = Number(id)
  state.freeLinkIds.delete(numericId)
  if (
    isValidCounterCandidate(numericId) &&
    numericId > Number(state.lastLinkId)
  ) {
    state.lastLinkId = toLinkId(numericId)
  }
}

export function observeRerouteId(state: LGraphState, id: RerouteId): void {
  const numericId = Number(id)
  state.freeRerouteIds.delete(numericId)
  if (
    isValidCounterCandidate(numericId) &&
    numericId > Number(state.lastRerouteId)
  ) {
    state.lastRerouteId = toRerouteId(numericId)
  }
}
