import {
  SCHEMA_VERSION,
  mint,
  readSchemaVersion
} from '@comfyorg/comfy-multi-player'
import * as fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

const reportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({ reportError }))

import type { DocFrameTransport } from './docFrameClient'
import { DocFrameClient, encodeBase64 } from './docFrameClient'
import { FollowerDoc } from './followerDoc'
import { LayoutFollowerBridge } from './layoutFollowerBridge'

const WORKFLOW_ID = 'property-workflow'

class PropertyTransport extends EventTarget implements DocFrameTransport {
  readonly sent: string[] = []

  send(frame: string): boolean {
    this.sent.push(frame)
    return true
  }

  deliver(type: string, data: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail: data }))
  }
}

function updateFrame(update: Uint8Array, seq: number) {
  return {
    v: 1,
    workflow_id: WORKFLOW_ID,
    seq,
    update_b64: encodeBase64(update)
  }
}

function validHostUpdate(value: unknown): Uint8Array {
  const doc = mint({ nodes: [], links: [] }, { types: {} })
  try {
    doc.getMap('property').set('value', value)
    return Y.encodeStateAsUpdate(doc)
  } finally {
    doc.destroy()
  }
}

function incrementalUpdates(
  entries: ReadonlyArray<readonly [string, number]>
): { source: Y.Doc; updates: Uint8Array[] } {
  const source = new Y.Doc()
  const values = source.getMap<number>('values')
  const updates = entries.map(([key, value]) => {
    const before = Y.encodeStateVector(source)
    values.set(key, value)
    return Y.encodeStateAsUpdate(source, before)
  })
  return { source, updates }
}

function sentTypes(transport: PropertyTransport): string[] {
  return transport.sent.map((frame) => {
    const parsed = JSON.parse(frame) as { type: string }
    return parsed.type
  })
}

const arbEntries = fc.uniqueArray(
  fc.tuple(fc.string({ minLength: 1, maxLength: 12 }), fc.integer()),
  { minLength: 1, maxLength: 20, selector: ([key]) => key }
)

