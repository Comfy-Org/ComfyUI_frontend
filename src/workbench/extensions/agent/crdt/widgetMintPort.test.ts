import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { createMintSession } from './mintSession'
import type { MintSession } from './mintSession'
import { attachWidgetMintPort } from './widgetMintPort'
import type { WidgetMintPort, WidgetSetView } from './widgetMintPort'

const ROOT = 'root-uuid'

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
  let port: WidgetMintPort
  let enabled: boolean
  let bound: boolean
  let root: string | null
  let interiorPaths: Map<string, string[]>
  let session: MintSession
  let listeners: Set<(set: WidgetSetView) => void>

  function deliver(set: WidgetSetView): void {
    for (const listener of listeners) listener(set)
  }

  beforeEach(() => {
    minted = []
    enabled = true
    bound = true
    root = ROOT
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
      rootGraphId: () => root,
      resolveInteriorPath: (owningGraphId) =>
        interiorPaths.get(owningGraphId) ?? null,
      enqueue: (operations) => minted.push(...operations)
    })
  })

  it('mints a name-keyed top-level set_widget with the old value', () => {
    deliver(widgetSet())

    expect(minted).toEqual([
      { op: 'set_widget', node_id: '7', widget: 'seed', value: 42, old: 3 }
    ])
  })

  it('never mints inside the remote-apply scope (KA-6 sender half)', () => {
    session.runRemoteApply(() => deliver(widgetSet()))

    expect(minted).toEqual([])
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
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    deliver(widgetSet({ graphId: 'subgraph-uuid' }))

    expect(minted).toEqual([])
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('surfaces a write with no open root graph observably', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    root = null
    deliver(widgetSet())

    expect(minted).toEqual([])
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('stops minting after detach', () => {
    port.detach()
    deliver(widgetSet())

    expect(minted).toEqual([])
  })
})
