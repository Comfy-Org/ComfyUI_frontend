import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { checkedFields } from '@/platform/nodeApi/v4/checkedFields'
import type { NodeQuery, NodeQueryScope } from './types'

const SCOPES = {
  visible: true,
  'root-and-subgraphs': true
} satisfies Record<NodeQueryScope, true>

const FIELDS = {
  scope: true,
  type: true
} satisfies Record<keyof NodeQuery, true>

interface CheckedNodeQuery {
  readonly scope: NodeQueryScope
  readonly selects: (node: LGraphNode) => boolean
}

/** Refuses a query an untyped caller got wrong, before any node is read. */
export function checkedNodeQuery(query: NodeQuery): CheckedNodeQuery {
  const { scope, type } = checkedFields('queryNodes', 'a query', query, FIELDS)
  return {
    scope: checkedScope('queryNodes', scope),
    selects: type === undefined ? () => true : nodeOfType(type)
  }
}

/** True for a node whose type is exactly `type`. Refuses anything but a name. */
export function nodeOfExactType(type: unknown): (node: LGraphNode) => boolean {
  if (typeof type !== 'string') {
    throw invalidArgument('nodesOfType', 'a type name', type)
  }
  return (node) => node.type === type
}

function nodeOfType(type: unknown): (node: LGraphNode) => boolean {
  if (typeof type === 'string') return nodeOfExactType(type)
  if (Array.isArray(type)) {
    const unusable = type.findIndex((name) => typeof name !== 'string')
    if (unusable !== -1) {
      throw invalidArgument('queryNodes', 'a type name', type[unusable])
    }
    const types = new Set<unknown>(type)
    return (node) => types.has(node.type)
  }
  throw invalidArgument(
    'queryNodes',
    'a type name or a list of type names',
    type
  )
}

/** A scope `queryNodes` and `onNodeChanged` take; `undefined` is `'visible'`. */
export function checkedScope(member: string, scope: unknown): NodeQueryScope {
  if (scope === undefined) return 'visible'
  if (!isScope(scope)) {
    throw invalidArgument(
      member,
      `a scope of ${Object.keys(SCOPES).join(' or ')}`,
      scope
    )
  }
  return scope
}

function isScope(scope: unknown): scope is NodeQueryScope {
  return typeof scope === 'string' && Object.hasOwn(SCOPES, scope)
}

/** The graphs a scope covers, given the graph on screen: none without one. */
export function graphsIn(
  scope: NodeQueryScope,
  visible: LGraph | null | undefined
): readonly LGraph[] {
  if (!visible) return []
  if (scope === 'visible') return [visible]
  const { rootGraph } = visible
  return [rootGraph, ...rootGraph.subgraphs.values()]
}
