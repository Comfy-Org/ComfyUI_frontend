import { describe, expect, it } from 'vitest'

import { toNodeId } from '@/types/nodeId'
import { slotId } from '@/types/slotId'

describe('slotId', () => {
  it('distinguishes input and output slots', () => {
    const nodeId = toNodeId('node-1')

    expect(slotId(nodeId, 0, 'input')).not.toBe(slotId(nodeId, 0, 'output'))
  })

  it('escapes node id segments that contain separators', () => {
    expect(slotId(toNodeId('node:input'), 0, 'input')).toBe(
      'node%3Ainput:input:0'
    )
  })

  it('sorts input slots before output slots for the same node and index', () => {
    const nodeId = toNodeId('node-1')

    expect(
      [slotId(nodeId, 0, 'output'), slotId(nodeId, 0, 'input')].sort()
    ).toEqual([slotId(nodeId, 0, 'input'), slotId(nodeId, 0, 'output')])
  })
})
