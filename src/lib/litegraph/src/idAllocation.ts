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

/**
 * `previous` carries the coordination-free arming across a state swap. Clearing
 * a graph replaces this object, and losing the arming there would silently drop
 * a bound replica back to sequential ids until the next doc frame re-armed it.
 */
export function createLGraphState(previous?: LGraphState): LGraphState {
  const state: LGraphState = {
    lastGroupId: 0,
    lastNodeId: 0,
    lastLinkId: toLinkId(0),
    lastRerouteId: toRerouteId(0)
  }
  if (previous !== undefined && coordinationFreeStates.has(previous))
    coordinationFreeStates.add(state)
  return state
}

/**
 * Shared-document ids occupy a disjoint safe-integer range so two replicas
 * seeded from the same snapshot do not allocate the same next node or link.
 */
export const MINT_ID_MIN = 2 ** 40
export const MINT_ID_CEILING = 2 ** 53
const MINT_ID_SPAN = MINT_ID_CEILING - MINT_ID_MIN

const coordinationFreeStates = new WeakSet<LGraphState>()

function defaultRandom(): number {
  const crypto = globalThis.crypto
  if (crypto?.getRandomValues) {
    const words = new Uint32Array(2)
    crypto.getRandomValues(words)
    return (words[0] * 2 ** 21 + (words[1] >>> 11)) / 2 ** 53
  }
  return Math.random()
}

function isSequentialCounter(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < MINT_ID_MIN
}

/**
 * Narrows a serialized counter write to the sequential range, accepting the
 * numeric strings legacy workflow payloads still carry.
 */
export function toSequentialCounter(value: unknown): number | undefined {
  if (typeof value === 'string' && value.trim() === '') return undefined
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  const numeric = Number(value)
  return isSequentialCounter(numeric) ? numeric : undefined
}

export function setCoordinationFreeIds(
  state: LGraphState,
  enabled: boolean
): void {
  if (enabled) coordinationFreeStates.add(state)
  else coordinationFreeStates.delete(state)
}

export function mintCoordinationFreeId(
  random: () => number = defaultRandom
): number {
  const sample = random()
  const bounded = Number.isFinite(sample)
    ? Math.min(Math.max(sample, 0), 1 - Number.EPSILON)
    : 0
  return MINT_ID_MIN + Math.floor(bounded * MINT_ID_SPAN)
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

export function observeNodeId(state: LGraphState, id: NodeId): void {
  const numericId = Number(id)
  if (isSequentialCounter(numericId) && numericId > state.lastNodeId) {
    state.lastNodeId = numericId
  }
}

export function observeGroupId(state: LGraphState, id: GroupId): void {
  const numericId = Number(id)
  if (isSequentialCounter(numericId) && numericId > state.lastGroupId)
    state.lastGroupId = numericId
}

export function observeLinkId(state: LGraphState, id: LinkId): void {
  const numericId = Number(id)
  if (isSequentialCounter(numericId) && numericId > Number(state.lastLinkId))
    state.lastLinkId = toLinkId(numericId)
}

export function observeRerouteId(state: LGraphState, id: RerouteId): void {
  const numericId = Number(id)
  if (isSequentialCounter(numericId) && numericId > Number(state.lastRerouteId))
    state.lastRerouteId = toRerouteId(numericId)
}
