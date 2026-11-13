import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { NodeHandle } from '@/platform/nodeApi/v4/types'
import type { HookCallbacks, HookName } from './nodeHooks'

/** Where the dispatchers find the callbacks packs added. */
export interface HookSource {
  callbacksFor<K extends HookName>(
    type: string,
    hook: K
  ): readonly HookCallbacks[K][]
  demand(hook: HookName): number
}

/**
 * Calls each callback for `hook` on `type` with the node's handle, each in the
 * listener isolation, and gives what each returned. Nothing for a node that is
 * not in a graph.
 */
export type Deliver = <K extends HookName, R>(
  type: string,
  hook: K,
  node: LGraphNode,
  call: (callback: HookCallbacks[K], node: NodeHandle) => R
) => readonly (R | undefined)[]

/** Puts one dispatcher on the prototype of a type's class. */
export type MethodInstaller = (
  nodeClass: typeof LGraphNode,
  type: string
) => void

export interface DispatchContext {
  readonly deliver: Deliver
  readonly source: HookSource
  readonly copyOfSaved: SavedCopier
  isInGraph(node: LGraphNode): boolean
}
