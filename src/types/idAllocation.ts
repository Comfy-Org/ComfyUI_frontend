import { toGroupId } from './groupId'
import type { GroupId } from './groupId'
import { toLinkId } from './linkId'
import type { LinkId } from './linkId'
import { toNodeId } from './nodeId'
import type { NodeId } from './nodeId'
import { toRerouteId } from './rerouteId'
import type { RerouteId } from './rerouteId'

export interface LGraphState {
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

export function mintNodeId(state: LGraphState): NodeId {
  return toNodeId(++state.lastNodeId)
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

export function snapshotIdState(state: LGraphState): LGraphState {
  return { ...state }
}

export function restoreIdState(
  state: LGraphState,
  snapshot: LGraphState
): void {
  Object.assign(state, snapshot)
}
