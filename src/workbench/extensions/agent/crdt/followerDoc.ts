import {
  SCHEMA_VERSION,
  observedDocCounter,
  readSchemaVersion
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import { reportError } from '@/platform/telemetry/reportError'

const REMOTE_DOC_UPDATE_ORIGIN = Symbol('remote-doc-update')

export class FollowerDoc extends EventTarget {
  readonly doc = new Y.Doc()
  updatesApplied = 0
  private reportedUnreadableFloor = false

  /**
   * `Y.applyUpdate` integrates structs as it decodes them, so a malformed
   * frame would leave the doc holding its readable prefix. Decoding the whole
   * frame first makes the apply all-or-nothing.
   */
  applyRemoteUpdate(update: Uint8Array): void {
    Y.decodeUpdate(update)
    Y.applyUpdate(this.doc, update, REMOTE_DOC_UPDATE_ORIGIN)
    this.updatesApplied++
    this.dispatchEvent(
      new CustomEvent('update', {
        detail: { update, updatesApplied: this.updatesApplied }
      })
    )
  }

  /**
   * The highest stamp counter this replica holds: local ops mint above it.
   * A doc no frame has seeded yet, or one the schema gate refuses, reads 0
   * and leaves ordering to the sender's own cursor. A malformed stamp ledger
   * is reported once per doc and also reads 0, so local edits keep flowing.
   */
  lamportFloor(): number {
    if (readSchemaVersion(this.doc) !== SCHEMA_VERSION) return 0
    try {
      return observedDocCounter(this.doc) ?? 0
    } catch (error) {
      if (!this.reportedUnreadableFloor) {
        this.reportedUnreadableFloor = true
        reportError(error, {
          surface: 'agent',
          errorType: 'failure_reading_agent_crdt_lamport_floor'
        })
      }
      return 0
    }
  }

  stateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc)
  }

  destroy(): void {
    this.doc.destroy()
  }
}
