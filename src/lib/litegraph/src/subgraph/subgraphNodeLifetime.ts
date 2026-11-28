import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'

const lifetimes = new WeakMap<LGraphNode, AbortController>()

export function registerSubgraphNodeLifetime(
  node: LGraphNode,
  controller: AbortController
): void {
  lifetimes.set(node, controller)
}

export function closeSubgraphNodeLifetime(node: LGraphNode): void {
  lifetimes.get(node)?.abort()
}
