import * as fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'

import type {
  ApplyResult,
  SetWidgetOp,
  WidgetCatalog
} from '@comfyorg/comfy-multi-player'
import {
  applyOps,
  hasAppliedOp,
  mint,
  readGraph
} from '@comfyorg/comfy-multi-player'

import type { GraphOperation } from './graphOperations'
import { attachLinkMintPort } from './linkMintPort'
import type { LinkScopeView, LinkTopologyView } from './linkMintPort'
import { mintOpId, mintWireOps } from './opEnvelope'
import { createMintSession } from './mintSession'

const ROOT_SCOPE: LinkScopeView = {
  rootGraphId: 'root-uuid',
  owningGraphId: 'root-uuid'
}

const CATALOG: WidgetCatalog = {
  types: { TestNode: { widget_order: ['seed'] } }
}
const FUZZ_SEED = 16_695

function seedDoc() {
  return mint(
    {
      nodes: [
        {
          id: 1,
          type: 'TestNode',
          pos: [0, 0],
          widgets_values: [3],
          inputs: [],
          outputs: [{ name: 'out', type: 'IMAGE', links: [] }]
        },
        {
          id: 2,
          type: 'TestNode',
          pos: [9, 9],
          widgets_values: [3],
          inputs: [{ name: 'in', type: 'IMAGE', link: null }],
          outputs: []
        }
      ],
      links: []
    },
    CATALOG
  )
}

function envelope(actor = 'human:u1:tab', baseVersion = 1) {
  const stamp: [number, string] = [baseVersion, actor]
  return {
    op_id: mintOpId(),
    actor,
    base_version: baseVersion,
    stamp
  }
}

const arbMalformedSlot = fc.oneof(
  fc.integer({ min: -1000, max: -1 }),
  fc
    .double({ noNaN: false, noDefaultInfinity: false })
    .filter((n) => !Number.isInteger(n)),
  fc.string(),
  fc.constant(null),
  fc.constant(undefined),
  fc.boolean(),
  fc.array(fc.integer(), { maxLength: 3 })
)

type ConnectOperation = Extract<GraphOperation, { op: 'connect' }>

function connectOp(fromSlot: unknown, toSlot: unknown): ConnectOperation {
  const operation: ConnectOperation = {
    op: 'connect',
    link_id: 41,
    from_node: 1,
    from_slot: 0,
    to_node: 2,
    to_slot: 0,
    link_type: 'IMAGE'
  }
  Reflect.set(operation, 'from_slot', fromSlot)
  Reflect.set(operation, 'to_slot', toSlot)
  return operation
}

function expectSlotRejection(outcome: ApplyResult['outcomes'][number]) {
  expect(outcome.outcome).toBe('rejected')
}

