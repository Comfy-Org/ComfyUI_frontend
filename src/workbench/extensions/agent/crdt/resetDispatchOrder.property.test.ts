import { mint } from '@comfyorg/comfy-multi-player'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import type { DocFrameTransport } from './docFrameClient'
import { DocFrameClient, encodeBase64 } from './docFrameClient'
import { LayoutFollowerBridge } from './layoutFollowerBridge'

const WORKFLOW_ID = 'reset-order-workflow'

class ResetTransport extends EventTarget implements DocFrameTransport {
  send(): boolean {
    return true
  }

  deliver(type: string, data: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail: data }))
  }
}

function hostUpdate(value: unknown): Uint8Array {
  const doc = mint({ nodes: [], links: [] }, { types: {} })
  try {
    doc.getMap('reset-property').set('value', value)
    return Y.encodeStateAsUpdate(doc)
  } finally {
    doc.destroy()
  }
}

describe('doc_reset dispatch order (property)', () => {
  it('notifies every consumer while the old follower lineage is still live', () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.nat(), (value, seq) => {
        const transport = new ResetTransport()
        const client = new DocFrameClient(transport)
        const bridge = new LayoutFollowerBridge(client)
        try {
          bridge.subscribe(WORKFLOW_ID)
          transport.deliver('doc_update', {
            v: 1,
            workflow_id: WORKFLOW_ID,
            seq: 1,
            update_b64: encodeBase64(hostUpdate(value))
          })
          const oldFollower = bridge.follower
          const oldStateVector = oldFollower.stateVector()
          let oldFollowerDestroyed = false
          let destroyedDuringDispatch: boolean | null = null
          let observedFollower = null as typeof oldFollower | null
          let observedReset: unknown
          let observedStateVector: Uint8Array | null = null
          let readError: unknown
          oldFollower.doc.on('destroy', () => {
            oldFollowerDestroyed = true
          })
          bridge.addEventListener('doc_reset', (event) => {
            observedFollower = bridge.follower
            observedReset = event instanceof CustomEvent ? event.detail : null
            destroyedDuringDispatch = oldFollowerDestroyed
            try {
              observedStateVector = oldFollower.stateVector()
            } catch (error) {
              readError = error
            }
          })

          transport.deliver('doc_reset', {
            v: 1,
            workflow_id: WORKFLOW_ID,
            seq
          })

          expect(observedReset).toEqual({ workflowId: WORKFLOW_ID, seq })
          expect(observedFollower).toBe(oldFollower)
          expect(destroyedDuringDispatch).toBe(false)
          expect(readError).toBeUndefined()
          expect(observedStateVector).toEqual(oldStateVector)
          expect(oldFollowerDestroyed).toBe(true)
          expect(bridge.follower).not.toBe(oldFollower)
          expect(bridge.follower.updatesApplied).toBe(0)
        } finally {
          bridge.destroy()
          client.destroy()
        }
      })
    )
  })
})
