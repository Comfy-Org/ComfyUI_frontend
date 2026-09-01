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
const TARGET = { workflowId: WORKFLOW_ID, rootGraphId: 'property-root' }

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

function enqueue(
  sender: ReturnType<typeof createOpSender>,
  operations: GraphOperation[]
): void {
  sender.enqueue(Object.assign([...operations], { target: TARGET, operations }))
}

function mintContext(firstVersion: number) {
  return {
    actor: ACTOR,
    baseVersion: firstVersion,
    firstVersion
  }
}

function opsResult(applied: string[]): OpsResultView {
  const result = {
    workflowId: WORKFLOW_ID,
    ok: true,
    applied,
    skipped: []
  }
  return result
}

describe('CRDT human write-leg invariants (property)', () => {
  it('starts empty and ignores empty or detached writes', () => {
    const sendOps = vi.fn(() => true)
    const listeners = new Set<(result: OpsResultView) => void>()
    const deps = {
      sendOps,
      onOpsResult: (listener: (result: OpsResultView) => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      workflowId: () => WORKFLOW_ID,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 0,
      observedVersion: () => 0,
      reserveVersions: (
        _workflowId: string,
        _observed: number,
        _count: number
      ) => 1,
      onBatchSettled: () => {}
    }
    const sender = createOpSender(deps)

    expect(sender.pending()).toBe(0)
    expect(listeners).toHaveLength(1)

    enqueue(sender, [])
    expect(sendOps).not.toHaveBeenCalled()

    sender.detach()
    expect(listeners).toHaveLength(0)

    enqueue(sender, [addNode(1)])
    expect(sendOps).not.toHaveBeenCalled()
  })

  it('mints one unique complete causal identity per operation', () => {
    fc.assert(
      fc.property(
        arbOperations,
        fc.nat({ max: Number.MAX_SAFE_INTEGER - 40 }),
        (operations, baseVersion) => {
          const minted = operations.flatMap((operation, index) =>
            mintWireOps([operation], mintContext(baseVersion + index))
          )

          expect(new Set(minted.map((op) => op.op_id))).toHaveLength(
            operations.length
          )
          for (const [index, op] of minted.entries()) {
            expect(op.op_id).toMatch(/^[0-9a-f]{32}$/)
            expect(op.actor).toBe(ACTOR)
            expect(op.base_version).toBe(baseVersion + index)
            expect(op.stamp).toEqual([op.base_version, ACTOR])
          }
        }
      )
    )
  })

  it('serializes arbitrary operation sequences in causal mint order', () => {
    fc.assert(
      fc.property(arbOperations, (operations) => {
        const sent: Op[][] = []
        let producerVersion = 41
        let resultListener = (_result: OpsResultView): void => {
          throw new Error('Expected an operation-result listener')
        }
        const deps = {
          sendOps: (_workflowId: string, _tab: string, ops: Op[]) => {
            sent.push(ops)
            return true
          },
          onOpsResult: (listener: (result: OpsResultView) => void) => {
            resultListener = listener
            return () => {}
          },
          workflowId: () => WORKFLOW_ID,
          tab: TAB,
          actor: () => ACTOR,
          baseVersion: () => ++producerVersion,
          observedVersion: () => 41,
          reserveVersions: (
            _workflowId: string,
            observed: number,
            count: number
          ) => {
            const firstVersion = Math.max(producerVersion, observed) + 1
            producerVersion = firstVersion + count - 1
            return firstVersion
          },
          onBatchSettled: () => {}
        }
        const sender = createOpSender(deps)

        for (const operation of operations) {
          enqueue(sender, [operation])
          const latest = sent.at(-1)
          if (!latest) throw new Error('Expected an in-flight operation')
          resultListener(opsResult([latest[0].op_id]))
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
        expect(delivered.map((op) => op.base_version)).toEqual(
          operations.map((_, index) => 42 + index)
        )
        expect(sender.pending()).toBe(0)
        sender.detach()
      })
    )
  })

  it('retries transport failures and result silence without reminting', () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    try {
      fc.assert(
        fc.property(
          arbOperations,
          fc.integer({ min: 1, max: 4 }),
          (operations, failedAttempts) => {
            const attempts: Op[][] = []
            const attemptIdentities: string[][] = []
            let callCount = 0
            const deps = {
              sendOps: (_workflowId: string, _tab: string, ops: Op[]) => {
                attempts.push(ops)
                attemptIdentities.push(ops.map((op) => op.op_id))
                callCount += 1
                return callCount > failedAttempts
              },
              onOpsResult: () => () => {},
              workflowId: () => WORKFLOW_ID,
              tab: TAB,
              actor: () => ACTOR,
              baseVersion: () => 73,
              observedVersion: () => 72,
              reserveVersions: (
                _workflowId: string,
                observed: number,
                _count: number
              ) => observed + 1,
              onBatchSettled: () => {}
            }
            const sender = createOpSender(deps)

            enqueue(sender, operations)
            vi.advanceTimersByTime(failedAttempts * 500)
            expect(attempts).toHaveLength(failedAttempts + 1)
            const mintedIdentities = attemptIdentities[0]
            for (const identities of attemptIdentities)
              expect(identities).toEqual(mintedIdentities)

            vi.advanceTimersByTime(10_000)
            expect(attemptIdentities.at(-1)).toEqual(mintedIdentities)
            expect(attempts).toHaveLength(failedAttempts + 2)
            sender.detach()
          }
        )
      )
    } finally {
      vi.useRealTimers()
    }
  })
})
