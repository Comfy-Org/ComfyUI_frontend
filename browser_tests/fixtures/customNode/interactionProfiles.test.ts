import { describe, expect, it } from 'vitest'
import type {
  NodeInteractionProfile,
  SparseNodeInteractionProfile
} from '@e2e/fixtures/customNode/interactionProfiles'
import {
  comparePackProfiles,
  diffShapes,
  interactionCorpusIdentity
} from '@e2e/fixtures/customNode/interactionProfiles'

const CONNECT_FIRST = ['+input:image2:IMAGE']
const DISCONNECT = ['-input:image2:IMAGE']

const GROWS: NodeInteractionProfile = {
  connectFirst: CONNECT_FIRST,
  connectLast: 'SAME_AS_FIRST',
  disconnect: DISCONNECT
}

function committedWith(
  nodeTypes: string[],
  nodes: Record<string, SparseNodeInteractionProfile>
) {
  return {
    recordedAt: { core: 'abc123', pin: 'def456' },
    schema: 2 as const,
    corpus: interactionCorpusIdentity(nodeTypes),
    nodes
  }
}

function compareWithPin(
  input: Parameters<typeof comparePackProfiles>[0] & { expectedPin: string }
) {
  return comparePackProfiles(input)
}

describe('S13 interaction profiles', () => {
  // The sort is load-bearing: probesEqual compares deltas element by element.
  it('diffShapes is a sorted, facet-tagged symmetric difference blind to slot order', () => {
    const before = {
      inputs: ['input:a:IMAGE', 'input:c:MASK'],
      outputs: ['output:out:IMAGE'],
      widgets: ['widget:w:INT']
    }
    const after = {
      inputs: ['input:c:MASK', 'input:b:IMAGE'],
      outputs: ['output:out:IMAGE'],
      widgets: ['widget:w:INT', 'widget:z:FLOAT']
    }
    expect(diffShapes(before, after)).toEqual([
      '+input:b:IMAGE',
      '+widget:z:FLOAT',
      '-input:a:IMAGE'
    ])
    expect(diffShapes(before, { ...before })).toEqual([])
    const reordered = {
      ...before,
      inputs: [...before.inputs].reverse()
    }
    expect(diffShapes(before, reordered)).toEqual([])
  })

  it('compare fails closed on every drift class', () => {
    const committed = committedWith(['NodeA'], {
      NodeA: {
        connectFirst: CONNECT_FIRST,
        disconnect: DISCONNECT
      }
    })
    expect(
      compareWithPin({
        pack: 'p',
        expectedPin: 'def456',
        observed: {},
        committed: null
      })[0]
    ).toContain('no committed interaction profiles')
    expect(
      compareWithPin({
        pack: 'p',
        expectedPin: 'def456',
        observed: {},
        committed
      })[0]
    ).toContain('interaction corpus changed')
    expect(
      compareWithPin({
        pack: 'p',
        expectedPin: 'def456',
        observed: { NodeA: GROWS, NodeB: GROWS },
        committed
      })[0]
    ).toContain('interaction corpus changed')
    const drifted = compareWithPin({
      pack: 'p',
      expectedPin: 'def456',
      observed: { NodeA: { ...GROWS, disconnect: [] } },
      committed
    })
    expect(drifted[0]).toContain('interaction delta drifted')
    expect(drifted[0]).toContain('disconnect')
    expect(drifted[0]).toContain('recorded at core abc123')
    expect(
      compareWithPin({
        pack: 'p',
        expectedPin: 'def456',
        observed: { NodeA: GROWS },
        committed
      })
    ).toEqual([])
  })

  it('fails a baseline recorded at a different pack pin', () => {
    expect(
      compareWithPin({
        pack: 'p',
        expectedPin: 'new-pin',
        observed: { NodeA: GROWS },
        committed: committedWith(['NodeA'], { NodeA: {} })
      })
    ).toEqual([
      "S13: p profile pin is 'def456', expected 'new-pin' - re-record it"
    ])
  })

  it('a marker replacing a recorded delta is drift', () => {
    const committed = committedWith(['NodeA'], {
      NodeA: { connectFirst: CONNECT_FIRST }
    })
    expect(
      compareWithPin({
        pack: 'p',
        expectedPin: 'def456',
        observed: { NodeA: { ...GROWS, connectFirst: 'NO_PRODUCER' } },
        committed
      })[0]
    ).toContain('connectFirst')
  })
})
