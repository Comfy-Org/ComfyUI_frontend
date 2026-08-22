/**
 * Follower-seam integration test — the "frame arrived but graph not applied"
 * guard.
 *
 * This wires the WHOLE follower path with NO mocked applier and NO mocked doc:
 *
 *   real @comfyorg/comfy-multi-player applier (initDoc + applyOps add_node)
 *     → Y.encodeStateAsUpdate → base64 update_b64
 *     → a doc_update {type,data} frame delivered on a transport that dispatches
 *       CustomEvents byte-for-byte the way src/scripts/api.ts does for an
 *       unknown server message type (the exact production ingress boundary)
 *     → real DocFrameClient.parseServerDocFrame
 *     → real LayoutFollowerBridge (workflow-id gated) → FollowerDoc.applyRemoteUpdate
 *     → real SemanticProjector.project (reads via the package's nodesMap)
 *     → real LitegraphMutator.applyBatch
 *     → a REAL LGraph, asserted to actually gain the node.
 *
 * This is an integration test, NOT a browser-observable E2E: the WebSocket byte
 * hop and the pixel raster are not exercised. Everything from the api.ts message
 * boundary through the litegraph graph mutation is the real shipping code. It
 * reproduces the class of bug where a frame was received and validated but the
 * canvas never changed (the original bug applied the semantic update into
 * layoutStore, whose root `nodes` map collided, so no node rendered). The
 * browser-observable E2E invariant in AGENTS.md is satisfied separately.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { applyOps, initDoc, nodesMap } from '@comfyorg/comfy-multi-player'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'

import { DocFrameClient, encodeBase64 } from './docFrameClient'
import type { DocFrameTransport } from './docFrameClient'
import { LayoutFollowerBridge } from './layoutFollowerBridge'
import { LitegraphMutator } from './litegraphMutator'
import { SemanticProjector } from './semanticProjector'

const DOC_PROTOCOL_VERSION = 1
const WORKFLOW_ID = 'wf-follower-seam-e2e'
const TEST_NODE_TYPE = 'FollowerSeamE2eNode'

/**
 * Transport double that models ONLY the socket-message ingress: `send` is a
 * no-op (a follower never writes the shared doc — KA-#6), and `deliver`
 * dispatches a CustomEvent exactly as api.ts does for a registered custom type
 * (`new CustomEvent(type, { detail })`). DocFrameClient is the real one.
 */
class FrameTransport extends EventTarget implements DocFrameTransport {
  readonly sent: string[] = []
  send(frame: string): boolean {
    this.sent.push(frame)
    return true
  }
  // addEventListener/removeEventListener are inherited from EventTarget and
  // structurally satisfy DocFrameTransport; no redefinition needed.
  /** Simulate a server → client frame arriving on the socket. */
  deliver(type: string, data: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail: data }))
  }
}

/** A minimal but real litegraph node type so createNode returns a real node. */
class FollowerSeamE2eNode extends LGraphNode {
  static override title = 'Follower Seam E2E Node'
  constructor(title?: string) {
    super(title ?? FollowerSeamE2eNode.title)
  }
}

function hex32(): string {
  let s = ''
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16)
  return s
}

/**
 * Produce a genuine Yjs update the way the doc host would for an agent
 * `add_node` turn: a fresh doc, one stamped add_node op through the REAL
 * applier, then the full-state update encoded for the follower.
 */
function realApplierAddNodeUpdate(): Uint8Array {
  const doc = initDoc(new Y.Doc())
  const op = {
    op: 'add_node' as const,
    op_id: hex32(),
    actor: 'agent',
    base_version: 0,
    stamp: [0, 'agent'] as [number, string],
    node_id: 1,
    class_type: TEST_NODE_TYPE,
    pos: [128, 96],
    // No widgets_values → no catalog required (applier §1.2). The payload is
    // authoritative and inserted verbatim.
    node: { id: 1, type: TEST_NODE_TYPE, pos: [128, 96] }
  }
  const result = applyOps(doc, [op])
  // Sanity: the real applier actually consumed the op into the real doc.
  expect(result.applied).toContain(op.op_id)
  expect(nodesMap(doc).has('1')).toBe(true)
  return Y.encodeStateAsUpdate(doc)
}

