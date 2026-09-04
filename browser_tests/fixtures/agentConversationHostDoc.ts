import { applyOps, mint, readGraph } from '@comfyorg/comfy-multi-player'
import type {
  GraphSnapshot,
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type { ServerDocWireFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import { DOC_PROTOCOL_VERSION } from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import { mintWireOps } from '@/workbench/extensions/agent/crdt/opEnvelope'

const HOST_ACTOR = 'agent:comfy'

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

  subscribed(): ServerDocWireFrame {
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

  catchUp(stateVectorB64: string): ServerDocWireFrame {
    const update = Y.encodeStateAsUpdate(this.doc, fromBase64(stateVectorB64))
    return this.updateFrame(update, HOST_ACTOR, [])
  }

  // Client batches arrive already minted; the real host folds them into the same
  // doc and broadcasts the result, so every subscriber converges on them.
  applyClient(ops: Op[]): { applied: string[]; update: ServerDocWireFrame } {
    const before = Y.encodeStateVector(this.doc)
    const result = applyOps(this.doc, ops, this.catalog)
    const rejected = result.outcomes.filter((o) => o.outcome !== 'applied')
    if (rejected.length > 0)
      throw new Error(
        `client doc_ops did not apply: ${JSON.stringify(rejected)}`
      )
    this.seq += 1
    const applied = ops.map((op) => op.op_id)
    return {
      applied,
      update: this.updateFrame(
        Y.encodeStateAsUpdate(this.doc, before),
        String(ops[0]?.actor ?? HOST_ACTOR),
        applied
      )
    }
  }

  apply(operations: GraphOperation[]): ServerDocWireFrame {
    const before = Y.encodeStateVector(this.doc)
    const ops = mintWireOps(operations, {
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

  private updateFrame(
    update: Uint8Array,
    actor: string,
    opIds: string[]
  ): ServerDocWireFrame {
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
