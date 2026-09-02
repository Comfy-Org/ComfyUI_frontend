/**
 * QA-12: fuzz the FE op-ingestion boundary with malformed `connect` payloads
 * (the from_slot-class gaps: negatives, floats, NaN, wrong types).
 *
 * Two seams, both exercised end to end rather than mocked:
 *
 *  1. `attachLinkMintPort` (litegraph → `GraphOperation`, `linkMintPort.ts`):
 *     litegraph is untyped at the FE/native boundary, so a corrupted
 *     `originSlot`/`targetSlot` (e.g. a reroute-chain edge case, a stale
 *     topology snapshot) can reach `onPlaced` at runtime even though
 *     `LinkTopologyView` declares `number`. This port has no runtime guard
 *     today; it forwards whatever it is given straight into the mint queue. The fuzz asserts that forwarding
 *     never throws and never silently coerces to a different in-range value.
 *
 *  2. `mintWireOps` (`opEnvelope.ts`) → `applyOps` (the pinned
 *     `@comfyorg/comfy-multi-player` applier, same code the doc host runs):
 *     the sender attaches wire identity but performs no payload validation
 *     (`opEnvelope.ts`, `opSender.ts` — grep confirms no slot check anywhere
 *     in the FE write leg). The applier is the actual gate. This fuzz proves
 *     that gate holds for the from_slot-class inputs: every malformed
 *     `connect` comes back as a typed `rejected` outcome carrying the slot
 *     reason code (never a thrown `OpRejectedError` escaping `applyOps`),
 *     and, mirroring the existing abort-remainder vector in
 *     `applierConformance.test.ts`, a malformed op inside a batch aborts
 *     only the remainder, never the valid prefix already applied. A
 *     well-formed control on the same seed is asserted `applied` so the
 *     rejections are caused by the slot and not by the fixture.
 */
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import type {
  ApplyResult,
  Op,
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
  return {
    op_id: mintOpId(),
    actor,
    base_version: baseVersion,
    stamp: [baseVersion, actor] as [number, string]
  }
}

/** The from_slot-class gap generator: negatives, floats, NaN, and wrong types. */
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

const SLOT_REJECTION_CODE = 'output_slot_missing'

function connectOp(fromSlot: unknown): GraphOperation {
  return {
    op: 'connect',
    link_id: 41,
    from_node: 1,
    from_slot: fromSlot as number,
    to_node: 2,
    to_slot: 0,
    link_type: 'IMAGE'
  }
}

function expectSlotRejection(outcome: ApplyResult['outcomes'][number]) {
  expect(outcome.outcome).toBe('rejected')
  if (outcome.outcome === 'rejected') {
    expect(outcome.reason.code).toBe(SLOT_REJECTION_CODE)
  }
}

describe('QA-12: FE op-ingestion boundary fuzz — malformed connect slot payloads', () => {
  describe('seam 1: attachLinkMintPort forwards litegraph topology without crashing', () => {
    it('never throws for any from_slot/to_slot-class malformed value', () => {
      fc.assert(
        fc.property(
          arbMalformedSlot,
          arbMalformedSlot,
          (originSlot, targetSlot) => {
            const minted: GraphOperation[] = []
            let placed:
              | ((scope: LinkScopeView, topology: LinkTopologyView) => void)
              | null = null
            const session = createMintSession()
            attachLinkMintPort({
              events: {
                onPlaced: (listener) => {
                  placed = listener
                  return () => {
                    placed = null
                  }
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
              originSlot: originSlot as unknown as number,
              targetNodeId: 2,
              targetSlot: targetSlot as unknown as number,
              type: 'IMAGE'
            } as LinkTopologyView

            expect(() => placed?.(ROOT_SCOPE, malformedTopology)).not.toThrow()
            // Forwarding never coerces: whatever reached the port is what
            // reaches the mint queue verbatim, never silently repaired into
            // a different, wrong slot.
            expect(minted).toHaveLength(1)
            const op = minted[0] as Extract<GraphOperation, { op: 'connect' }>
            expect(op.from_slot).toBe(originSlot)
            expect(op.to_slot).toBe(targetSlot)
          }
        ),
        { numRuns: 200 }
      )
    })
  })

  describe('seam 2: applier rejects malformed connect ops gracefully (never a raw throw)', () => {
    it('applies the well-formed control on the same seed', () => {
      const doc = seedDoc()
      const op = { ...envelope(), ...connectOp(0) } as unknown as Op

      const result = applyOps(doc, [op], CATALOG)

      expect(result.outcomes[0].outcome).toBe('applied')
      expect(readGraph(doc).links[41]).toEqual([41, 1, 0, 2, 0, 'IMAGE'])
    })

    it('rejects a from_slot-class malformed connect without throwing, doc unchanged', () => {
      fc.assert(
        fc.property(arbMalformedSlot, (badSlot) => {
          const doc = seedDoc()
          const before = readGraph(doc)
          const op = { ...envelope(), ...connectOp(badSlot) } as unknown as Op

          let result: ApplyResult | undefined
          expect(() => {
            result = applyOps(doc, [op], CATALOG)
          }).not.toThrow()

          expect(result!.outcomes).toHaveLength(1)
          // Never a raw TypeError escaping: a typed rejection carrying the
          // slot reason code is the only failure mode.
          expectSlotRejection(result!.outcomes[0])
          expect(readGraph(doc)).toEqual(before)
        }),
        { numRuns: 200 }
      )
    })

    it('abort-remainder holds when a from_slot-class malformed connect lands mid-batch', () => {
      fc.assert(
        fc.property(arbMalformedSlot, (badSlot) => {
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
            ...connectOp(badSlot)
          } as unknown as Op
          const good2: SetWidgetOp = {
            ...envelope('human:u1:tab', 1),
            op: 'set_widget',
            node_id: 2,
            widget: 'seed',
            value: 9
          }

          const batch = [good1 as Op, bad, good2 as Op]
          const result = applyOps(doc, batch, CATALOG)

          expect(result.outcomes).toHaveLength(3)
          expect(result.outcomes[0].outcome).toBe('applied')
          expect(hasAppliedOp(doc, good1.op_id)).toBe(true)
          expectSlotRejection(result.outcomes[1])
          // The tail after the failure is the abort-remainder protocol's
          // territory, never applied in the same batch as the failure.
          expect(hasAppliedOp(doc, good2.op_id)).toBe(false)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('seam 2b: mintWireOps → applyOps end to end from a real mint-shaped payload', () => {
    it('a malformed connect minted through the real envelope path is rejected, not thrown', () => {
      fc.assert(
        fc.property(arbMalformedSlot, (badSlot) => {
          const doc = seedDoc()
          const wireOps = mintWireOps([connectOp(badSlot)], {
            actor: 'human:u1:tab',
            baseVersion: 1
          })

          let result: ApplyResult | undefined
          expect(() => {
            result = applyOps(doc, wireOps, CATALOG)
          }).not.toThrow()
          expectSlotRejection(result!.outcomes[0])
        }),
        { numRuns: 100 }
      )
    })
  })
})