describe('follower seam integration (real applier → real seam → real LGraph)', () => {
  beforeAll(() => {
    if (!LiteGraph.registered_node_types[TEST_NODE_TYPE])
      LiteGraph.registerNodeType(TEST_NODE_TYPE, FollowerSeamE2eNode)
  })
  afterAll(() => {
    LiteGraph.unregisterNodeType(TEST_NODE_TYPE)
  })

  it('paints a real applier-produced add_node into a real LGraph', () => {
    const graph = new LGraph()
    expect(graph._nodes.length).toBe(0)

    const transport = new FrameTransport()
    const client = new DocFrameClient(transport)
    const bridge = new LayoutFollowerBridge(client)
    const mutator = new LitegraphMutator({
      getGraph: () => graph,
      createNode: (type) => LiteGraph.createNode(type)
    })
    const projector = new SemanticProjector(mutator, { actor: 'test-follower' })

    // Mirror the composition root: project on every applied doc_update.
    bridge.addEventListener('doc_update', () => {
      projector.project(bridge.follower.doc)
    })

    // Subscribe to the workflow the frame targets (the bridge is id-gated).
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_subscribed', {
      v: DOC_PROTOCOL_VERSION,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 0
    })

    // The doc host pushes the real applier's update as a doc_update frame.
    const update = realApplierAddNodeUpdate()
    transport.deliver('doc_update', {
      v: DOC_PROTOCOL_VERSION,
      workflow_id: WORKFLOW_ID,
      seq: 1,
      update_b64: encodeBase64(update)
    })

    // The canvas graph actually changed — a real node exists, right type/id/pos.
    expect(graph._nodes.length).toBe(1)
    const node = graph.getNodeById(toNodeId(1))
    expect(node).not.toBeNull()
    expect(node?.type).toBe(TEST_NODE_TYPE)
    expect(node?.pos?.[0]).toBe(128)
    expect(node?.pos?.[1]).toBe(96)

    bridge.destroy()
    client.destroy()
  })

  it('ignores a doc_update for a non-subscribed workflow (id gating)', () => {
    const graph = new LGraph()
    const transport = new FrameTransport()
    const client = new DocFrameClient(transport)
    const bridge = new LayoutFollowerBridge(client)
    const mutator = new LitegraphMutator({
      getGraph: () => graph,
      createNode: (type) => LiteGraph.createNode(type)
    })
    const projector = new SemanticProjector(mutator, { actor: 'test-follower' })
    bridge.addEventListener('doc_update', () => {
      projector.project(bridge.follower.doc)
    })

    bridge.subscribe(WORKFLOW_ID)
    const update = realApplierAddNodeUpdate()
    transport.deliver('doc_update', {
      v: DOC_PROTOCOL_VERSION,
      workflow_id: 'some-other-workflow',
      seq: 1,
      update_b64: encodeBase64(update)
    })

    expect(graph._nodes.length).toBe(0)

    bridge.destroy()
    client.destroy()
  })

  it('is idempotent: re-delivering the same update paints exactly one node', () => {
    const graph = new LGraph()
    const transport = new FrameTransport()
    const client = new DocFrameClient(transport)
    const bridge = new LayoutFollowerBridge(client)
    const mutator = new LitegraphMutator({
      getGraph: () => graph,
      createNode: (type) => LiteGraph.createNode(type)
    })
    const projector = new SemanticProjector(mutator, { actor: 'test-follower' })
    bridge.addEventListener('doc_update', () => {
      projector.project(bridge.follower.doc)
    })

    bridge.subscribe(WORKFLOW_ID)
    const update = realApplierAddNodeUpdate()
    const frame = {
      v: DOC_PROTOCOL_VERSION,
      workflow_id: WORKFLOW_ID,
      seq: 1,
      update_b64: encodeBase64(update)
    }
    transport.deliver('doc_update', frame)
    transport.deliver('doc_update', { ...frame, seq: 2 })

    expect(graph._nodes.length).toBe(1)

    bridge.destroy()
    client.destroy()
  })
})
