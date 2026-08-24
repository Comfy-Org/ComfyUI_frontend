import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type {
  ISerialisedNode,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createTestSubgraphData } from './subgraph/__fixtures__/subgraphHelpers'

/**
 * Characterises what a graph is left holding when `configure` throws partway
 * through, and whether any of it survives into the next workflow loaded on the
 * same instance.
 *
 * `LGraph.configure` wraps its body in `try`/`finally` with no `catch`: it has
 * no unwind path. A throw abandons the graph mid-population and propagates. The
 * question this file answers is not "does it unwind cleanly" — it does not —
 * but "is the damage contained to the graph that failed".
 *
 * The tests below record current `main` behaviour, including the places where
 * it leaks. Assertions that pin a leak in place are marked LEAK and are a
 * description of today, not a statement that today is correct.
 *
 * Program context: invariant I3 (no ownership leak on failure); QA-2.
 */

const BAD_ID = '11111111-1111-4111-8111-111111111111'
const GOOD_ID = '22222222-2222-4222-8222-222222222222'
const NESTED_DEFINITION_ID = '33333333-3333-4333-8333-333333333333'

class GoodNode extends LGraphNode {
  constructor() {
    super('good')
    this.addInput('in', '*')
    this.addOutput('out', '*')
    this.addWidget('number', 'seed', 0, () => {})
  }
}

class ThrowingNode extends LGraphNode {
  constructor() {
    super('throwing')
    this.addInput('in', '*')
    this.addOutput('out', '*')
    this.addWidget('number', 'seed', 0, () => {})
  }

  override onConfigure(): void {
    throw new Error('onConfigure exploded')
  }
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  LiteGraph.registerNodeType('test/good', GoodNode)
  LiteGraph.registerNodeType('test/throwing', ThrowingNode)
})

function serialisedNode(id: number, type: string): ISerialisedNode {
  return {
    id,
    type,
    pos: [id * 100, 0],
    size: [140, 60],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [{ name: 'in', type: '*', link: null }],
    outputs: [{ name: 'out', type: '*', links: [] }],
    properties: {},
    widgets_values: [id]
  }
}

/**
 * Three nodes, a link, a reroute and a group. The middle node's type decides
 * whether the load survives, so the same workflow can be loaded both ways and
 * the results compared. `extensionData` represents an extension-owned
 * top-level workflow key that `configure` does not know about.
 *
 * The reroute is deliberately one that a *completed* load discards because its
 * link does not exist. That makes it a marker for how far the load got.
 */
const workflowWithMiddleNode = (type: string) =>
  ({
    id: BAD_ID,
    version: 1,
    revision: 0,
    state: { lastNodeId: 3, lastLinkId: 1, lastGroupId: 1, lastRerouteId: 1 },
    nodes: [
      serialisedNode(1, 'test/good'),
      serialisedNode(2, type),
      serialisedNode(3, 'test/good')
    ],
    links: [
      {
        id: 1,
        origin_id: 1,
        origin_slot: 0,
        target_id: 3,
        target_slot: 0,
        type: '*'
      }
    ],
    reroutes: [{ id: 1, pos: [50, 50], linkIds: [999] }],
    groups: [{ id: 1, title: 'bad group', bounding: [0, 0, 10, 10] }],
    extensionData: { source: 'workflow-that-failed' },
    extra: {}
  }) satisfies SerialisableGraph & {
    extensionData: { source: string }
  }

const failingWorkflow = () => workflowWithMiddleNode('test/throwing')
const sameWorkflowThatLoads = () => workflowWithMiddleNode('test/good')

/** A failure inside a nested definition, before any root node is created. */
const failingNestedWorkflow = (): SerialisableGraph => ({
  id: BAD_ID,
  version: 1,
  revision: 0,
  state: { lastNodeId: 3, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 },
  nodes: [],
  links: [],
  definitions: {
    subgraphs: [
      createTestSubgraphData({
        id: NESTED_DEFINITION_ID,
        name: 'definition that fails to configure',
        nodes: [
          serialisedNode(2, 'test/good'),
          serialisedNode(3, 'test/throwing')
        ]
      })
    ]
  },
  extra: {}
})

const unrelatedWorkflow = (): SerialisableGraph => ({
  id: GOOD_ID,
  version: 1,
  revision: 0,
  state: { lastNodeId: 2, lastLinkId: 1, lastGroupId: 1, lastRerouteId: 1 },
  nodes: [serialisedNode(1, 'test/good'), serialisedNode(2, 'test/good')],
  links: [
    {
      id: 1,
      origin_id: 1,
      origin_slot: 0,
      target_id: 2,
      target_slot: 0,
      type: '*'
    }
  ],
  reroutes: [],
  groups: [{ id: 1, title: 'good group', bounding: [0, 0, 10, 10] }],
  extra: {}
})

function graphAfterFailedConfigure(
  data: SerialisableGraph = failingWorkflow()
) {
  const graph = new LGraph()
  expect(() => graph.configure(data)).toThrow('onConfigure exploded')
  return graph
}

