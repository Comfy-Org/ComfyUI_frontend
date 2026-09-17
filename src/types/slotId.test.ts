import { describe, expect, it } from 'vitest'

import { toNodeId } from '@/types/nodeId'
import { parseSlotId, slotId } from '@/types/slotId'

describe('slotId', () => {
  it('uses the legacy slot key format', () => {
    expect(slotId(toNodeId('node-1'), 'input', 0)).toBe('node-1-in-0')
    expect(slotId(toNodeId('node-1'), 'output', 0)).toBe('node-1-out-0')
  })

  it('preserves node id text without escaping', () => {
    expect(slotId(toNodeId('node:input'), 'input', 0)).toBe('node:input-in-0')
  })

  it('sorts input slots before output slots for the same node and index', () => {
    const nodeId = toNodeId('node-1')

    expect(
      [slotId(nodeId, 'output', 0), slotId(nodeId, 'input', 0)].sort()
    ).toEqual([slotId(nodeId, 'input', 0), slotId(nodeId, 'output', 0)])
  })

  it('parses slot ids containing hyphenated node ids', () => {
    expect(parseSlotId('node-with-hyphens-out-12')).toEqual({
      key: slotId(toNodeId('node-with-hyphens'), 'output', 12),
      nodeId: toNodeId('node-with-hyphens'),
      direction: 'output',
      index: 12
    })
  })

  it('rejects malformed slot ids', () => {
    expect(parseSlotId('node-input-zero')).toBeNull()
    expect(parseSlotId(`node-in-${Number.MAX_SAFE_INTEGER}0`)).toBeNull()
  })
})
