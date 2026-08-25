import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { NodeInteractionProfile } from '@e2e/fixtures/customNode/interactionProfiles'
import {
  comparePackProfiles,
  diffShapes
} from '@e2e/fixtures/customNode/interactionProfiles'

const GROWS: NodeInteractionProfile = {
  connectFirst: ['+input:image2:IMAGE'],
  connectLast: 'SAME_AS_FIRST',
  disconnect: ['-input:image2:IMAGE']
}

function committedWith(nodes: Record<string, NodeInteractionProfile>) {
  return {
    recordedAt: { core: 'abc123', pin: 'def456' },
    schema: 1 as const,
    nodes
  }
}

test.describe('S13 interaction profiles', () => {
  // The sort is load-bearing: probesEqual compares deltas element by element.
  test('diffShapes is a sorted, facet-tagged symmetric difference blind to slot order', () => {
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

  test('compare fails closed on every drift class', () => {
    const committed = committedWith({ NodeA: GROWS })
    expect(
      comparePackProfiles({ pack: 'p', observed: {}, committed: null })[0]
    ).toContain('no committed interaction profiles')
    expect(
      comparePackProfiles({ pack: 'p', observed: {}, committed })[0]
    ).toContain('was not probed')
    expect(
      comparePackProfiles({
        pack: 'p',
        observed: { NodeA: GROWS, NodeB: GROWS },
        committed
      })[0]
    ).toContain('no baseline entry')
    const drifted = comparePackProfiles({
      pack: 'p',
      observed: { NodeA: { ...GROWS, disconnect: [] } },
      committed
    })
    expect(drifted[0]).toContain('interaction delta drifted')
    expect(drifted[0]).toContain('disconnect')
    expect(drifted[0]).toContain('recorded at core abc123')
    expect(
      comparePackProfiles({ pack: 'p', observed: { NodeA: GROWS }, committed })
    ).toEqual([])
  })

  test('marker-vs-delta mismatches drift both directions', () => {
    const committed = committedWith({ NodeA: GROWS })
    expect(
      comparePackProfiles({
        pack: 'p',
        observed: { NodeA: { ...GROWS, connectFirst: 'NO_PRODUCER' } },
        committed
      })[0]
    ).toContain('connectFirst')
    const markerCommitted = committedWith({
      NodeA: { ...GROWS, connectFirst: 'NO_INPUTS' }
    })
    expect(
      comparePackProfiles({
        pack: 'p',
        observed: { NodeA: GROWS },
        committed: markerCommitted
      })[0]
    ).toContain('connectFirst')
  })
})
