import type { Op } from '@comfyorg/comfy-multi-player'
import * as fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { mintWireOps } from './opEnvelope'
import type { OpsResultView } from './opSender'
import { createOpSender } from './opSender'

const WORKFLOW_ID = 'property-workflow'
const TAB = 'property-tab'
const ACTOR = 'human:property-user:property-tab'

type AddNodeOperation = Extract<GraphOperation, { op: 'add_node' }>

function addNode(id: number): AddNodeOperation {
  return {
    op: 'add_node',
    node_id: id,
    class_type: 'PropertyNode',
    pos: [id, -id],
    node: { id, type: 'PropertyNode', marker: id }
  }
}

const arbOperations = fc
  .uniqueArray(fc.integer({ min: 1, max: 1_000_000 }), {
    minLength: 1,
    maxLength: 40
  })
  .map((ids) => ids.map(addNode))

describe('CRDT human write-leg invariants (property)', () => {
  it('mints one unique complete causal identity per operation', () => {
    fc.assert(
      fc.property(
        arbOperations,
        fc.nat({ max: Number.MAX_SAFE_INTEGER }),
        (operations, baseVersion) => {
          const minted = mintWireOps(operations, {
            actor: ACTOR,
            baseVersion
          })

          expect(new Set(minted.map((op) => op.op_id))).toHaveLength(
            operations.length
          )
          for (const op of minted) {
            expect(op.op_id).toMatch(/^[0-9a-f]{32}$/)
            expect(op.actor).toBe(ACTOR)
            expect(op.base_version).toBe(baseVersion)
            expect(op.stamp).toEqual([baseVersion, ACTOR])
          }
        }
      )
    )
  })

  it('serializes arbitrary operation sequences in causal mint order', () => {
    fc.assert(
      fc.property(arbOperations, (operations) => {
        const sent: Op[][] = []
        let resultListener = (_result: OpsResultView): void => {
          throw new Error('Expected an operation-result listener')
        }
        const sender = createOpSender({
          sendOps: (_workflowId, _tab, ops) => {
            sent.push(ops)
            return true
          },
          onOpsResult: (listener) => {
            resultListener = listener
            return () => {}
          },
          workflowId: () => WORKFLOW_ID,
          tab: TAB,
          actor: () => ACTOR,
          baseVersion: () => 41,
          onBatchSettled: () => {}
        })

        for (const operation of operations) {
          sender.enqueue([operation])
          const latest = sent.at(-1)
          if (!latest) throw new Error('Expected an in-flight operation')
          resultListener({
            ok: true,
            applied: [latest[0].op_id],
            skipped: []
          })
        }

        const delivered = sent.flat()
        expect(
          delivered.map((op) => {
            if (op.op !== 'add_node') throw new Error('Expected add_node')
            return op.node_id
          })
        ).toEqual(operations.map((operation) => operation.node_id))
        expect(new Set(delivered.map((op) => op.op_id))).toHaveLength(
          operations.length
        )
        expect(sender.pending()).toBe(0)
        sender.detach()
      })
    )
  })

  it('retries transport failures and result silence without reminting', () => {
    vi.useFakeTimers()
    fc.assert(
      fc.property(
        arbOperations,
        fc.integer({ min: 1, max: 4 }),
        (operations, failedAttempts) => {
          const attempts: Op[][] = []
          let callCount = 0
          const sender = createOpSender({
            sendOps: (_workflowId, _tab, ops) => {
              attempts.push(ops)
              callCount += 1
              return callCount > failedAttempts
            },
            onOpsResult: () => () => {},
            workflowId: () => WORKFLOW_ID,
            tab: TAB,
            actor: () => ACTOR,
            baseVersion: () => 73,
            onBatchSettled: () => {}
          })

          sender.enqueue(operations)
          vi.advanceTimersByTime(failedAttempts * 500)
          expect(attempts).toHaveLength(failedAttempts + 1)
          const minted = attempts[0]
          for (const attempt of attempts) expect(attempt).toEqual(minted)

          vi.advanceTimersByTime(10_000)
          expect(attempts.at(-1)).toEqual(minted)
          expect(attempts).toHaveLength(failedAttempts + 2)
          sender.detach()
        }
      )
    )
  })
})
