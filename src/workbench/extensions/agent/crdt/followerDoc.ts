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
   * and leaves ordering to the sender's own cursor. Unreadable ledger rows
   * are skipped (reported once per doc) so they never hide the valid ones.
   */
  lamportFloor(): number {
    try {
      if (readSchemaVersion(this.doc) !== SCHEMA_VERSION) return 0
      const { counter, skipped } = observedDocCounter(this.doc, {
        skipMalformed: true
      })
      if (skipped > 0) {
        this.reportUnreadableFloor(
          new Error('agent CRDT stamp ledger has unreadable rows'),
          skipped
        )
      }
      return counter ?? 0
    } catch (error) {
      this.reportUnreadableFloor(error)
      return 0
    }
  }

  private reportUnreadableFloor(error: unknown, skippedRows?: number): void {
    if (this.reportedUnreadableFloor) return
    this.reportedUnreadableFloor = true
    reportError(error, {
      surface: 'agent',
      errorType: 'failure_reading_agent_crdt_lamport_floor',
      context: { skippedRows }
    })
  }

  stateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc)
  }

  destroy(): void {
    this.doc.destroy()
  }
}
