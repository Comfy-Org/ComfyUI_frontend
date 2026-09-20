import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { FollowerDoc } from './followerDoc'
import { createGraphMutations } from './graphMutations'

const materializerState = vi.hoisted(() => ({
  reconcileAgentAdapters: vi.fn()
}))

const definitionsState = vi.hoisted(() => ({
  readSubgraphDefinitionIds: vi.fn(),
  readSubgraphDefinitions: vi.fn()
}))

vi.mock(import('./agentNodeMaterializer'), async (importOriginal) => ({
  ...(await importOriginal()),
  reconcileAgentAdapters: materializerState.reconcileAgentAdapters
}))

vi.mock(import('./agentSubgraphDefinitions'), async (importOriginal) => ({
  ...(await importOriginal()),
  readSubgraphDefinitionIds: definitionsState.readSubgraphDefinitionIds,
  readSubgraphDefinitions: definitionsState.readSubgraphDefinitions
}))

vi.mock(import('./devPanelLog'), async (importOriginal) => ({
  ...(await importOriginal()),
  recordDevEvent: vi.fn()
}))

const { AgentCrdtProjection } = await import('./agentCrdtProjection')

const CONTEXT = {
  source: 'agent-remote',
  actor: 'agent-lineage',
  opId: 'doc-reset:1'
} as const

/**
 * The real adapter, over mutations whose scope never resolves: every store
 * write it attempts is rejected, so these cases observe only the projection's
 * own definition-replacement decision.
 */
function scopelessMutations() {
  return createGraphMutations({
    getScope: () => null,
    layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
  })
}

function projectionOver(getGraph: () => LGraph | null) {
  const doc = new Y.Doc()
  return new AgentCrdtProjection(scopelessMutations(), getGraph, () => doc)
}

describe('AgentCrdtProjection definition replacement', () => {
  beforeEach(() => {
    materializerState.reconcileAgentAdapters.mockReset().mockReturnValue([])
    definitionsState.readSubgraphDefinitionIds.mockReset().mockReturnValue([])
    definitionsState.readSubgraphDefinitions.mockReset().mockReturnValue([])
  })

  it('reads the full definition set on a reset even when every incoming id is already registered', () => {
    // The ID-only fast path probes the live root graph, which still holds the
    // outgoing generation's definitions at a lineage break, so nothing reads
    // as missing. Without the unconditional read the replacement document
    // would be left with no definitions to register. The other reset cases
    // start from an empty definition map, so they would still pass if this
    // branch were removed.
    const graph = new LGraph()
    const existing = createTestSubgraph({ rootGraph: graph })
    graph.subgraphs.set(existing.id, existing)
    definitionsState.readSubgraphDefinitionIds.mockReturnValue([existing.id])
    const projection = projectionOver(() => graph)

    projection.clearForReset('wf-1', CONTEXT)

    expect(definitionsState.readSubgraphDefinitions).toHaveBeenCalledOnce()
    expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledWith(
      graph,
      [],
      { replaceSubgraphDefinitions: true }
    )
  })

  it('defers the replacement until a graph exists', () => {
    let graph: LGraph | null = null
    const projection = projectionOver(() => graph)

    projection.clearForReset('wf-1', CONTEXT)
    expect(materializerState.reconcileAgentAdapters).not.toHaveBeenCalled()

    graph = new LGraph()
    projection.reconcileLiveGraph('wf-1')

    expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledWith(
      graph,
      [],
      { replaceSubgraphDefinitions: true }
    )
  })

  it('does not hand a deferred replacement to the next workflow', () => {
    // wf-1 breaks lineage while no graph exists, the binding retargets to
    // wf-2, and only then does a graph appear. wf-2's first reconcile must be
    // an ordinary one: retiring here would retire wf-1's generation out of
    // wf-2's graph.
    let graph: LGraph | null = null
    const projection = projectionOver(() => graph)

    projection.clearForReset('wf-1', CONTEXT)
    projection.bind('wf-2', new FollowerDoc())

    graph = new LGraph()
    projection.reconcileLiveGraph('wf-2')

    expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledWith(
      graph,
      []
    )
  })

  it('still replaces for the workflow that deferred it', () => {
    let graph: LGraph | null = null
    const projection = projectionOver(() => graph)

    projection.clearForReset('wf-1', CONTEXT)
    projection.bind('wf-1', new FollowerDoc())

    graph = new LGraph()
    projection.reconcileLiveGraph('wf-1')

    expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledWith(
      graph,
      [],
      { replaceSubgraphDefinitions: true }
    )
  })

  it('consumes the deferred replacement exactly once', () => {
    let graph: LGraph | null = null
    const projection = projectionOver(() => graph)

    projection.clearForReset('wf-1', CONTEXT)
    graph = new LGraph()
    projection.reconcileLiveGraph('wf-1')
    materializerState.reconcileAgentAdapters.mockClear()

    projection.reconcileLiveGraph('wf-1')

    expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledWith(
      graph,
      []
    )
  })
})
