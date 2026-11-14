import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { NodeHandle } from '@/platform/nodeApi/v4/types'
import type { HookCallbacks, HookName } from './nodeHooks'

export interface HookSource {
  callbacksFor<K extends HookName>(
    type: string,
    hook: K
  ): readonly HookCallbacks[K][]
  demand(hook: HookName): number
  /** Changes each time an extension's hooks are removed from a type. */
  revision(): number
}

/** Calls each current callback for `hook` with a node's handle, isolated; nothing for a node outside a graph. */
export type Deliver = <K extends HookName, R>(
  type: string,
  hook: K,
  node: LGraphNode,
  call: (callback: HookCallbacks[K], node: NodeHandle) => R
) => readonly (R | undefined)[]

/** Puts one dispatcher on a class's prototype, or on a node whose own method hides the prototype's. */
export type MethodInstaller = (target: LGraphNode, type: string) => void

export interface DispatchContext {
  readonly deliver: Deliver
  readonly source: HookSource
  readonly copyOfSaved: SavedCopier
  isInGraph(node: LGraphNode): boolean
  /** True if the node's class, or one it extends, is a class registered through the API's index. */
  isMadeFromKnownClass(node: LGraphNode): boolean
}
