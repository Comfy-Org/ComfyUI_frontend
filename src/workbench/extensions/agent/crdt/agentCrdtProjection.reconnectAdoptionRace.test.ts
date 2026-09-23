import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import { useLitegraphService } from '@/services/litegraphService'
import { app } from '@/scripts/app'
import { graphScopeOf } from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import { FollowerDoc } from './followerDoc'
import { createGraphMutations } from './graphMutations'

/**
 * A hand-wired link on an autogrow node's spare slot must survive the CRDT
 * follower's own reconcile of that same connect — the exact op the mint port
 * sends when the user wires the slot by hand — and a later same-session
 * `loadGraphData()` reload while the follower stays bound to the same doc.
 *
 * Regression for the gap `agentAutogrowHandWiredLinkSurvivesSend.spec.ts`
 * left as a follow-up (see its history): reload after the hand-wire
 * deterministically dropped the link, with or without SLOW_MO, across every
 * retry. The root cause has nothing to do with reload specifically — reload
 * only makes it visible with nothing else around to paper over it. It is a
 * cache-invalidation gap between two separately-timed steps:
 *
 * 1. A CRDT `connect` mutation registers a link's topology in
 *    {@link useLinkStore} (`graphMutations.ts`'s `commit()`), synchronously,
 *    inside `AgentCrdtProjection.applyFrame`.
 * 2. `agentNodeMaterializer.ts`'s `reconcileAgentAdapters` gives that
 *    topology its live LiteGraph facade (`materializeLinkAdapter`,
 *    `LLink.ts`) on the *next* pass, inside `reconcileLiveGraph`.
 *
 * When a `connect` REPLACES an existing occupant at the same input slot
 * (`graphMutations.ts`'s `commit()` calling `detachLinkSlots` for the
 * displaced occupant), that detach reads the slot's live `.link` — which,
 * for a slot already backed by a real `NodeInputSlot`, resolves through
 * `graph.links` (`LinkMap.ts`), a cache keyed on `useLinkStore`'s revision
 * counter. That read lands between steps 1 and 2 above: the new topology is
 * registered (the revision the read is keyed against already reflects it)
 * but not yet materialized, so `LinkMap` caches "no facade" for it. Because
 * step 2 alone never touches the revision counter, nothing tells `LinkMap`
 * to recompute once the facade actually lands — the slot reads back
 * disconnected (`originNodeId: null`) from then on, until something
 * unrelated happens to bump the revision again. A hand-wire onto a freshly
 * grown autogrow spare is exactly this: the slot's *local, optimistic* link
 * (minted by the plain `LGraphNode.connect()` call the drag makes) gets
 * displaced by the *doc-confirmed* one the mint port's op echoes back.
 *
 * Ordinarily some later, unrelated store write bumps the revision counter
 * again shortly after and self-heals the cache before anyone reads it — an
 * agent's next turn, a widget edit, a layout write. A same-session reload is
 * exactly the case with nothing left to do that: `loadGraphData` clears and
 * rebuilds the graph from its own serialization (already missing the link,
 * since the corruption predates the reload), and the follower, still bound
 * to the same doc, reconciles the fresh graph without ever unbinding or
 * resubscribing — so there is nothing further to paper over the gap.
 */

const GROUP = 'model.images'
const WORKFLOW_ID = 'wf-a'

class TestSource extends LGraphNode {
  static override title = 'Test Source'
  constructor() {
    super('Test Source')
    this.addOutput('image', 'IMAGE')
    this.serialize_widgets = true
  }
}

/** Mirrors the real GPT Image node's `model.images.image_N` autogrow group. */
class TestAutogrowSink extends LGraphNode {
  static override title = 'Test Autogrow Sink'
  constructor() {
    super('Test Autogrow Sink')
    this.serialize_widgets = true
    useLitegraphService().addNodeInput(
      this,
      transformInputSpecV1ToV2(
        [
          'COMFY_AUTOGROW_V3',
          {
            template: {
              input: { required: { image: ['IMAGE', {}] } },
              names: ['image_1', 'image_2', 'image_3', 'image_4'],
              min: 0
            }
          }
        ],
        { name: GROUP, isOptional: false }
      )
    )
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    TestSource: { widget_order: [] },
    TestAutogrowSink: { widget_order: [] }
  }
}
const layout = {
  createNode: () => {},
  deleteNodes: () => {},
  deleteGroups: () => {}
}

function remoteMutations(scope: GraphScope) {
  return createGraphMutations({
    getScope: () => scope,
    layout,
    placement: inertPlacementPort
  })
}

function createRegisteredNode(type: string): LGraphNode {
  const node = LiteGraph.createNode(type)
  if (!node) throw new Error(`${type} not registered`)
  return node
}

/** Autogrow input slots on the sink, in array order, with link origins. */
function readSinkSlots(graph: LGraph, sinkId: NodeId) {
  const sink = graph.getNodeById(sinkId)
  if (!sink) return null
  return sink.inputs.map((input, index) => ({
    name: input.name,
    origin: sink.getInputLink(index)?.origin_id ?? null
  }))
}

/** Forces `app.configuringGraph`, as `LGraph.prototype.configure` does for
 * the duration of every real `configure()` call once `app.setup()` has
 * installed its wrapper — never installed in this unit test's isolation. */
function withConfiguringGraph<T>(fn: () => T): T {
  Object.defineProperty(app, 'configuringGraph', {
    get: () => true,
    configurable: true
  })
  try {
    return fn()
  } finally {
    delete (app as unknown as Record<string, unknown>).configuringGraph
  }
}

beforeEach(() => {
  LiteGraph.registerNodeType('TestSource', TestSource)
  LiteGraph.registerNodeType('TestAutogrowSink', TestAutogrowSink)
})

