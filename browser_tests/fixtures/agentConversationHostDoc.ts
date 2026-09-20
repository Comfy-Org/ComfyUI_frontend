import {
  applyOps,
  linksMap,
  mint,
  project,
  readGraph
} from '@comfyorg/comfy-multi-player'
import type {
  ApplyOutcome,
  GraphSnapshot,
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type { ServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import { DOC_PROTOCOL_VERSION } from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'

import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { mintWireOps } from '@/workbench/extensions/agent/crdt/opEnvelope'

const HOST_ACTOR = 'agent:comfy:host'

type HostLinkTuple = [
  id: number,
  fromNode: string | number,
  fromSlot: number,
  toNode: string | number,
  toSlot: number,
  type: string
]

// The shape the fake host puts on the wire; production's parseServerDocFrame
// validates each one at send time.
export interface HostFrame {
  type: ServerDocFrame['type']
  data: Record<string, unknown>
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'))
}

// The doc host stand-in: the real library in-process, only the transport is local.
export class HostDoc {
  private readonly doc: Y.Doc
  private seq = 1

  constructor(
    private readonly workflowId: string,
    seed: WorkflowJSON,
    private readonly catalog: WidgetCatalog
  ) {
    this.doc = mint(seed, catalog)
  }

  graph(): GraphSnapshot {
    return readGraph(this.doc)
  }

  // The canonical workflow the library projects from the document: the
  // nodes, titles, inputs and link tuples the canvas is expected to show.
  projection(): WorkflowJSON {
    return project(this.doc, this.catalog)
  }

  subscribed(): HostFrame {
    return {
      type: 'doc_subscribed',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: this.workflowId,
        ok: true,
        seq: this.seq
      }
    }
  }

  catchUp(stateVectorB64: string): HostFrame {
    const update = Y.encodeStateAsUpdate(this.doc, fromBase64(stateVectorB64))
    return this.updateFrame(update, HOST_ACTOR, [])
  }

  // The applier below is the only judge of a recorded op; the cast hands it
  // the structural record and nothing reads the ops as typed before it runs.
  apply(operations: RecordedGraphOperation[]): HostFrame {
    const before = Y.encodeStateVector(this.doc)
    const ops = mintWireOps(operations as GraphOperation[], {
      actor: HOST_ACTOR,
      baseVersion: this.seq
    })
    const result = applyOps(this.doc, ops, this.catalog)
    const rejected = result.outcomes.filter((o) => o.outcome !== 'applied')
    if (rejected.length > 0)
      throw new Error(
        `conversation graph_ops did not apply: ${JSON.stringify(rejected)}`
      )
    this.seq += 1
    return this.updateFrame(
      Y.encodeStateAsUpdate(this.doc, before),
      HOST_ACTOR,
      ops.map((op) => op.op_id)
    )
  }

  /**
   * Applies ops that already carry wire identity (`op_id`/`actor`/
   * `base_version`/`stamp`) — e.g. an `Op[]` captured straight off an app's
   * own outbound `doc_ops` frame — through the same production applier
   * {@link apply} uses, without its all-or-nothing invariant. A losing write
   * is not an error here: its outcome (`lww-dropped`) is returned instead of
   * thrown, so a test can assert on the applier's real conflict resolution
   * (see PM-1251 — two actors independently minting a wire op for the same
   * node id, resolved by last-write-wins over `(base_version, actor, op_id)`
   * with the loser silently dropped).
   */
  applyWireOps(ops: Op[]): { frame: HostFrame; outcomes: ApplyOutcome[] } {
    const before = Y.encodeStateVector(this.doc)
    const result = applyOps(this.doc, ops, this.catalog)
    this.seq += 1
    return {
      frame: this.updateFrame(
        Y.encodeStateAsUpdate(this.doc, before),
        ops[0]?.actor ?? HOST_ACTOR,
        ops.map((op) => op.op_id)
      ),
      outcomes: result.outcomes
    }
  }

  replaceLink(link: HostLinkTuple): HostFrame {
    const before = Y.encodeStateVector(this.doc)
    const replacement = new Y.Array<unknown>()
    replacement.push(link)
    linksMap(this.doc).set(String(link[0]), replacement)
    this.seq += 1
    return this.updateFrame(
      Y.encodeStateAsUpdate(this.doc, before),
      HOST_ACTOR,
      []
    )
  }

  link(id: number): unknown {
    const link = linksMap(this.doc).get(String(id))
    return link instanceof Y.Array ? link.toJSON() : link
  }

  // A human tab's batch arrives already enveloped. It is applied as sent and
  // answered the way the relay answers, then broadcast like any host write.
  applyClient(ops: Op[]): HostFrame[] {
    const before = Y.encodeStateVector(this.doc)
    const { outcomes } = applyOps(this.doc, ops, this.catalog)
    const rejected = outcomes.find((o) => o.outcome === 'rejected')
    const applied = outcomes
      .filter((o) => o.outcome === 'applied')
      .map((o) => o.op_id)
    const skipped = outcomes
      .filter((o) => o.outcome === 'no-op' || o.outcome === 'lww-dropped')
      .map((o) => o.op_id)
    const result: HostFrame = {
      type: 'doc_ops_result',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: this.workflowId,
        ok: rejected === undefined,
        applied,
        skipped,
        ...(rejected?.outcome === 'rejected' && {
          failed: {
            index: outcomes.indexOf(rejected),
            op_id: rejected.op_id,
            code: rejected.reason.code,
            message: rejected.reason.message
          }
        })
      }
    }
    if (applied.length === 0) return [result]
    this.seq += 1
    return [
      result,
      this.updateFrame(
        Y.encodeStateAsUpdate(this.doc, before),
        ops[0].actor,
        applied
      )
    ]
  }

  private updateFrame(
    update: Uint8Array,
    actor: string,
    opIds: string[]
  ): HostFrame {
    return {
      type: 'doc_update',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: this.workflowId,
        seq: this.seq,
        update_b64: toBase64(update),
        actor,
        op_ids: opIds
      }
    }
  }
}
