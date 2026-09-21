import { beforeEach, describe, expect, it } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { createMintSession } from './mintSession'
import type { MintSession } from './mintSession'
import { attachTitleMintPort } from './titleMintPort'
import type { TitleChangeView, TitleMintPort } from './titleMintPort'

function titleChange(
  overrides: Partial<TitleChangeView> = {}
): TitleChangeView {
  return {
    nodeId: '7',
    title: 'Renamed Node',
    ...overrides
  }
}

describe('attachTitleMintPort', () => {
  let minted: GraphOperation[]
  let port: TitleMintPort
  let enabled: boolean
  let bound: boolean
  let session: MintSession
  let listeners: Set<(change: TitleChangeView) => void>

  function deliver(change: TitleChangeView): void {
    for (const listener of listeners) listener(change)
  }

  beforeEach(() => {
    minted = []
    enabled = true
    bound = true
    session = createMintSession()
    listeners = new Set()
    port = attachTitleMintPort({
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

  it('mints a top-level set_title from a root-graph title change', () => {
    deliver(titleChange())

    expect(minted).toEqual([
      { op: 'set_title', node_id: '7', title: 'Renamed Node' }
    ])
  })

  it('never mints with the product flag off', () => {
    enabled = false
    deliver(titleChange())

    expect(minted).toEqual([])
  })

  it('never mints without a bound doc', () => {
    bound = false
    deliver(titleChange())

    expect(minted).toEqual([])
  })

  it('never mints inside a graph-teardown bracket (restoration writes are inert)', () => {
    session.beginGraphTeardown()
    deliver(titleChange())
    session.endGraphTeardown()

    expect(minted).toEqual([])
  })

  it('stops minting after detach', () => {
    port.detach()
    deliver(titleChange())

    expect(minted).toEqual([])
  })
})
