import { describe, expect, it, vi } from 'vitest'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toNodeId } from '@/types/nodeId'
import { createNodeState } from '@/utils/__tests__/litegraphTestUtils'

import { toTurnId } from '../schemas/agentApiSchema'
import { useAgentGeneratedNodesStore } from './agentGeneratedNodesStore'

const rootScope: GraphScope = {
  rootGraphId: toRootGraphId('00000000-0000-0000-0000-000000000001'),
  owningGraphId: toOwningGraphId('00000000-0000-0000-0000-000000000001')
}
const ownerScope: GraphScope = {
  rootGraphId: rootScope.rootGraphId,
  owningGraphId: toOwningGraphId('00000000-0000-0000-0000-000000000002')
}
const otherRootScope: GraphScope = {
  rootGraphId: toRootGraphId('00000000-0000-0000-0000-000000000003'),
  owningGraphId: toOwningGraphId('00000000-0000-0000-0000-000000000003')
}
const agentContext: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'agent:test',
  opId: 'op-1'
}

function graphMutations(scope: GraphScope = rootScope) {
  return createGraphMutations({
    getScope: () => scope,
    layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
  })
}

function payload(id: number) {
  return { id, type: `Type${id}`, pos: [0, 0], size: [100, 100] }
}

function state(id: number, scope: GraphScope = rootScope) {
  return createNodeState({
    id: toNodeId(id),
    graphId: scope.owningGraphId,
    title: `Node ${id}`
  })
}

describe('agentGeneratedNodesStore', () => {
  it.for([
    {
      name: 'live agent',
      actor: 'agent:test',
      hydration: false,
      turn: false,
      marked: true
    },
    {
      name: 'replay without op ids',
      actor: 'agent-replay',
      hydration: false,
      turn: false,
      marked: true
    },
    {
      name: 'human',
      actor: 'human:someone:tab-1',
      hydration: false,
      turn: false,
      marked: false
    },
    {
      name: 'historical hydration',
      actor: 'agent:test',
      hydration: true,
      turn: false,
      marked: false
    },
    {
      name: 'active-turn hydration',
      actor: 'agent:test',
      hydration: true,
      turn: true,
      marked: true
    }
  ])('classifies $name registration', ({ actor, hydration, turn, marked }) => {
    const provenance = useAgentGeneratedNodesStore()
    if (turn) provenance.beginTurn(toTurnId('turn-1'))
    const context = { ...agentContext, actor, ...(hydration && { hydration }) }

    expect(graphMutations().addNode(payload(1), context)).toBe(true)

    expect(
      provenance.generatedAtFor(rootScope, toNodeId(1)) !== undefined
    ).toBe(marked)
  })

  it('spaces a hydration cascade by 90ms and caps it 900ms ahead', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    const provenance = useAgentGeneratedNodesStore()
    provenance.beginTurn(toTurnId('turn-1'))
    const graph = graphMutations()

    for (let id = 1; id <= 12; id++)
      graph.addNode(payload(id), { ...agentContext, hydration: true })

    const stamps = Array.from({ length: 12 }, (_, index) =>
      provenance.generatedAtFor(rootScope, toNodeId(index + 1))
    )
    expect(stamps[0]).toBe(1_000)
    expect(stamps[1]).toBe(1_090)
    expect(stamps[10]).toBe(1_900)
    expect(stamps[11]).toBe(1_900)
    expect(provenance.latestMarkAt(rootScope)).toBe(1_900)
  })

  it('reports generated nodes by root until the turn completion delay', () => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    const provenance = useAgentGeneratedNodesStore()
    const turnId = toTurnId('turn-1')
    provenance.beginTurn(turnId)

    graphMutations().addNode(payload(1), agentContext)

    expect(provenance.activities.get(rootScope.rootGraphId)).toEqual({
      phase: 'working',
      turnId,
      nodes: ['1'],
      shownAt: 1_000
    })

    provenance.finishTurn(turnId)
    vi.advanceTimersByTime(1_200)
    expect(provenance.activities.get(rootScope.rootGraphId)?.phase).toBe(
      'complete'
    )
  })

  it('isolates the same node id by root and owning graph', () => {
    const provenance = useAgentGeneratedNodesStore()
    const nodes = useNodeDataStore()

    nodes.registerNode(rootScope, state(1), agentContext)
    nodes.registerNode(ownerScope, state(2, ownerScope), agentContext)
    nodes.registerNode(otherRootScope, state(1, otherRootScope), agentContext)

    expect(provenance.generatedAtFor(rootScope, toNodeId(1))).toBeTypeOf(
      'number'
    )
    expect(provenance.generatedAtFor(ownerScope, toNodeId(2))).toBeTypeOf(
      'number'
    )
    expect(provenance.generatedAtFor(otherRootScope, toNodeId(1))).toBeTypeOf(
      'number'
    )
    expect(provenance.generatedAtFor(ownerScope, toNodeId(1))).toBeUndefined()
  })

  it('immediately forgets deleted provenance and leaves reused ids clean', () => {
    const provenance = useAgentGeneratedNodesStore()
    const nodes = useNodeDataStore()
    const generated = state(1)
    nodes.registerNode(rootScope, generated, agentContext)

    expect(nodes.deleteNode(rootScope, generated)).toBe(true)
    expect(provenance.generatedAtFor(rootScope, generated.id)).toBeUndefined()

    nodes.registerNode(rootScope, state(1), {
      ...agentContext,
      actor: 'human:someone'
    })
    expect(provenance.generatedAtFor(rootScope, generated.id)).toBeUndefined()
  })

  it('does not transfer provenance through reset and historical reuse', () => {
    const provenance = useAgentGeneratedNodesStore()
    const graph = graphMutations()
    expect(graph.addNode(payload(23), agentContext)).toBe(true)
    expect(provenance.generatedAtFor(rootScope, toNodeId(23))).toBeTypeOf(
      'number'
    )

    expect(graph.clearSemanticGraph(agentContext)).toBe(true)
    expect(
      graph.addNode(payload(23), { ...agentContext, hydration: true })
    ).toBe(true)

    expect(provenance.generatedAtFor(rootScope, toNodeId(23))).toBeUndefined()
  })

  it('clears only the requested owner, then the complete root', () => {
    const provenance = useAgentGeneratedNodesStore()
    const nodes = useNodeDataStore()
    nodes.registerNode(rootScope, state(1), agentContext)
    nodes.registerNode(ownerScope, state(2, ownerScope), agentContext)
    nodes.registerNode(otherRootScope, state(1, otherRootScope), agentContext)

    nodes.clearOwner(ownerScope)
    expect(provenance.generatedAtFor(ownerScope, toNodeId(2))).toBeUndefined()
    expect(provenance.generatedAtFor(rootScope, toNodeId(1))).toBeTypeOf(
      'number'
    )

    nodes.clearGraph(rootScope.rootGraphId)
    expect(provenance.generatedAtFor(rootScope, toNodeId(1))).toBeUndefined()
    expect(provenance.generatedAtFor(otherRootScope, toNodeId(1))).toBeTypeOf(
      'number'
    )
  })

  it('does not mark a registration rejected by an occupied id', () => {
    const provenance = useAgentGeneratedNodesStore()
    const nodes = useNodeDataStore()
    nodes.registerNode(rootScope, state(1))

    expect(
      nodes.registerNode(ownerScope, state(1, ownerScope), agentContext)
    ).toBeUndefined()
    expect(provenance.generatedAtFor(ownerScope, toNodeId(1))).toBeUndefined()
    expect(provenance.generatedAtFor(rootScope, toNodeId(1))).toBeUndefined()
  })
})
