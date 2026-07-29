import { describe, expect, it } from 'vitest'

import { toNodeId } from '@/types/nodeId'

import { canvasNodeTarget } from './canvasCoachTarget'

describe('canvasNodeTarget', () => {
  it.for([toNodeId(12), toNodeId('sub:7'), toNodeId('3d')])(
    'finds the node Nodes 2.0 rendered for id %s',
    (nodeId) => {
      const node = document.createElement('div')
      node.setAttribute('data-node-id', nodeId)
      document.body.append(node)

      expect(
        document.querySelector(canvasNodeTarget(nodeId).selector),
        'a node id reaches the DOM verbatim, so the selector has to survive it'
      ).toBe(node)
      node.remove()
    }
  )
})