describe('CRDT follower invariants (property)', () => {
  it('is byte-idempotent under duplicate remote application', () => {
    fc.assert(
      fc.property(
        arbEntries,
        fc.integer({ min: 1, max: 8 }),
        (entries, repeats) => {
          const { source } = incrementalUpdates(entries)
          const update = Y.encodeStateAsUpdate(source)
          const follower = new FollowerDoc()
          try {
            follower.applyRemoteUpdate(update)
            const once = Y.encodeStateAsUpdate(follower.doc)
            for (let index = 0; index < repeats; index++) {
              follower.applyRemoteUpdate(update)
            }

            expect(Y.encodeStateAsUpdate(follower.doc)).toEqual(once)
          } finally {
            follower.destroy()
            source.destroy()
          }
        }
      )
    )
  })

  it('converges under arbitrary reordering and duplication', () => {
    fc.assert(
      fc.property(
        arbEntries.chain((entries) =>
          fc
            .tuple(
              fc.shuffledSubarray(
                entries.map((_, index) => index),
                { minLength: entries.length, maxLength: entries.length }
              ),
              fc.array(fc.integer({ min: 0, max: entries.length - 1 }), {
                maxLength: entries.length * 2
              })
            )
            .map(([order, duplicates]) => ({
              entries,
              delivery: [...order, ...duplicates]
            }))
        ),
        ({ entries, delivery }) => {
          const { source, updates } = incrementalUpdates(entries)
          const follower = new FollowerDoc()
          try {
            for (const index of delivery)
              follower.applyRemoteUpdate(updates[index])

            expect(Y.encodeStateAsUpdate(follower.doc)).toEqual(
              Y.encodeStateAsUpdate(source)
            )
          } finally {
            follower.destroy()
            source.destroy()
          }
        }
      )
    )
  })

  it('withholds causal gaps and requests replay from the retained state vector', () => {
    fc.assert(
      fc.property(
        fc.jsonValue(),
        fc.integer({ min: 3, max: 1000 }),
        (value, gapSeq) => {
          const transport = new PropertyTransport()
          const client = new DocFrameClient(transport)
          const bridge = new LayoutFollowerBridge(client)
          try {
            bridge.subscribe(WORKFLOW_ID)
            transport.deliver(
              'doc_update',
              updateFrame(validHostUpdate(value), 1)
            )
            const retained = bridge.follower
            const retainedVector = encodeBase64(retained.stateVector())

            transport.deliver(
              'doc_update',
              updateFrame(validHostUpdate(value), gapSeq)
            )

            expect(bridge.follower).toBe(retained)
            expect(retained.updatesApplied).toBe(1)
            const subscriptions = transport.sent
              .map(
                (frame) =>
                  JSON.parse(frame) as {
                    type: string
                    data: Record<string, unknown>
                  }
              )
              .filter((frame) => frame.type === 'doc_subscribe')
            expect(subscriptions).toHaveLength(2)
            expect(subscriptions[1].data.state_vector_b64).toBe(retainedVector)
          } finally {
            bridge.destroy()
            client.destroy()
          }
        }
      )
    )
  })

  it('never turns remote updates into leader-bound semantic writes', () => {
    fc.assert(
      fc.property(
        fc.jsonValue(),
        fc.integer({ min: 1, max: 20 }),
        (value, repeats) => {
          const transport = new PropertyTransport()
          const client = new DocFrameClient(transport)
          const bridge = new LayoutFollowerBridge(client)
          try {
            bridge.subscribe(WORKFLOW_ID)
            const update = validHostUpdate(value)

            for (let seq = 1; seq <= repeats; seq++) {
              transport.deliver('doc_update', updateFrame(update, seq))
            }

            expect(sentTypes(transport)).not.toContain('doc_ops')
            expect(sentTypes(transport)).toEqual(['doc_subscribe'])
          } finally {
            bridge.destroy()
            client.destroy()
          }
        }
      )
    )
  })

  it('keeps arbitrary awareness state ephemeral', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.jsonValue()), (state) => {
        const transport = new PropertyTransport()
        const client = new DocFrameClient(transport)
        const bridge = new LayoutFollowerBridge(client)
        const observed: unknown[] = []
        client.addEventListener('awareness', (event) => {
          if (event instanceof CustomEvent) observed.push(event.detail)
        })
        try {
          bridge.subscribe(WORKFLOW_ID)
          transport.deliver(
            'doc_update',
            updateFrame(validHostUpdate('semantic'), 1)
          )
          const before = Y.encodeStateAsUpdate(bridge.follower.doc)

          transport.deliver('awareness', {
            v: 1,
            workflow_id: WORKFLOW_ID,
            actor: 'human:user:tab',
            state
          })

          expect(observed).toEqual([
            {
              workflowId: WORKFLOW_ID,
              actor: 'human:user:tab',
              state
            }
          ])
          expect(Y.encodeStateAsUpdate(bridge.follower.doc)).toEqual(before)
          expect(sentTypes(transport)).toEqual(['doc_subscribe'])
        } finally {
          bridge.destroy()
          client.destroy()
        }
      })
    )
  })

  it('withholds every incompatible schema version from projection', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const incompatibleVersion = fc.oneof(
      fc.integer().filter((version) => version !== SCHEMA_VERSION),
      fc.string(),
      fc.boolean(),
      fc.constant(null)
    )
    fc.assert(
      fc.property(incompatibleVersion, (version) => {
        const transport = new PropertyTransport()
        const client = new DocFrameClient(transport)
        const bridge = new LayoutFollowerBridge(client)
        const doc = mint({ nodes: [], links: [] }, { types: {} })
        const projected: unknown[] = []
        const schemaErrors: unknown[] = []
        bridge.addEventListener('doc_update', (event) => {
          if (event instanceof CustomEvent) projected.push(event.detail)
        })
        bridge.addEventListener('schema_error', (event) => {
          if (event instanceof CustomEvent) schemaErrors.push(event.detail)
        })
        try {
          bridge.subscribe(WORKFLOW_ID)
          doc.getMap('meta').set('schema_version', version)
          const before = Y.encodeStateAsUpdate(doc)
          const found = readSchemaVersion(doc)

          transport.deliver('doc_update', updateFrame(before, 1))

          expect(projected).toEqual([])
          expect(schemaErrors).toEqual([{ workflowId: WORKFLOW_ID, found }])
          expect(bridge.lastSchemaError?.found).toEqual(found)
          expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
        } finally {
          doc.destroy()
          bridge.destroy()
          client.destroy()
        }
      })
    )
  })
})
