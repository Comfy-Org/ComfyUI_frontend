import { mint } from '@comfyorg/comfy-multi-player'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LiteGraph, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraphData,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { reportError } from '@/platform/telemetry/reportError'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.

import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { readSubgraphDefinitions } from './agentSubgraphDefinitions'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'

import {
  CATALOG,
  DummyNode,
  ThrowsOnConfigureNode,
  configuredWidgetValues,
  nodePayload,
  remoteMutations,
  setConfigureShouldThrow,
  setupMaterializerFixtures
} from './__fixtures__/agentNodeMaterializer'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

beforeEach(() => {
  setupMaterializerFixtures()
})

describe('reconcileAgentAdapters', () => {
  describe('subgraph definitions', () => {
    /**
     * Deliver a full-document frame minted from `workflow` to a fresh follower
     * bound to `graph`, the way the first frame of a session (or a reseed
     * after `doc_reset`) arrives.
     */
    function seedDocument(graph: LGraph, workflow: Parameters<typeof mint>[0]) {
      const host = mint(workflow, CATALOG)
      const follower = new FollowerDoc()
      const adapter = new EcsFollowerAdapter(
        remoteMutations(graphScopeOf(graph))
      )
      adapter.bind('workflow', follower)
      const update = Y.encodeStateAsUpdate(host)
      follower.applyRemoteUpdate(update)
      expect(
        adapter.applyFrame({
          workflowId: 'workflow',
          seq: 1,
          update,
          actor: 'agent:test',
          opIds: []
        })
      ).toBe(true)
      return { host, follower, adapter }
    }

    let disableSubgraphNodeCreation: () => void
    let graph: LGraph
    let created: ReturnType<typeof vi.fn<(event: Event) => void>>

    beforeEach(() => {
      graph = new LGraph()
      // Unit-test analog of the `subgraph-created` handler in `app.ts` that
      // registers each new subgraph as a node type.
      disableSubgraphNodeCreation = enableSubgraphNodeCreation(graph)
      created = vi.fn<(event: Event) => void>()
      graph.events.addEventListener('subgraph-created', created)
    })

    afterEach(() => {
      disableSubgraphNodeCreation()
    })

    /**
     * Regression: an agent-seeded workflow carrying `definitions.subgraphs`
     * materialized its subgraph instance as a `has_errors` "missing node"
     * placeholder because the follower only read the root `nodes`/`links`
     * maps. The definition never reached `LGraph.createSubgraphs`, so
     * `subgraph-created` never fired and no `SubgraphNode` type was registered.
     */
    it('regression: materializes an agent-added subgraph instance as a SubgraphNode via the subgraph-created lifecycle', () => {
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7)]
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      expect(
        reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))
      ).toEqual([toNodeId(1)])

      expect(graph.subgraphs.has(definition.id)).toBe(true)
      expect(created).toHaveBeenCalledOnce()
      const instance = graph.getNodeById(toNodeId(1))
      expect(instance).toBeInstanceOf(SubgraphNode)
      expect(instance?.has_errors).toBeFalsy()
      assert(instance instanceof SubgraphNode)
      expect(instance.subgraph.nodes).toHaveLength(1)
      // Interior nodes belong to the subgraph, never to the root scope.
      expect(graph._nodes).toHaveLength(1)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('registers a definition once across repeated reconciles', () => {
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7)]
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })
      const definitions = readSubgraphDefinitions(follower.doc)

      reconcileAgentAdapters(graph, definitions)
      const subgraph = graph.subgraphs.get(definition.id)
      const instance = graph.getNodeById(toNodeId(1))

      // Every applied frame reconciles again with the same definitions.
      expect(reconcileAgentAdapters(graph, definitions)).toEqual([])

      expect(created).toHaveBeenCalledOnce()
      expect(graph.subgraphs.get(definition.id)).toBe(subgraph)
      expect(graph.getNodeById(toNodeId(1))).toBe(instance)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('does not treat a definition payload as an edit to an existing subgraph', () => {
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7)]
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))
      const registered = graph.subgraphs.get(definition.id)

      reconcileAgentAdapters(graph, [
        {
          ...definition,
          name: 'replacement must not apply',
          nodes: [nodePayload(8)]
        }
      ])

      expect(graph.subgraphs.get(definition.id)).toBe(registered)
      expect(registered?.nodes.map((node) => node.id)).toEqual([toNodeId(7)])
      expect(created).toHaveBeenCalledOnce()
      expect(reportError).not.toHaveBeenCalled()
    })

    it('carries interior widget values into the instantiated subgraph', () => {
      const definition = createTestSubgraphData({
        nodes: [{ ...nodePayload(7, 'widget-node'), widgets_values: [42] }]
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))

      const instance = graph.getNodeById(toNodeId(1))
      assert(instance instanceof SubgraphNode)
      const interior = instance.subgraph.getNodeById(toNodeId(7))
      expect(interior?.widgets?.[0]?.value).toBe(42)
    })

    it('matches widget values to definitions by id when one definition nests another', () => {
      // createSubgraphs hoists nested definitions into its return value, so
      // the created subgraphs outnumber the definitions handed in.
      const inner = createTestSubgraphData({
        nodes: [{ ...nodePayload(30, 'widget-node'), widgets_values: [1] }]
      })
      const outer = createTestSubgraphData({
        nodes: [
          { ...nodePayload(20, 'widget-node'), widgets_values: [2] },
          nodePayload(21, inner.id)
        ],
        definitions: { subgraphs: [inner] }
      })
      const sibling = createTestSubgraphData({
        nodes: [{ ...nodePayload(10, 'widget-node'), widgets_values: [3] }]
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, outer.id), nodePayload(2, sibling.id)],
        links: [],
        definitions: { subgraphs: [outer, sibling] }
      })

      reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))

      const widgetValue = (definitionId: string, nodeId: number) =>
        graph.subgraphs.get(definitionId)?.getNodeById(toNodeId(nodeId))
          ?.widgets?.[0]?.value
      expect(widgetValue(inner.id, 30)).toBe(1)
      expect(widgetValue(outer.id, 20)).toBe(2)
      expect(widgetValue(sibling.id, 10)).toBe(3)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('keeps a registered definition when a later frame nests a copy of it', () => {
      const inner = createTestSubgraphData({
        nodes: [nodePayload(30, 'widget-node')]
      })
      const outer = createTestSubgraphData({
        nodes: [nodePayload(21, inner.id)],
        definitions: { subgraphs: [inner] }
      })
      const first = seedDocument(graph, {
        nodes: [nodePayload(1, inner.id)],
        links: [],
        definitions: { subgraphs: [inner] }
      })
      reconcileAgentAdapters(graph, readSubgraphDefinitions(first.follower.doc))
      const registered = graph.subgraphs.get(inner.id)
      const instance = graph.getNodeById(toNodeId(1))
      assert(instance instanceof SubgraphNode)
      expect(instance.subgraph).toBe(registered)

      const second = seedDocument(graph, {
        nodes: [nodePayload(1, inner.id), nodePayload(2, outer.id)],
        links: [],
        definitions: { subgraphs: [inner, outer] }
      })
      reconcileAgentAdapters(
        graph,
        readSubgraphDefinitions(second.follower.doc)
      )

      expect(graph.subgraphs.get(inner.id)).toBe(registered)
      expect(graph.subgraphs.has(outer.id)).toBe(true)
      expect(created).toHaveBeenCalledTimes(2)
      expect(graph.getNodeById(toNodeId(2))).toBeInstanceOf(SubgraphNode)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('registers the missing child of an already registered parent', () => {
      const inner = createTestSubgraphData({
        nodes: [nodePayload(30, 'widget-node')]
      })
      const outer = createTestSubgraphData({
        nodes: [nodePayload(21, 'widget-node')]
      })
      const first = seedDocument(graph, {
        nodes: [nodePayload(1, outer.id)],
        links: [],
        definitions: { subgraphs: [outer] }
      })
      reconcileAgentAdapters(graph, readSubgraphDefinitions(first.follower.doc))
      const registered = graph.subgraphs.get(outer.id)

      const second = seedDocument(graph, {
        nodes: [nodePayload(1, outer.id), nodePayload(2, inner.id)],
        links: [],
        definitions: {
          subgraphs: [{ ...outer, definitions: { subgraphs: [inner] } }]
        }
      })
      reconcileAgentAdapters(
        graph,
        readSubgraphDefinitions(second.follower.doc)
      )

      expect(graph.subgraphs.get(outer.id)).toBe(registered)
      expect(graph.subgraphs.has(inner.id)).toBe(true)
      expect(created).toHaveBeenCalledTimes(2)
      expect(graph.getNodeById(toNodeId(2))).toBeInstanceOf(SubgraphNode)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('restores interior widget values inside configure(), before onConfigure runs', () => {
      const definition = createTestSubgraphData({
        nodes: [
          { ...nodePayload(7, 'configure-capture'), widgets_values: [42] }
        ]
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })
      expect(LiteGraph.namedValuesRestore).toBe(false)

      reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))

      // A custom node's onConfigure must see the seeded value, the same as it
      // does on the human load path, not the widget default.
      expect(configuredWidgetValues).toEqual([42])
      // The named-restore switch is scoped to registration, not left on.
      expect(LiteGraph.namedValuesRestore).toBe(false)
    })

    it('leaves the named-restore switch as it found it when registration throws', () => {
      setConfigureShouldThrow(true)
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7, 'throws-on-configure')]
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))

      expect(reportError).toHaveBeenCalledOnce()
      expect(LiteGraph.namedValuesRestore).toBe(false)
    })

    it('reports a definition that fails to register and still reconciles the other root nodes', () => {
      setConfigureShouldThrow(true)
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7, 'throws-on-configure')]
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id), nodePayload(2)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      const materialized = reconcileAgentAdapters(
        graph,
        readSubgraphDefinitions(follower.doc)
      )

      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ message: 'interior node rejected' }),
        {
          errorType: 'agent_subgraph_definitions_failed',
          context: { graphId: graph.id, definitionId: definition.id }
        }
      )
      // createSubgraphs registers a definition before configuring it. A
      // failed one is rolled back so the map only holds definitions that
      // finished the lifecycle.
      expect(graph.subgraphs.has(definition.id)).toBe(false)
      // The plain node still materializes. The instance waits for its
      // definition instead of binding to the half-configured attempt.
      expect(materialized).toEqual([toNodeId(2)])
      expect(graph.getNodeById(toNodeId(2))).toBeInstanceOf(DummyNode)
      expect(graph.getNodeById(toNodeId(1))).toBeNull()
    })

    it('still reconciles root nodes when definition rollback lifecycle cleanup throws', () => {
      setConfigureShouldThrow(true)
      vi.spyOn(ThrowsOnConfigureNode.prototype, 'onRemoved').mockImplementation(
        () => {
          throw new Error('extension cleanup failed')
        }
      )
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7, 'throws-on-configure')]
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id), nodePayload(2)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      expect(() =>
        reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))
      ).not.toThrow()
      expect(graph.subgraphs.has(definition.id)).toBe(false)
      expect(graph.getNodeById(toNodeId(2))).toBeInstanceOf(DummyNode)
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.any(AggregateError),
        {
          errorType: 'agent_subgraph_definitions_failed',
          context: { graphId: graph.id, definitionId: definition.id }
        }
      )
    })

    it('retries a failed definition on the next reconcile and reports it once', () => {
      setConfigureShouldThrow(true)
      const definition = createTestSubgraphData({
        nodes: [nodePayload(7, 'throws-on-configure')]
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })
      const definitions = readSubgraphDefinitions(follower.doc)

      expect(reconcileAgentAdapters(graph, definitions)).toEqual([])
      expect(reconcileAgentAdapters(graph, definitions)).toEqual([])
      // Same definition, same failure: one report, not one per frame.
      expect(reportError).toHaveBeenCalledOnce()

      setConfigureShouldThrow(false)
      expect(reconcileAgentAdapters(graph, definitions)).toEqual([toNodeId(1)])

      expect(graph.subgraphs.has(definition.id)).toBe(true)
      const instance = graph.getNodeById(toNodeId(1))
      assert(instance instanceof SubgraphNode)
      expect(instance.has_errors).toBeFalsy()
      expect(instance.subgraph).toBe(graph.subgraphs.get(definition.id))
    })

    it('registers a valid sibling when another definition in the same frame fails', () => {
      setConfigureShouldThrow(true)
      const bad = createTestSubgraphData({
        nodes: [nodePayload(7, 'throws-on-configure')]
      })
      const good = createTestSubgraphData({
        nodes: [nodePayload(8)]
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, bad.id), nodePayload(2, good.id)],
        links: [],
        definitions: { subgraphs: [bad, good] }
      })

      const materialized = reconcileAgentAdapters(
        graph,
        readSubgraphDefinitions(follower.doc)
      )

      expect(materialized).toEqual([toNodeId(2)])
      expect(graph.subgraphs.has(bad.id)).toBe(false)
      expect(graph.subgraphs.has(good.id)).toBe(true)
      expect(graph.getNodeById(toNodeId(2))).toBeInstanceOf(SubgraphNode)
      expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
        errorType: 'agent_subgraph_definitions_failed',
        context: { graphId: graph.id, definitionId: bad.id }
      })
    })

    it('keeps a live nested definition and registers a missing one under an existing outer', () => {
      const inner = createTestSubgraphData({
        nodes: [nodePayload(30)]
      })
      const outer = createTestSubgraphData({
        nodes: [nodePayload(21, inner.id)],
        definitions: { subgraphs: [inner] }
      })
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, outer.id)],
        links: [],
        definitions: { subgraphs: [outer] }
      })
      const definitions = readSubgraphDefinitions(follower.doc)

      // The user (or an earlier frame) already has the inner definition live.
      const liveInner = graph.createSubgraph(inner)
      reconcileAgentAdapters(graph, definitions)
      expect(graph.subgraphs.get(inner.id)).toBe(liveInner)
      expect(graph.subgraphs.has(outer.id)).toBe(true)

      // And the mirror: the outer is live but its nested definition is not.
      const graph2 = new LGraph()
      const disable2 = enableSubgraphNodeCreation(graph2)
      try {
        graph2.createSubgraph({ ...outer, definitions: undefined })
        expect(graph2.subgraphs.has(inner.id)).toBe(false)
        reconcileAgentAdapters(graph2, definitions)
        expect(graph2.subgraphs.has(inner.id)).toBe(true)
      } finally {
        disable2()
      }
      expect(reportError).not.toHaveBeenCalled()
    })

    it('reports and skips a definition whose id is not a UUID instead of remapping it', () => {
      const definition = {
        ...createTestSubgraphData({ nodes: [nodePayload(7)] }),
        id: 'legacy-subgraph'
      }
      const { follower } = seedDocument(graph, {
        nodes: [nodePayload(1, definition.id)],
        links: [],
        definitions: { subgraphs: [definition] }
      })

      reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))

      // createSubgraphs would silently mint a UUID for it, leaving the root
      // node's `type` pointing at an id the doc never registered.
      expect(graph.subgraphs.size).toBe(0)
      expect(created).not.toHaveBeenCalled()
      expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
        errorType: 'agent_subgraph_definitions_failed',
        context: { graphId: graph.id, definitionId: 'legacy-subgraph' }
      })
    })
  })
})
