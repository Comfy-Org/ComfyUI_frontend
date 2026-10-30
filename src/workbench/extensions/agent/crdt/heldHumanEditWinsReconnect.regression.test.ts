import {
  applyOps,
  mint,
  observedDocCounter,
  readGraph
} from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DocOp } from './docFrameClient'
import type { GraphOperation } from './graphOperations'
import { createOpSender } from './opSender'
import type { OpsResultView } from './opSender'

/**
 * The canonical CRDT contract for a person's edit on a reconnect, run against
 * the real applier: a Lamport counter is taken when an op is sent, above every
 * counter the sender has received. An edit the wire never carried has not been
 * sent, so it stamps above the catch-up it lands after and wins the register.
 * Without that, an edit typed offline keeps its pre-outage counter and the
 * applier drops it in favour of an agent write the person never saw.
 */
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
  } as Op
}

function cfgOf(doc: ReturnType<typeof mint>): unknown {
  const node = readGraph(doc).nodes['1'] as { widgets?: { cfg?: unknown } }
  return node.widgets?.cfg
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
        const result = applyOps(doc, ops as unknown as Op[], CATALOG)
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
    vi.useRealTimers()
  })

  it('wins a register the agent wrote during the outage', () => {
    transportUp = false
    sender.enqueue([setCfg(4.5)])
    vi.advanceTimersByTime(10_000)

    applyOps(doc, [agentSetCfg(11, 40)], CATALOG)
    sequence = 6
    transportUp = true
    sender.retryTransport()

    expect(cfgOf(doc)).toBe(4.5)
  })

  it('wins a register whose counter ran ahead of the document sequence', () => {
    applyOps(doc, [agentSetCfg(11, 40)], CATALOG)

    sender.enqueue([setCfg(4.5)])

    expect(cfgOf(doc)).toBe(4.5)
  })

  it('leaves a later agent write able to win over the human edit', () => {
    sender.enqueue([setCfg(4.5)])
    const counter = observedDocCounter(doc)

    applyOps(doc, [agentSetCfg(11, (counter ?? 0) + 1)], CATALOG)

    expect(cfgOf(doc)).toBe(11)
  })
})
