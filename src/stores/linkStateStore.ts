import { defineStore } from 'pinia'

import type { CanvasColour, Point } from '@/lib/litegraph/src/interfaces'
import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

export type LinkExecutionData =
  | number
  | string
  | boolean
  | { toToolTip?(): string }

export interface LinkPersistentState {
  color?: CanvasColour | null
}

export interface LinkRuntimeState {
  data?: LinkExecutionData
  outputData?: unknown
  position: Point
  lastTime?: number
  path?: Path2D
  centreAngle?: number
  dragging?: boolean
}

export interface LinkState {
  persistent: LinkPersistentState
  runtime: LinkRuntimeState
}

type OwnerStates = Map<OwningGraphId, Map<LinkId, LinkState>>

export function createLinkState(): LinkState {
  return {
    persistent: {},
    runtime: { outputData: null, position: [0, 0] }
  }
}

export const useLinkStateStore = defineStore('linkState', () => {
  const roots = new Map<RootGraphId, OwnerStates>()

  function register(
    scope: GraphScope,
    id: LinkId,
    state: LinkState
  ): LinkState {
    let owners = roots.get(scope.rootGraphId)
    if (!owners) {
      owners = new Map()
      roots.set(scope.rootGraphId, owners)
    }
    let states = owners.get(scope.owningGraphId)
    if (!states) {
      states = new Map()
      owners.set(scope.owningGraphId, states)
    }
    const registered = states.get(id)
    if (registered) return registered
    states.set(id, state)
    return state
  }

  function unregister(
    scope: GraphScope,
    id: LinkId,
    state: LinkState
  ): boolean {
    const owners = roots.get(scope.rootGraphId)
    const states = owners?.get(scope.owningGraphId)
    if (states?.get(id) !== state) return false
    states.delete(id)
    if (!states.size) owners?.delete(scope.owningGraphId)
    if (!owners?.size) roots.delete(scope.rootGraphId)
    return true
  }

  function get(scope: GraphScope, id: LinkId): LinkState | undefined {
    return roots.get(scope.rootGraphId)?.get(scope.owningGraphId)?.get(id)
  }

  return { get, register, unregister }
})
