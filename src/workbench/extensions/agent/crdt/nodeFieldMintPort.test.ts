import { beforeEach, describe, expect, it } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { createMintSession } from './mintSession'
import type { MintSession } from './mintSession'
import { attachNodeFieldMintPort } from './nodeFieldMintPort'
import type {
  NodeFieldChangeView,
  NodeFieldMintPort
} from './nodeFieldMintPort'

describe('attachNodeFieldMintPort', () => {
  let minted: GraphOperation[]
  let port: NodeFieldMintPort
  let enabled: boolean
  let bound: boolean
  let session: MintSession
  let listeners: Set<(change: NodeFieldChangeView) => void>

  function deliver(change: NodeFieldChangeView): void {
    for (const listener of listeners) listener(change)
  }

  beforeEach(() => {
    minted = []
    enabled = true
    bound = true
    session = createMintSession()
    listeners = new Set()
    port = attachNodeFieldMintPort({
      events: {
        onChange: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      },
      session,
      isEnabled: () => enabled,
      isDocBound: () => bound,
      enqueue: (operations) => minted.push(...operations)
    })
  })

  it.for([
    {
      name: 'title',
      change: { nodeId: '7', field: 'title', value: 'Renamed Node' } as const,
      operation: {
        op: 'set_node_field',
        node_id: '7',
        field: 'title',
        value: 'Renamed Node'
      }
    },
    {
      name: 'mode',
      change: { nodeId: '7', field: 'mode', value: 4 } as const,
      operation: {
        op: 'set_node_field',
        node_id: '7',
        field: 'mode',
        value: 4
      }
    }
  ])(
    'mints a top-level set_node_field from a root-graph $name change',
    async ({ change, operation }) => {
      deliver(change)
      await Promise.resolve()

      expect(minted).toEqual([operation])
    }
  )

  it('defers the mint past the current microtask (lands after a queued layout flush)', () => {
    deliver({ nodeId: '7', field: 'title', value: 'Renamed Node' })

    expect(minted).toEqual([])
  })

  it('never mints with the product flag off', () => {
    enabled = false
    deliver({ nodeId: '7', field: 'title', value: 'Renamed Node' })

    expect(minted).toEqual([])
  })

  it('never mints without a bound doc', () => {
    bound = false
    deliver({ nodeId: '7', field: 'title', value: 'Renamed Node' })

    expect(minted).toEqual([])
  })

  it('never mints inside a graph-teardown bracket (restoration writes are inert)', () => {
    session.beginGraphTeardown()
    deliver({ nodeId: '7', field: 'title', value: 'Renamed Node' })
    session.endGraphTeardown()

    expect(minted).toEqual([])
  })

  it('stops minting after detach', () => {
    port.detach()
    deliver({ nodeId: '7', field: 'title', value: 'Renamed Node' })

    expect(minted).toEqual([])
  })

  it('lands after a microtask already queued before the change (matches the layout store queuing add_node first)', async () => {
    const order: string[] = []
    const orderedPort = attachNodeFieldMintPort({
      events: {
        onChange: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      },
      session,
      isEnabled: () => enabled,
      isDocBound: () => bound,
      enqueue: () => order.push('set_node_field')
    })
    queueMicrotask(() => order.push('add_node'))
    deliver({ nodeId: '7', field: 'title', value: 'Renamed Node' })

    await Promise.resolve()

    expect(order).toEqual(['add_node', 'set_node_field'])
    orderedPort.detach()
  })
})
