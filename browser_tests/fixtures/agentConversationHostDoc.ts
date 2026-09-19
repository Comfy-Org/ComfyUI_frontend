import {
  applyOps,
  mint,
  project,
  readGraph
} from '@comfyorg/comfy-multi-player'
import type {
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

  // Human ops arrive already minted (op_id, actor, base_version, stamp), so
  // they go to the applier as-is and every outcome becomes the wire result
  // the relay would send: no-op and LWW-dropped writes are skipped, the first
  // rejection fails the batch and leaves the rest unapplied, and a doc_update
  // echoes whatever was applied. Applying the client's own ops through the
  // real library is what makes the follower's echo path production-shaped.
  applyClientOps(ops: Op[]): { result: HostFrame; update: HostFrame | null } {
    const before = Y.encodeStateVector(this.doc)
    const { outcomes } = applyOps(this.doc, ops, this.catalog)
    const applied = outcomes.flatMap((outcome) =>
      outcome.outcome === 'applied' ? [outcome.op_id] : []
    )
    const skipped = outcomes.flatMap((outcome) =>
      outcome.outcome === 'no-op' || outcome.outcome === 'lww-dropped'
        ? [outcome.op_id]
        : []
    )
    const rejected = outcomes.find((outcome) => outcome.outcome === 'rejected')
    const failed =
      rejected?.outcome === 'rejected'
        ? {
            index: outcomes.indexOf(rejected),
            op_id: rejected.op_id,
            code: rejected.reason.code,
            message: rejected.reason.message
          }
        : undefined
    if (applied.length > 0) this.seq += 1
    const result: HostFrame = {
      type: 'doc_ops_result',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: this.workflowId,
        ok: failed === undefined,
        seq: this.seq,
        applied,
        skipped,
        ...(failed !== undefined && { failed })
      }
    }
    const update =
      applied.length > 0
        ? this.updateFrame(
            Y.encodeStateAsUpdate(this.doc, before),
            ops[0].actor,
            applied
          )
        : null
    return { result, update }
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
