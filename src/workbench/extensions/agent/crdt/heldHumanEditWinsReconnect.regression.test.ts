import {
  applyOps,
  mint,
  observedDocCounter,
  readGraph
} from '@comfyorg/comfy-multi-player'
import type {
  Op,
  Stamp,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DocOp } from './docFrameClient'
import type { GraphOperation } from './graphOperations'
import { createOpSender } from './opSender'
import type { OpsResultView } from './opSender'

const WORKFLOW = 'wf-1'
const HUMAN = 'human:u1:tab'
const AGENT = 'agent:t:1'
const CATALOG: WidgetCatalog = {
  types: { KSampler: { widget_order: ['cfg'] } }
}
const SEED: WorkflowJSON = {
  nodes: [
    { id: 1, type: 'KSampler', pos: [0, 0], widgets_values: [8], inputs: [] }
  ],
  links: []
}

function setCfg(value: number): GraphOperation {
  return { op: 'set_widget', node_id: 1, widget: 'cfg', value }
}

function agentSetCfg(value: number, counter: number): Op {
  return {
    ...setCfg(value),
    op_id: `a${counter}`.padEnd(32, '0'),
    actor: AGENT,
    base_version: counter,
    stamp: [counter, AGENT]
  }
}

function isStamp(value: unknown): value is Stamp {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'string'
  )
}

function parseWireOps(ops: readonly DocOp[]): Op[] {
  return ops.map(
    ({ op, node_id, widget, value, op_id, actor, base_version, stamp }) => {
      if (
        op !== 'set_widget' ||
        typeof node_id !== 'number' ||
        typeof widget !== 'string' ||
        typeof base_version !== 'number' ||
        !Number.isSafeInteger(base_version) ||
        !isStamp(stamp)
      )
        throw new Error(
          `the sender put an op the host would refuse on the wire: ${JSON.stringify(
            { op, node_id, widget, base_version, stamp }
          )}`
        )
      return { op, node_id, widget, value, op_id, actor, base_version, stamp }
    }
  )
}

describe('a human edit across a reconnect, against the real applier', () => {
  let doc: ReturnType<typeof mint>
  let transportUp: boolean
  let sequence: number
  let resultListener: ((result: OpsResultView) => void) | null
  let sender: ReturnType<typeof createOpSender>

  beforeEach(() => {
    vi.useFakeTimers()
    doc = mint(SEED, CATALOG)
    transportUp = true
    sequence = 5
    resultListener = null
    sender = createOpSender({
      sendOps: (_workflow, _tab, ops: readonly DocOp[]) => {
        if (!transportUp) return false
        const result = applyOps(doc, parseWireOps(ops), CATALOG)
        queueMicrotask(() =>
          resultListener?.({
            ok: true,
            applied: result.outcomes
              .filter((outcome) => outcome.outcome === 'applied')
              .map((outcome) => outcome.op_id),
            skipped: result.outcomes
              .filter((outcome) => outcome.outcome !== 'applied')
              .map((outcome) => outcome.op_id)
          })
        )
        return true
      },
      onOpsResult: (listener) => {
        resultListener = listener
        return () => {
          resultListener = null
        }
      },
      workflowId: () => WORKFLOW,
      tab: 'tab',
      actor: () => HUMAN,
      baseVersion: () => sequence,
      observedCounter: () => observedDocCounter(doc),
      onBatchSettled: () => {}
    })
  })

  afterEach(() => {
    sender.detach()
  })

  it('wins a register the agent wrote during the outage', () => {
    transportUp = false
    sender.enqueue([setCfg(4.5)])
    vi.advanceTimersByTime(10_000)

    applyOps(doc, [agentSetCfg(11, 40)], CATALOG)
    sequence = 6
    transportUp = true
    sender.retryTransport()

    expect(readGraph(doc).nodes['1'].widgets).toEqual({ cfg: 4.5 })
  })

  it('wins a register whose counter ran ahead of the document sequence', () => {
    applyOps(doc, [agentSetCfg(11, 40)], CATALOG)

    sender.enqueue([setCfg(4.5)])

    expect(readGraph(doc).nodes['1'].widgets).toEqual({ cfg: 4.5 })
  })

  it('leaves a later agent write able to win over the human edit', () => {
    sender.enqueue([setCfg(4.5)])
    const counter = observedDocCounter(doc)

    applyOps(doc, [agentSetCfg(11, (counter ?? 0) + 1)], CATALOG)

    expect(readGraph(doc).nodes['1'].widgets).toEqual({ cfg: 11 })
  })
})