describe('LGraph.configure that throws partway through', () => {
  it('keeps every node it created, including the one that threw', () => {
    const graph = graphAfterFailedConfigure()

    expect(graph.nodes.map((node) => node.type)).toEqual([
      'test/good',
      'test/throwing',
      'test/good'
    ])
    expect(graph.links.size).toBe(1)
  })

  it('keeps a reroute that a completed load would have discarded', () => {
    const completed = new LGraph()
    completed.configure(sameWorkflowThatLoads())
    expect(completed.reroutes.size).toBe(0)
    expect(completed._groups).toHaveLength(1)

    const failed = graphAfterFailedConfigure()

    // The throw happens before reroute validation and before groups are built,
    // so the graph holds a reroute the same data would not have produced.
    expect(failed.reroutes.size).toBe(1)
    expect(failed._groups).toHaveLength(0)
  })

  it('never runs the graph-level onConfigure callback', () => {
    const graph = new LGraph()
    let onConfigureCalls = 0
    graph.onConfigure = () => {
      onConfigureCalls++
    }

    expect(() => graph.configure(failingWorkflow())).toThrow()

    expect(onConfigureCalls).toBe(0)
  })

  it('LEAK: tells `configured` listeners the load finished', () => {
    const graph = new LGraph()
    let configuredEvents = 0
    graph.events.addEventListener('configured', () => {
      configuredEvents++
    })

    expect(() => graph.configure(failingWorkflow())).toThrow()

    // `configured` is dispatched from the `finally` block, so a failed load is
    // indistinguishable from a successful one to every listener. There is no
    // failure-carrying event on LGraphEventMap.
    expect(configuredEvents).toBe(1)
  })

  it('LEAK: a nested definition that fails stays registered on an otherwise empty graph', () => {
    const graph = new LGraph()
    const created: string[] = []
    graph.events.addEventListener('subgraph-created', (event) => {
      created.push(event.detail.subgraph.id)
    })

    expect(() => graph.configure(failingNestedWorkflow())).toThrow()

    // The definition is registered, and `subgraph-created` has already told
    // listeners (node-def registration, among others) about it. LGraphEventMap
    // has no removal counterpart, so nothing retracts it.
    expect(created).toEqual([NESTED_DEFINITION_ID])
    expect(graph.subgraphs.has(NESTED_DEFINITION_ID)).toBe(true)

    // Nothing else made it in, so the graph reports itself as empty while
    // still holding the definition.
    expect(graph.empty).toBe(true)
  })
})

describe('a workflow loaded after a failed load, on the same graph', () => {
  it('serialises identically to the same workflow on a fresh graph', () => {
    const reused = graphAfterFailedConfigure()
    reused.configure(unrelatedWorkflow())
    const reusedSerialized = reused.serialize()

    // Release the reused graph's store entities before configuring a second
    // graph with the same workflow id: the dedicated stores are keyed by root
    // graph id, and two live graphs claiming the same id are a collision the
    // stores resolve by reminting (see ADR-0003), which is not what this test
    // is about.
    reused.clear()

    const fresh = new LGraph()
    fresh.configure(unrelatedWorkflow())

    expect(reusedSerialized).toEqual(fresh.serialize())
  })

  it('holds no node, link, reroute or group from the failed load', () => {
    const graph = graphAfterFailedConfigure()
    graph.configure(unrelatedWorkflow())

    expect(graph.getNodeById(toNodeId(3))).toBeUndefined()
    expect(graph.nodes.map((node) => node.type)).toEqual([
      'test/good',
      'test/good'
    ])
    expect(graph.reroutes.size).toBe(0)
    expect(graph._groups.map((group) => group.title)).toEqual(['good group'])
    expect(graph.id).toBe(GOOD_ID)
  })

  it('holds no widget state or subgraph definition from the failed load', () => {
    const store = useWidgetValueStore()
    const failedWidget = widgetId(BAD_ID, toNodeId(1), 'seed')

    const graph = graphAfterFailedConfigure()
    expect(store.getWidget(failedWidget)).toBeDefined()

    graph.configure(unrelatedWorkflow())

    expect(store.getWidget(failedWidget)).toBeUndefined()

    const nested = graphAfterFailedConfigure(failingNestedWorkflow())
    nested.configure(unrelatedWorkflow())
    expect(nested.subgraphs.has(NESTED_DEFINITION_ID)).toBe(false)
  })

  it('LEAK: keeps top-level workflow keys that `configure` does not recognise', () => {
    const graph = graphAfterFailedConfigure()
    graph.configure(unrelatedWorkflow())

    // `configure` copies every key not in LGraph.ConfigureProperties straight
    // onto the instance, and `clear()` only resets the properties it knows
    // about. The successor workflow has no `extensionData` key, so the failed
    // workflow's value is still there — on a graph that otherwise believes it
    // is the good workflow. Not serialised today, which is the only reason
    // this does not reach disk.
    expect(Reflect.get(graph, 'extensionData')).toEqual({
      source: 'workflow-that-failed'
    })
    expect(Reflect.get(new LGraph(), 'extensionData')).toBeUndefined()
  })
})
