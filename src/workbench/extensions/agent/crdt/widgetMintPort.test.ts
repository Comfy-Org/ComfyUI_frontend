import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import type { GraphMutationTarget, GraphOperation } from './graphOperations'
import { createMintSession } from './mintSession'
import type { MintSession } from './mintSession'
import { attachWidgetMintPort } from './widgetMintPort'
import type { WidgetMintPort, WidgetSetView } from './widgetMintPort'

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: vi.fn()
}))

const ROOT = 'root-uuid'
const TARGET: GraphMutationTarget = { workflowId: 'wf-a', rootGraphId: ROOT }

function widgetSet(overrides: Partial<WidgetSetView> = {}): WidgetSetView {
  return {
    graphId: ROOT,
    nodeId: '7',
    name: 'seed',
    value: 42,
    old: 3,
    ...overrides
  }
}

describe('attachWidgetMintPort', () => {
  let minted: GraphOperation[]
  let enqueueAccepts: boolean
  let port: WidgetMintPort
  let enabled: boolean
  let bound: boolean
  let interiorPaths: Map<string, string[]>
  let session: MintSession
  let listeners: Set<(target: GraphMutationTarget, set: WidgetSetView) => void>

  function deliver(set: WidgetSetView, target = TARGET): void {
    for (const listener of listeners) listener(target, set)
  }

  beforeEach(() => {
    enqueueAccepts = true
    minted = []
    enabled = true
    bound = true
    interiorPaths = new Map()
    session = createMintSession()
    listeners = new Set()
    port = attachWidgetMintPort({
      events: {
        onSet: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      },
      session,
      isEnabled: () => enabled,
      isDocBound: () => bound,
      resolveInteriorPath: (_target, owningGraphId) =>
        interiorPaths.get(owningGraphId) ?? null,
      enqueue: (batch) => {
        minted.push(...batch.operations)
        return enqueueAccepts
      }
    })
  })

  it('mints a name-keyed top-level set_widget with the old value', () => {
    deliver(widgetSet())

    expect(minted).toEqual([
      { op: 'set_widget', node_id: '7', widget: 'seed', value: 42, old: 3 }
    ])
  })

  it('never mints with the product flag off', () => {
    enabled = false
    deliver(widgetSet())

    expect(minted).toEqual([])
  })

  it('never mints without a bound doc', () => {
    bound = false
    deliver(widgetSet())

    expect(minted).toEqual([])
  })

  it('never mints inside a graph-teardown bracket (restoration writes are inert)', () => {
    session.beginGraphTeardown()
    deliver(widgetSet())
    session.endGraphTeardown()

    expect(minted).toEqual([])
  })

  it('mints an interior set_widget with the resolved node path', () => {
    interiorPaths.set('subgraph-uuid', ['57'])

    deliver(widgetSet({ graphId: 'subgraph-uuid', nodeId: '27' }))

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: '27',
        widget: 'seed',
        value: 42,
        old: 3,
        path: ['57', '27'],
        inner_widget: 'seed'
      }
    ])
  })

  it('surfaces an unresolvable interior write observably instead of minting', () => {
    deliver(widgetSet({ graphId: 'subgraph-uuid' }))

    expect(minted).toEqual([])
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_crdt_widget_mint_owner_unresolvable',
      context: {
        targetWorkflowId: TARGET.workflowId,
        targetRootGraphId: TARGET.rootGraphId,
        widgetGraphId: 'subgraph-uuid',
        widgetNodeId: '7',
        widgetName: 'seed'
      }
    })
  })

  it('rejects a write whose event target does not own its root graph', () => {
    const target = { workflowId: 'wf-b', rootGraphId: 'other-root' }
    deliver(widgetSet(), target)

    expect(minted).toEqual([])
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_crdt_widget_mint_owner_unresolvable',
      context: {
        targetWorkflowId: target.workflowId,
        targetRootGraphId: target.rootGraphId,
        widgetGraphId: ROOT,
        widgetNodeId: '7',
        widgetName: 'seed'
      }
    })
  })

  it('reports a sender rejection with target and widget identity', () => {
    enqueueAccepts = false

    deliver(widgetSet())

    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_crdt_widget_mint_rejected_by_sender',
      context: {
        targetWorkflowId: TARGET.workflowId,
        targetRootGraphId: TARGET.rootGraphId,
        widgetGraphId: ROOT,
        widgetNodeId: '7',
        widgetName: 'seed'
      }
    })
  })

  it('stops minting after detach', () => {
    port.detach()
    deliver(widgetSet())

    expect(minted).toEqual([])
  })
})