describe('AgentCrdtProjection keeps a hand-wired autogrow link connected', () => {
  it('after the CRDT follower reconciles that same connect, and after a later same-session reload', () => {
    const graph = new LGraph()
    const sourceAgent = createRegisteredNode('TestSource')
    graph.add(sourceAgent)
    sourceAgent.pos = [0, 0]
    const sink = createRegisteredNode('TestAutogrowSink')
    graph.add(sink)
    sink.pos = [400, 0]
    const sourceHand = createRegisteredNode('TestSource')
    graph.add(sourceHand)
    sourceHand.pos = [0, 200]

    const scope = graphScopeOf(graph)
    // The doc's starting graph: one source wired into the autogrow node's
    // first slot (an earlier agent turn), the hand-wire source present but
    // unconnected so the later `connect` op can reference it without an
    // `add_node` round trip.
    const host = mint(
      {
        nodes: [
          {
            id: sourceAgent.id,
            type: 'TestSource',
            outputs: [{ name: 'image', type: 'IMAGE', links: [9001] }]
          },
          {
            id: sink.id,
            type: 'TestAutogrowSink',
            inputs: [{ name: `${GROUP}.image_1`, type: 'IMAGE', link: 9001 }]
          },
          {
            id: sourceHand.id,
            type: 'TestSource',
            outputs: [{ name: 'image', type: 'IMAGE', links: [] }]
          }
        ],
        links: [[9001, sourceAgent.id, 0, sink.id, 0, 'IMAGE']]
      },
      CATALOG
    )
    const follower = new FollowerDoc()
    const projection = new AgentCrdtProjection(
      remoteMutations(scope),
      () => graph,
      () => follower.doc
    )
    projection.bind(WORKFLOW_ID, follower)

    let seq = 0
    /** Delivers one host frame exactly as `useAgentCrdtFollower.ts`'s
     * `applyAndReconcile` does: apply the frame, then reconcile. */
    const deliver = (): boolean => {
      const update = Y.encodeStateAsUpdate(host)
      follower.applyRemoteUpdate(update)
      const committed = projection.applyFrame({
        workflowId: WORKFLOW_ID,
        seq: ++seq,
        update,
        actor: 'agent:comfy:host',
        opIds: []
      })
      projection.reconcileLiveGraph(WORKFLOW_ID)
      return committed
    }
    /** The host applies real ops and the follower reconciles the echo, as
     * `AgentFollowerHostSocket` does in the Playwright fixture. */
    const hostApplies = (ops: object[]): boolean => {
      const before = Y.encodeStateVector(host)
      const opId = `op-${++seq}`
      applyOps(
        host,
        ops.map((payload) => ({
          op_id: opId,
          actor: 'test',
          base_version: seq,
          stamp: [seq, 'test'],
          ...payload
        })) as Parameters<typeof applyOps>[1],
        CATALOG
      )
      const update = Y.encodeStateAsUpdate(host, before)
      follower.applyRemoteUpdate(update)
      const committed = projection.applyFrame({
        workflowId: WORKFLOW_ID,
        seq,
        update,
        actor: 'agent:comfy:host',
        opIds: [opId]
      })
      projection.reconcileLiveGraph(WORKFLOW_ID)
      return committed
    }

    // First agent turn: materializing the seeded connect grows the group's
    // free spare slot (`the autogrow group offers a free slot after the
    // first connect`, mirroring `agentAutogrowHandWiredLinkFixture.ts`).
    expect(deliver()).toBe(true)
    expect(readSinkSlots(graph, sink.id)).toEqual([
      { name: `${GROUP}.image_1`, origin: String(sourceAgent.id) },
      { name: `${GROUP}.image_2`, origin: null }
    ])

    // The user hand-wires the free slot directly on the live canvas — the
    // same runtime path a UI drag-connect takes — and, as the real mint
    // port does for every connect regardless of how it was made, that
    // connect is also sent to, and accepted by, the host doc.
    const freeIndex = sink.inputs.findIndex(
      (input, index) =>
        input.name.startsWith(`${GROUP}.`) && !sink.isInputConnected(index)
    )
    expect(freeIndex).toBeGreaterThanOrEqual(0)
    expect(sourceHand.connect(0, sink, freeIndex)).toBeTruthy()
    expect(
      hostApplies([
        {
          op: 'connect',
          link_id: 9002,
          from_node: sourceHand.id,
          from_slot: 0,
          to_node: sink.id,
          link_type: 'IMAGE',
          grow: { name: `${GROUP}.image_2`, type: 'IMAGE' }
        }
      ])
    ).toBe(true)

    // The point of the fix: the mint port's own echo of the hand-wire —
    // which displaces the slot's local, optimistic link with the doc's
    // confirmed one — must not leave the slot reading back disconnected.
    const afterHandWire = readSinkSlots(graph, sink.id)
    expect(afterHandWire).toEqual([
      { name: `${GROUP}.image_1`, origin: String(sourceAgent.id) },
      { name: `${GROUP}.image_2`, origin: String(sourceHand.id) },
      { name: `${GROUP}.image_3`, origin: null }
    ])

    // A same-session reload (`window.app.loadGraphData()`) while the
    // follower stays subscribed/live: rebuilds the graph from its own
    // serialization, then the follower's next reconcile pass runs again
    // without ever unbinding or resubscribing.
    const serialized = structuredClone(graph.serialize())
    withConfiguringGraph(() => graph.configure(serialized))
    projection.reconcileLiveGraph(WORKFLOW_ID)

    expect(readSinkSlots(graph, sink.id)).toEqual(afterHandWire)
  })
})
