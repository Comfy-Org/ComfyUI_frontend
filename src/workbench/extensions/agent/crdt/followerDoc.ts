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
  private highestObservedCounter = 0

  /**
   * `Y.applyUpdate` integrates structs as it decodes them, so a malformed
   * frame would leave the doc holding its readable prefix. Decoding the whole
   * frame first makes the apply all-or-nothing.
   */
  applyRemoteUpdate(update: Uint8Array): void {
    Y.decodeUpdate(update)
    Y.applyUpdate(this.doc, update, REMOTE_DOC_UPDATE_ORIGIN)
    this.updatesApplied++
    this.observeLamportFloor()
    this.dispatchEvent(
      new CustomEvent('update', {
        detail: { update, updatesApplied: this.updatesApplied }
      })
    )
  }

  /**
   * The highest stamp counter this replica has observed: local ops mint above
   * it. It only rises, so a counter the applier later drops from the ledger
   * (a node re-add clears that node's widget stamps) still counts. A doc no
   * frame has seeded yet, or one the schema gate refuses, adds nothing.
   */
  lamportFloor(): number {
    this.observeLamportFloor()
    return this.highestObservedCounter
  }

  private observeLamportFloor(): void {
    try {
      if (readSchemaVersion(this.doc) !== SCHEMA_VERSION) return
      this.raiseFloor(observedDocCounter(this.doc) ?? 0)
    } catch (error) {
      // One unreadable row must not hide the valid counters beside it.
      let skipped = 0
      this.doc.getMap<unknown>('__stamps').forEach((value) => {
        if (isStampTuple(value)) this.raiseFloor(value[0])
        else skipped++
      })
      if (!this.reportedUnreadableFloor) {
        this.reportedUnreadableFloor = true
        reportError(error, {
          surface: 'agent',
          errorType: 'failure_reading_agent_crdt_lamport_floor',
          context: { skippedRows: skipped }
        })
      }
    }
  }

  private raiseFloor(counter: number): void {
    this.highestObservedCounter = Math.max(this.highestObservedCounter, counter)
  }

  stateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc)
  }

  destroy(): void {
    this.doc.destroy()
  }
}

function isStampTuple(value: unknown): value is [number, string, string] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    Number.isSafeInteger(value[0]) &&
    value[0] >= 0 &&
    typeof value[1] === 'string' &&
    typeof value[2] === 'string' &&
    value[2].length > 0
  )
}