describe('QA-12: FE op-ingestion boundary fuzz — malformed connect slot payloads', () => {
  describe('seam 1: attachLinkMintPort rejects malformed litegraph topology', () => {
    it('surfaces malformed slots instead of enqueueing them', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      fc.assert(
        fc.property(
          arbMalformedSlot,
          arbMalformedSlot,
          (originSlot, targetSlot) => {
            error.mockClear()
            const minted: GraphOperation[] = []
            let placed = (
              _scope: LinkScopeView,
              _topology: LinkTopologyView
            ): void => {
              throw new Error('onPlaced was not registered')
            }
            const session = createMintSession()
            const port = attachLinkMintPort({
              events: {
                onPlaced: (listener) => {
                  placed = listener
                  return () => {}
                },
                onDeleted: () => () => {}
              },
              session,
              isEnabled: () => true,
              isDocBound: () => true,
              enqueue: (operations) => minted.push(...operations)
            })

            const malformedTopology = {
              id: 41,
              originNodeId: 1,
              originSlot: 0,
              targetNodeId: 2,
              targetSlot: 0,
              type: 'IMAGE'
            } satisfies LinkTopologyView
            Reflect.set(malformedTopology, 'originSlot', originSlot)
            Reflect.set(malformedTopology, 'targetSlot', targetSlot)

            try {
              placed(ROOT_SCOPE, malformedTopology)
              expect(minted).toHaveLength(0)
              expect(error).toHaveBeenCalledWith(
                expect.stringContaining('invalid link slot'),
                malformedTopology.id
              )
            } finally {
              port.detach()
            }
          }
        ),
        { seed: FUZZ_SEED, numRuns: 200 }
      )
    })
  })

  describe('seam 2: applier rejects malformed connect ops gracefully (never a raw throw)', () => {
    it('applies the well-formed control on the same seed', () => {
      const doc = seedDoc()
      const op = { ...envelope(), ...connectOp(0, 0) }

      const result = applyOps(doc, [op], CATALOG)

      expect(result.outcomes[0].outcome).toBe('applied')
      expect(readGraph(doc).links[41]).toEqual([41, 1, 0, 2, 0, 'IMAGE'])
    })

    it('rejects malformed source and target slots without throwing, doc unchanged', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<'from' | 'to'>('from', 'to'),
          arbMalformedSlot,
          (endpoint, badSlot) => {
            const doc = seedDoc()
            const before = readGraph(doc)
            const op = {
              ...envelope(),
              ...connectOp(
                endpoint === 'from' ? badSlot : 0,
                endpoint === 'to' ? badSlot : 0
              )
            }

            const result = applyOps(doc, [op], CATALOG)

            expect(result.outcomes).toHaveLength(1)
            expectSlotRejection(result.outcomes[0])
            expect(readGraph(doc)).toEqual(before)
          }
        ),
        { seed: FUZZ_SEED, numRuns: 200 }
      )
    })

    it('abort-remainder holds when a malformed source or target slot lands mid-batch', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<'from' | 'to'>('from', 'to'),
          arbMalformedSlot,
          (endpoint, badSlot) => {
            const doc = seedDoc()
            const good1: SetWidgetOp = {
              ...envelope('human:u1:tab', 1),
              op: 'set_widget',
              node_id: 1,
              widget: 'seed',
              value: 7
            }
            const bad = {
              ...envelope('human:u1:tab', 1),
              ...connectOp(
                endpoint === 'from' ? badSlot : 0,
                endpoint === 'to' ? badSlot : 0
              )
            }
            const good2: SetWidgetOp = {
              ...envelope('human:u1:tab', 1),
              op: 'set_widget',
              node_id: 2,
              widget: 'seed',
              value: 9
            }

            const batch = [good1, bad, good2]
            const result = applyOps(doc, batch, CATALOG)

            expect(result.outcomes).toHaveLength(3)
            expect(result.outcomes[0].outcome).toBe('applied')
            expect(hasAppliedOp(doc, good1.op_id)).toBe(true)
            expectSlotRejection(result.outcomes[1])
            const tail = result.outcomes[2]
            expect(tail.outcome === 'rejected' && tail.reason.code).toBe(
              'batch_aborted'
            )
            expect(hasAppliedOp(doc, good2.op_id)).toBe(false)
          }
        ),
        { seed: FUZZ_SEED, numRuns: 100 }
      )
    })
  })

  describe('seam 2b: mintWireOps → applyOps end to end from a real mint-shaped payload', () => {
    it('a malformed connect minted through the real envelope path is rejected, not thrown', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<'from' | 'to'>('from', 'to'),
          arbMalformedSlot,
          (endpoint, badSlot) => {
            const doc = seedDoc()
            const wireOps = mintWireOps(
              [
                connectOp(
                  endpoint === 'from' ? badSlot : 0,
                  endpoint === 'to' ? badSlot : 0
                )
              ],
              {
                actor: 'human:u1:tab',
                baseVersion: 1
              }
            )

            const result = applyOps(doc, wireOps, CATALOG)
            expectSlotRejection(result.outcomes[0])
          }
        ),
        { seed: FUZZ_SEED, numRuns: 100 }
      )
    })
  })
})
