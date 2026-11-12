import { describe, expect, it } from 'vitest'

import { toNodeId } from '@comfyorg/graph-model/nodeId'

import {
  emptySubgraphHostContext,
  transitionSubgraphHostContext
} from './subgraphHostContext'

const hostA = { graphId: 'root', nodeId: toNodeId(17), subgraphId: 'shared' }
const hostB = { graphId: 'root', nodeId: toNodeId(29), subgraphId: 'shared' }
const nested = { graphId: 'shared', nodeId: toNodeId(43), subgraphId: 'inner' }

describe('subgraph host context', () => {
  it('retains the explicit instance when entering a shared definition', () => {
    const state = transitionSubgraphHostContext(emptySubgraphHostContext, {
      type: 'entered',
      rootGraphId: 'root',
      host: hostB
    })
    expect(state.hosts).toEqual([hostB])
  })

  it('replaces the instance when entering the same definition through another host', () => {
    const state = transitionSubgraphHostContext(
      { rootGraphId: 'root', hosts: [hostA] },
      { type: 'entered', rootGraphId: 'root', host: hostB }
    )
    expect(state.hosts).toEqual([hostB])
  })

  it('preserves the outer instance when returning from a nested definition', () => {
    const state = transitionSubgraphHostContext(
      { rootGraphId: 'root', hosts: [hostB, nested] },
      { type: 'navigated', rootGraphId: 'root', graphId: 'shared' }
    )
    expect(state.hosts).toEqual([hostB])
  })

  it.for([
    { name: 'root', rootGraphId: 'root', graphId: 'root' },
    { name: 'another workflow', rootGraphId: 'other', graphId: 'shared' },
    { name: 'an unknown definition', rootGraphId: 'root', graphId: 'unknown' }
  ])(
    'clears stale hosts on navigation to $name',
    ({ rootGraphId, graphId }) => {
      const state = transitionSubgraphHostContext(
        { rootGraphId: 'root', hosts: [hostA, nested] },
        { type: 'navigated', rootGraphId, graphId }
      )
      expect(state.hosts).toEqual([])
    }
  )

  it('appends an explicit nested host', () => {
    const state = transitionSubgraphHostContext(
      { rootGraphId: 'root', hosts: [hostB] },
      { type: 'entered', rootGraphId: 'root', host: nested }
    )
    expect(state.hosts).toEqual([hostB, nested])
  })
})
