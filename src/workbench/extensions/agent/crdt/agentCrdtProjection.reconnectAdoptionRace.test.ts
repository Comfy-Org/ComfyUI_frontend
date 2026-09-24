import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import { useLitegraphService } from '@/services/litegraphService'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'

/**
 * A hand-wired link on an autogrow node's spare slot must survive the CRDT
 * follower applying that same connect — the exact op the mint port sends
 * when the user wires the slot by hand — and a later same-session
 * `loadGraphData()` reload while the follower stays bound to the same doc.
 *
 * Regression for the gap `agentAutogrowHandWiredLinkSurvivesSend.spec.ts`
 * left as a follow-up: the echo of the hand-wire displaces the slot's local,
 * optimistic link with the doc-confirmed one, and that displacement used to
 * leave the slot reading back disconnected.
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
    const projection = new AgentCrdtProjection(() => graph)
    projection.bind(WORKFLOW_ID, follower)

    let seq = 0
    const deliver = (): void => {
      const update = Y.encodeStateAsUpdate(host)
      follower.applyRemoteUpdate(update)
      expect(
        projection.applyFrame({
          workflowId: WORKFLOW_ID,
          seq: ++seq,
          update,
          actor: 'agent:comfy:host',
          opIds: []
        })
      ).not.toBeNull()
    }
    /** The host applies real ops and the follower applies the echo, as
     * `AgentFollowerHostSocket` does in the Playwright fixture. */
    const hostApplies = (ops: object[]): void => {
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
      expect(
        projection.applyFrame({
          workflowId: WORKFLOW_ID,
          seq,
          update,
          actor: 'agent:comfy:host',
          opIds: [opId]
        })
      ).not.toBeNull()
    }

    // First agent turn: materializing the seeded connect grows the group's
    // free spare slot (`the autogrow group offers a free slot after the
    // first connect`, mirroring `agentAutogrowHandWiredLinkFixture.ts`).
    deliver()
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
    projection.syncFromDoc(WORKFLOW_ID)

    expect(readSinkSlots(graph, sink.id)).toEqual(afterHandWire)
  })
})
