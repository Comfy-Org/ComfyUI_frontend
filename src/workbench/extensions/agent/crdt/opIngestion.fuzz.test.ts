import { fromAny } from '@total-typescript/shoehorn'
import * as fc from 'fast-check'
import { assert, describe, expect, it } from 'vitest'

import type { ApplyResult, WidgetCatalog } from '@comfyorg/comfy-multi-player'

import {
  OP_INGESTION_FUZZ_CONFIG,
  arbMalformedSlot
} from '@/testing/opIngestionFuzzConfig'
import { applyOps, mint } from '@comfyorg/comfy-multi-player'

import type { GraphOperation } from './graphOperations'
import { attachLinkMintPort } from './linkMintPort'
import type { LinkScopeView, LinkTopologyView } from './linkMintPort'
import { mintWireOps } from './opEnvelope'
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

const SLOT_REJECTION_CODES = {
  from: 'output_slot_missing',
  toNumber: 'input_slot_missing',
  toOther: 'malformed_op'
} as const

function connectOp(fromSlot: unknown, toSlot: unknown): GraphOperation {
  return {
    op: 'connect',
    link_id: 41,
    from_node: 1,
    from_slot: fromAny<number, unknown>(fromSlot),
    to_node: 2,
    to_slot: fromAny<number, unknown>(toSlot),
    link_type: 'IMAGE'
  }
}

function expectSlotRejection(
  outcome: ApplyResult['outcomes'][number],
  code: (typeof SLOT_REJECTION_CODES)[keyof typeof SLOT_REJECTION_CODES]
) {
  expect(outcome.outcome).toBe('rejected')
  if (outcome.outcome === 'rejected') {
    expect(outcome.reason.code).toBe(code)
  }
}

function expectedSlotRejectionCode(endpoint: 'from' | 'to', slot: unknown) {
  if (endpoint === 'from') return SLOT_REJECTION_CODES.from
  return typeof slot === 'number'
    ? SLOT_REJECTION_CODES.toNumber
    : SLOT_REJECTION_CODES.toOther
}

describe('QA-12: FE op-ingestion boundary fuzz — malformed connect slot payloads', () => {
  describe('seam 1: attachLinkMintPort and malformed litegraph topology', () => {
    // Pins the requirement, not today's behaviour. `attachLinkMintPort` copies
    // `originSlot`/`targetSlot` into the op unvalidated (linkMintPort.ts), so a
    // malformed local slot is enqueued and only rejected later by the applier.
    // The requirement is that it surfaces locally and never enters the mint
    // queue; the runtime change for that is a separate PR, so this is `fails`
    // until it lands. Convert to `it` the day it does - a green `it.fails` here
    // means the queue is being fed malformed topology again.
    it.fails('never enqueues a malformed from_slot/to_slot', () => {
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
            const port = attachLinkMintPort({
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

            const malformedTopology: LinkTopologyView = fromAny({
              id: 41,
              originNodeId: 1,
              originSlot,
              targetNodeId: 2,
              targetSlot,
              type: 'IMAGE'
            })

            try {
              expect(() =>
                placed?.(ROOT_SCOPE, malformedTopology)
              ).not.toThrow()
              expect(minted).toHaveLength(0)
            } finally {
              port.detach()
            }
          }
        ),
        OP_INGESTION_FUZZ_CONFIG
      )
    })
  })

  // Exact applier rejection behaviour for malformed slots is owned by
  // `@comfyorg/comfy-multi-player` and asserted in that package. A copy here
  // would stay green while the frontend follower is broken, so only the
  // frontend-owned envelope path below is exercised.

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

            let result: ApplyResult | undefined
            expect(() => {
              result = applyOps(doc, wireOps, CATALOG)
            }).not.toThrow()
            assert.exists(result)
            expectSlotRejection(
              result.outcomes[0],
              expectedSlotRejectionCode(endpoint, badSlot)
            )
          }
        ),
        OP_INGESTION_FUZZ_CONFIG
      )
    })
  })
})
