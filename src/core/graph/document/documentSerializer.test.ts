import { describe, expect, it, vi } from 'vitest'

import { createGraphMutations } from '@/core/graph/graphMutations'
import type { GraphMutations } from '@/core/graph/graphMutations'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { GraphScope } from '@/types/graphScopeId'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { serializeDocumentScope } from './documentSerializer'

const context: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'test',
  opId: 'op-1'
}

function scopeFor(graphId: string): GraphScope {
  return {
    rootGraphId: toRootGraphId(graphId),
    owningGraphId: toOwningGraphId(graphId)
  }
}

function mutationsFor(scope: GraphScope): GraphMutations {
  return createGraphMutations({
    getScope: () => scope,
    layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
  })
}

function widgetNames(scope: GraphScope): string[] {
  const parsed = JSON.parse(
    new TextDecoder().decode(serializeDocumentScope(scope))
  ) as { nodes: { widgets: { name: string }[] }[] }
  return parsed.nodes.flatMap(({ widgets }) => widgets.map(({ name }) => name))
}

describe('serializeDocumentScope', () => {
  it('orders widget names by code unit, not by the ambient collation', () => {
    const scope = scopeFor('root')
    const mutations = mutationsFor(scope)
    mutations.addNode({ id: '1', type: 'Source' }, context)
    mutations.setWidget(toNodeId('1'), 'apples', 1, context)
    mutations.setWidget(toNodeId('1'), 'Bananas', 2, context)

    expect(widgetNames(scope)).toEqual(['Bananas', 'apples'])
  })

  it('serializes a Map-valued widget identically whatever its insertion order', () => {
    const forward = scopeFor('forward')
    const reverse = scopeFor('reverse')
    for (const [scope, entries] of [
      [forward, [['alpha', 1] as const, ['beta', 2] as const]],
      [reverse, [['beta', 2] as const, ['alpha', 1] as const]]
    ] as const) {
      const mutations = mutationsFor(scope)
      mutations.addNode({ id: '1', type: 'Source' }, context)
      mutations.setWidget(toNodeId('1'), 'opaque', new Map(entries), context)
    }

    expect(serializeDocumentScope(forward)).toEqual(
      serializeDocumentScope(reverse)
    )
  })
})
