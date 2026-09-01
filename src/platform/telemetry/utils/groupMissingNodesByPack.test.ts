import { describe, expect, it } from 'vitest'

import type { MissingNodeType } from '@/types/comfy'

import { groupMissingNodesByPack } from './groupMissingNodesByPack'

describe('groupMissingNodesByPack', () => {
  it('returns an empty array when no missing nodes', () => {
    expect(groupMissingNodesByPack([])).toEqual([])
  })

  it('groups multiple node types under the same pack', () => {
    const missing: MissingNodeType[] = [
      { type: 'ImpactSampler', cnrId: 'impact-pack' },
      { type: 'ImpactDetailer', cnrId: 'impact-pack' },
      { type: 'WASImageBlend', cnrId: 'was-node-suite' }
    ]

    const result = groupMissingNodesByPack(missing)

    expect(result).toHaveLength(2)
    expect(result).toEqual(
      expect.arrayContaining([
        {
          pack_id: 'impact-pack',
          node_types: ['ImpactSampler', 'ImpactDetailer']
        },
        { pack_id: 'was-node-suite', node_types: ['WASImageBlend'] }
      ])
    )
  })

  it('deduplicates the same node type within a pack', () => {
    const missing: MissingNodeType[] = [
      { type: 'ImpactSampler', cnrId: 'impact-pack' },
      { type: 'ImpactSampler', cnrId: 'impact-pack' }
    ]

    expect(groupMissingNodesByPack(missing)).toEqual([
      { pack_id: 'impact-pack', node_types: ['ImpactSampler'] }
    ])
  })

  it('falls back to "unknown" for nodes without a cnrId', () => {
    const missing: MissingNodeType[] = [
      { type: 'MysteryNode' },
      'LegacyStringNode'
    ]

    expect(groupMissingNodesByPack(missing)).toEqual([
      { pack_id: 'unknown', node_types: ['MysteryNode', 'LegacyStringNode'] }
    ])
  })

  it('keeps "unknown" separate from identified packs', () => {
    const missing: MissingNodeType[] = [
      { type: 'ImpactSampler', cnrId: 'impact-pack' },
      { type: 'MysteryNode' }
    ]

    const result = groupMissingNodesByPack(missing)

    expect(result).toHaveLength(2)
    expect(result).toEqual(
      expect.arrayContaining([
        { pack_id: 'impact-pack', node_types: ['ImpactSampler'] },
        { pack_id: 'unknown', node_types: ['MysteryNode'] }
      ])
    )
  })
})
