import {
  applyOps,
  hasAppliedOp,
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
import type { WireOpEnvelope } from '@e2e/fixtures/agentWireFrame'
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

/** What the host answers to one client `doc_ops` batch. */
export interface WireApplyResult {
  result: HostFrame
  /** The doc delta the applied ops produced; null when nothing landed. */
  update: HostFrame | null
  outcomes: ApplyOutcome[]
}

type RejectedOutcome = Extract<ApplyOutcome, { outcome: 'rejected' }>

function isRejected(outcome: ApplyOutcome): outcome is RejectedOutcome {
  return outcome.outcome === 'rejected'
}

// `WireOpEnvelope` only claims `op`/`op_id`; a real wire op also carries
// `actor` (enforced by `applyOps`'s own `validateEnvelope`), read here
// advisorily for the broadcast `doc_update`'s `actor` field only.
function advisoryActor(op: WireOpEnvelope | undefined): string {
  return op !== undefined && 'actor' in op && typeof op.actor === 'string'
    ? op.actor
    : HOST_ACTOR
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

  /**
   * The server's REFUSAL of a subscribe: `docService` nil (`unsupported`), an
   * overloaded host, or the per-session document cap
   * (`services/agent/server/events_doc_frames.go`). The turn itself can still
   * report success, so this is the shape that leaves a CRDT-flagged workflow
   * with no canvas frame at all — crdtdeliv-1 case (1).
   */
  subscribeRefused(reason: string): HostFrame {
    return {
      type: 'doc_subscribed',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: this.workflowId,
        ok: false,
        reason
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

  // A batch the client minted itself (envelope included), answered the way
  // the relay answers a human write: one `doc_ops_result`, then the delta as
  // a `doc_update` when anything landed. The applier stays the only judge.
  //
  // Per `ApplyOutcome`'s contract (comfy-multi-player `dist/types.d.ts`
  // ~L456-461): `applied` counts every op that consumed its `op_id` THIS
  // call, including LWW-dropped writes and delete-wins no-ops (protocol-level
  // applies); `skipped` is idempotency only — an `op_id` the document had
  // already applied before this call OR earlier in this same batch. This
  // fixture derives that split by walking `outcomes` in order and advancing a
  // seen-ID set as it goes (seeded from `hasAppliedOp`, the ADR-004 read
  // surface, `dist/read.d.ts` L133), so a same-batch duplicate op_id is
  // classified by position, not just by pre-batch state — without the
  // package's deprecated `result.applied`/`result.skipped` accessors
  // (`dist/applier.js` L183-199, marked "Remove in 0.3").
  //
  // `ops` is typed `WireOpEnvelope`, not `Op`: a deferred kind such as
  // `reset_doc` must reach the real applier verbatim so its `op_deferred` +
  // abort-remainder verdict runs, rather than being filtered out upstream
  // (`parseWireOps`). `applyOps`'s declared parameter is `Op[]`, but its own
  // `ApplyFailure.op` field is typed `WireOp` because a rejected `reset_doc`
  // genuinely reaches it (`dist/types.d.ts` ~L437-440) — the cast below
  // matches that documented runtime contract; `WireOpEnvelope` only claims
  // the two fields `parseWireOps` actually validated upstream of this call.
  applyWire(ops: WireOpEnvelope[]): WireApplyResult {
    const before = Y.encodeStateVector(this.doc)
    const seen = new Set(
      ops.filter((op) => hasAppliedOp(this.doc, op.op_id)).map((o) => o.op_id)
    )
    const { outcomes } = applyOps(this.doc, ops as Op[], this.catalog)
    const applied: string[] = []
    const skipped: string[] = []
    for (const outcome of outcomes) {
      if (outcome.outcome === 'rejected') continue
      if (seen.has(outcome.op_id)) {
        skipped.push(outcome.op_id)
      } else {
        applied.push(outcome.op_id)
        seen.add(outcome.op_id)
      }
    }
    const rejected = outcomes.find(isRejected)
    if (applied.length > 0) this.seq += 1
    const result: HostFrame = {
      type: 'doc_ops_result',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: this.workflowId,
        ok: rejected === undefined,
        seq: this.seq,
        applied,
        skipped,
        ...(rejected && {
          failed: {
            index: outcomes.indexOf(rejected),
            op_id: rejected.op_id,
            code: rejected.reason.code,
            message: rejected.reason.message
          }
        })
      }
    }
    const update =
      applied.length > 0
        ? this.updateFrame(
            Y.encodeStateAsUpdate(this.doc, before),
            advisoryActor(ops[0]),
            applied
          )
        : null
    return { result, update, outcomes }
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
