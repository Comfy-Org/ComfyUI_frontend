import { mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type { ServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'

const HOST_ACTOR = 'agent:comfy:host'
const DOC_PROTOCOL_VERSION = 1

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
    catalog: WidgetCatalog
  ) {
    this.doc = mint(seed, catalog)
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
