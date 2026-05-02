import { describe, expect, it } from 'vitest'

import { describeTopologyError, validateLinkTopology } from './linkTopology'
import type { SerialisedGraph } from './serialised'

function makeGraph(partial: Partial<SerialisedGraph>): SerialisedGraph {
  return { nodes: [], links: [], ...partial }
}

describe('validateLinkTopology', () => {
  it('returns no errors for a valid graph', () => {
    const graph = makeGraph({
      nodes: [
        { id: 1, outputs: [{ name: 'o', type: '*', links: [10] }] },
        { id: 2, inputs: [{ name: 'i', type: '*', link: 10 }] }
      ],
      links: [[10, 1, 0, 2, 0, '*']]
    })
    expect(validateLinkTopology(graph)).toEqual([])
  })

  it('reports target slot out of bounds (seedance regression)', () => {
    const graph = makeGraph({
      nodes: [
        { id: 9, outputs: [{ name: 'o', type: 'STRING', links: [29] }] },
        {
          id: 14,
          inputs: [
            { name: 'a', type: 'STRING', link: null },
            { name: 'b', type: 'STRING', link: null },
            { name: 'c', type: 'STRING', link: null },
            { name: 'd', type: 'STRING', link: 55 },
            { name: 'e', type: 'STRING', link: null }
          ]
        }
      ],
      links: [[29, 9, 0, 14, 9, 'STRING']]
    })
    const errors = validateLinkTopology(graph)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      kind: 'target-slot-out-of-bounds',
      link: { linkId: 29, targetId: 14, targetSlot: 9 },
      targetSlotCount: 5
    })
    expect(describeTopologyError(errors[0]!)).toContain(
      '[link=29 src=9:0 tgt=14:9]'
    )
  })

  it('reports a missing origin node', () => {
    const graph = makeGraph({
      nodes: [{ id: 2, inputs: [{ name: 'i', type: '*', link: 10 }] }],
      links: [[10, 999, 0, 2, 0, '*']]
    })
    const errors = validateLinkTopology(graph)
    expect(errors[0]?.kind).toBe('missing-origin-node')
  })

  it('reports a target-link mismatch', () => {
    const graph = makeGraph({
      nodes: [
        { id: 1, outputs: [{ name: 'o', type: '*', links: [10] }] },
        { id: 2, inputs: [{ name: 'i', type: '*', link: 999 }] }
      ],
      links: [[10, 1, 0, 2, 0, '*']]
    })
    const errors = validateLinkTopology(graph)
    expect(errors[0]).toMatchObject({
      kind: 'target-link-mismatch',
      actualLink: 999
    })
  })
})

describe('describeTopologyError', () => {
  it('formats every error kind with the [linkId, src, srcSlot, tgt, tgtSlot] tuple', () => {
    const link = {
      linkId: 7,
      originId: 3,
      originSlot: 1,
      targetId: 4,
      targetSlot: 2
    }
    const tuple = '[link=7 src=3:1 tgt=4:2]'
    expect(
      describeTopologyError({ kind: 'missing-origin-node', link })
    ).toContain(tuple)
    expect(
      describeTopologyError({ kind: 'missing-target-node', link })
    ).toContain(tuple)
    expect(
      describeTopologyError({
        kind: 'origin-slot-out-of-bounds',
        link,
        originSlotCount: 0
      })
    ).toContain(tuple)
    expect(
      describeTopologyError({
        kind: 'target-slot-out-of-bounds',
        link,
        targetSlotCount: 5
      })
    ).toContain(tuple)
    expect(
      describeTopologyError({ kind: 'origin-link-not-listed', link })
    ).toContain(tuple)
    expect(
      describeTopologyError({
        kind: 'target-link-mismatch',
        link,
        actualLink: null
      })
    ).toContain(tuple)
  })
})
