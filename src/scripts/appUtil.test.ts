import { describe, expect, it } from 'vitest'

import {
  isApiJson,
  positionBatchLayout,
  sanitizeNodeName,
  stackNodesVertically
} from './appUtil'

function createNodeLike(
  pos: [number, number],
  bounding: number[],
  type = 'LoadImage'
) {
  return {
    pos,
    type,
    getBounding: () => new Float64Array(bounding)
  }
}

describe('sanitizeNodeName', () => {
  it('strips dangerous HTML entity characters', () => {
    expect(sanitizeNodeName('a&b<c>d"e\'f`g=h')).toBe('abcdefgh')
  })

  it('returns the string unchanged when no entities are present', () => {
    expect(sanitizeNodeName('KSampler')).toBe('KSampler')
  })

  it('handles empty string', () => {
    expect(sanitizeNodeName('')).toBe('')
  })
})

describe('isApiJson', () => {
  it('accepts valid API workflow data', () => {
    const data = {
      '1': { class_type: 'KSampler', inputs: { seed: 42 } },
      '2': { class_type: 'CLIPTextEncode', inputs: { text: 'hello' } }
    }
    expect(isApiJson(data)).toBe(true)
  })

  it('rejects empty object', () => {
    expect(isApiJson({})).toBe(false)
  })

  it('rejects arrays', () => {
    expect(isApiJson([1, 2, 3])).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isApiJson('string')).toBe(false)
    expect(isApiJson(42)).toBe(false)
    expect(isApiJson(null)).toBe(false)
  })

  it('rejects when a node lacks class_type', () => {
    expect(isApiJson({ '1': { inputs: { seed: 42 } } })).toBe(false)
  })

  it('rejects when inputs is an array instead of object', () => {
    expect(isApiJson({ '1': { class_type: 'KSampler', inputs: [1, 2] } })).toBe(
      false
    )
  })
})

describe('stackNodesVertically', () => {
  it('returns false for a single node', () => {
    const node = createNodeLike([100, 200], [100, 200, 300, 400])
    expect(stackNodesVertically([node])).toBe(false)
    expect(node.pos).toEqual([100, 200])
  })

  it('stacks multiple nodes below the first', () => {
    const node1 = createNodeLike([100, 200], [100, 200, 300, 400])
    const node2 = createNodeLike([0, 0], [0, 0, 200, 100])
    const node3 = createNodeLike([0, 0], [0, 0, 200, 100])

    expect(stackNodesVertically([node1, node2, node3])).toBe(true)

    expect(node1.pos).toEqual([100, 200])
    expect(node2.pos).toEqual([100, 400])
    expect(node3.pos).toEqual([100, 575])
  })

  it('returns false for empty array', () => {
    expect(stackNodesVertically([])).toBe(false)
  })
})

describe('positionBatchLayout', () => {
  it('places batch node to the right of the first node', () => {
    const node1 = createNodeLike([100, 200], [100, 200, 300, 400])
    const batchNode = createNodeLike([0, 0], [0, 0, 0, 0])

    positionBatchLayout([node1], batchNode)

    expect(batchNode.pos).toEqual([500, 230])
  })

  it('stacks LoadImage nodes at 344px height intervals', () => {
    const node1 = createNodeLike([100, 200], [100, 200, 300, 400], 'LoadImage')
    const node2 = createNodeLike([0, 0], [0, 0, 200, 100], 'LoadImage')
    const batchNode = createNodeLike([0, 0], [0, 0, 0, 0])

    positionBatchLayout([node1, node2], batchNode)

    expect(node1.pos).toEqual([100, 200])
    expect(node2.pos).toEqual([100, 544 + 50])
  })

  it('uses zero height for non-LoadImage nodes', () => {
    const node1 = createNodeLike([100, 200], [100, 200, 300, 400], 'Other')
    const node2 = createNodeLike([0, 0], [0, 0, 200, 100], 'Other')
    const batchNode = createNodeLike([0, 0], [0, 0, 0, 0])

    positionBatchLayout([node1, node2], batchNode)

    expect(node2.pos).toEqual([100, 200 + 50])
  })
})
