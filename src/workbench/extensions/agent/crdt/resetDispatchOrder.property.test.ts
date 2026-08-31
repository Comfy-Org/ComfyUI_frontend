import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import type { DocFrameTransport } from './docFrameClient'
import { DocFrameClient } from './docFrameClient'
import { LayoutFollowerBridge } from './layoutFollowerBridge'

const WORKFLOW_ID = 'reset-order-workflow'

class ResetTransport extends EventTarget implements DocFrameTransport {
  send(): boolean {
    return true
  }

  deliverReset(seq: number): void {
    this.dispatchEvent(
      new CustomEvent('doc_reset', {
        detail: { v: 1, workflow_id: WORKFLOW_ID, seq }
      })
    )
  }
}

describe('doc_reset dispatch order (property)', () => {
  it('notifies every consumer while the old follower lineage is still live', () => {
    fc.assert(
      fc.property(fc.nat(), (seq) => {
        const transport = new ResetTransport()
        const client = new DocFrameClient(transport)
        const bridge = new LayoutFollowerBridge(client)
        bridge.subscribe(WORKFLOW_ID)
        const oldFollower = bridge.follower
        let observedFollower = null as typeof oldFollower | null

        bridge.addEventListener('doc_reset', () => {
          observedFollower = bridge.follower
        })
        transport.deliverReset(seq)

        expect(observedFollower).toBe(oldFollower)
        expect(bridge.follower).not.toBe(oldFollower)
        expect(bridge.follower.stateVector()).toEqual(
          Y.encodeStateVector(new Y.Doc())
        )
        bridge.destroy()
        client.destroy()
      })
    )
  })
})
