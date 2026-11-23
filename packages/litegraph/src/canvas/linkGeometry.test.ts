import { assert, describe, expect, it } from 'vitest'

import { createTestNode } from '#/__fixtures__/nodeHelpers'
import { LGraph } from '#/LGraph'
import { LLink } from '#/LLink'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import type { SlotDirection } from '@comfyorg/graph-model/slotId'

import { getLinkEnd } from './linkGeometry'

describe('getLinkEnd', () => {
  it.for<{ side: SlotDirection; owner: 'source' | 'target' }>([
    { side: 'input', owner: 'target' },
    { side: 'output', owner: 'source' }
  ])(
    'resolves the $side end only for a link that slot holds',
    ({ side, owner }) => {
      const graph = new LGraph()
      const nodes = {
        source: createTestNode(graph, [], ['number']),
        target: createTestNode(graph, ['number'])
      }
      const held = nodes.source.connect(0, nodes.target, 0)
      assert.exists(held)
      const unheld = new LLink(
        toLinkId(held.id + 1),
        'number',
        nodes.source.id,
        0,
        nodes.target.id,
        0
      )

      expect(getLinkEnd(graph, held, side)?.node).toBe(nodes[owner])
      expect(getLinkEnd(graph, unheld, side)).toBeUndefined()
    }
  )
})
