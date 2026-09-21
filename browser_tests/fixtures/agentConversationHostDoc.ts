import { applyOps, linksMap, mint, project } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type { ServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import { mintWireOps } from '@/workbench/extensions/agent/crdt/opEnvelope'

const HOST_ACTOR = 'agent:comfy:host'
const DOC_PROTOCOL_VERSION = 1

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

  apply(operations: GraphOperation[]): HostFrame {
    const before = Y.encodeStateVector(this.doc)
    const ops = mintWireOps(operations, {
      actor: HOST_ACTOR,
      baseVersion: this.seq
    })
    const result = applyOps(this.doc, ops, this.catalog)
    const rejected = result.outcomes.filter(
      (outcome) => outcome.outcome !== 'applied'
    )
    if (rejected.length > 0) {
      throw new Error(
        `graph operations did not apply: ${JSON.stringify(rejected)}`
      )
    }
    this.seq += 1
    return this.updateFrame(
      Y.encodeStateAsUpdate(this.doc, before),
      HOST_ACTOR,
      ops.map((op) => op.op_id)
    )
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

  applyClient(ops: Op[]): HostFrame[] {
    const before = Y.encodeStateVector(this.doc)
    const { outcomes } = applyOps(this.doc, ops, this.catalog)
    const rejected = outcomes.find((outcome) => outcome.outcome === 'rejected')
    const applied = outcomes
      .filter((outcome) => outcome.outcome === 'applied')
      .map((outcome) => outcome.op_id)
    const skipped = outcomes
      .filter(
        (outcome) =>
          outcome.outcome === 'no-op' || outcome.outcome === 'lww-dropped'
      )
      .map((outcome) => outcome.op_id)
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
