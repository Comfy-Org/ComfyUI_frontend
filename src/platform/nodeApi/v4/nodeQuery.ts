import { isPlainObject } from 'es-toolkit'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
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
  assertOnlyKnownFields(query)
  const { scope = 'visible', type } = query
  assertScope(scope)
  return {
    scope,
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

function assertOnlyKnownFields(query: unknown): asserts query is object {
  if (!isPlainObject(query)) {
    throw invalidArgument('queryNodes', 'a query object', query)
  }
  const unknownField = Object.keys(query).find(
    (field) => !Object.hasOwn(FIELDS, field)
  )
  if (unknownField !== undefined) {
    throw invalidArgument(
      'queryNodes',
      `a query of ${Object.keys(FIELDS).join(' and ')} only`,
      unknownField
    )
  }
}

function assertScope(scope: unknown): asserts scope is NodeQueryScope {
  if (typeof scope !== 'string' || !Object.hasOwn(SCOPES, scope)) {
    throw invalidArgument(
      'queryNodes',
      `a scope of ${Object.keys(SCOPES).join(' or ')}`,
      scope
    )
  }
}
