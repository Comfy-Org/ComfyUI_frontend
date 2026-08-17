import type { LGraphNode } from './LGraphNode'

export type NodeTypeDisabledPredicate = (nodeType: typeof LGraphNode) => boolean

let nodeTypeDisabledPredicate: NodeTypeDisabledPredicate | undefined

export function setNodeTypeDisabledPredicate(
  predicate: NodeTypeDisabledPredicate | undefined
): void {
  nodeTypeDisabledPredicate = predicate
}

export function isNodeTypeDisabled(nodeType: typeof LGraphNode): boolean {
  return nodeTypeDisabledPredicate?.(nodeType) === true
}
