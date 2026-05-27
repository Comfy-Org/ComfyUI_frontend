import { describe, expect, it } from 'vitest'

import { LinkRepairAbortedError, repairLinks } from './linkRepair'
import type {
  SerialisedGraph,
  SerialisedLinkArray,
  SerialisedLinkObject,
  SerialisedNode,
  SerialisedNodeInput,
  SerialisedNodeOutput
} from './serialised'

function input(link: number | null): SerialisedNodeInput {
  return { name: 'i', type: '*', link }
}

function output(links: number[]): SerialisedNodeOutput {
  return { name: 'o', type: '*', links }
}

describe('repairLinks abort behaviour', () => {
  it('LinkRepairAbortedError carries the seedance-style topology context', () => {
    const link = {
      linkId: 29,
      originId: 9,
      originSlot: 0,
      targetId: 14,
      targetSlot: 9
    }
    const err = new LinkRepairAbortedError({
      kind: 'target-slot-out-of-bounds',
      link,
      targetSlotCount: 5
    })
    expect(err).toBeInstanceOf(Error)
    expect(err.topologyError.link).toEqual(link)
    expect(err.message).toContain('[link=29 src=9:0 tgt=14:9]')
  })

  it('LinkRepairAbortedError exposes a topologyError discriminated union', () => {
    const err = new LinkRepairAbortedError({
      kind: 'target-link-mismatch',
      link: {
        linkId: 99,
        originId: 1,
        originSlot: 0,
        targetId: 2,
        targetSlot: 0
      },
      actualLink: 5
    })
    expect(err.topologyError.kind).toBe('target-link-mismatch')
    expect(err.message).toContain('[link=99 src=1:0 tgt=2:0]')
    expect(err.name).toBe('LinkRepairAbortedError')
  })
})

describe('repairLinks delete-with-missing-index path', () => {
  it('does not corrupt the link array when the deleted link disappears mid-iteration', () => {
    const graph: SerialisedGraph = {
      nodes: [
        { id: 1, outputs: [output([99])] },
        { id: 2, inputs: [input(99)] }
      ],
      links: [
        [42, 1, 0, 2, 5, '*'],
        [99, 1, 0, 2, 0, '*']
      ]
    }

    repairLinks(graph, { fix: true, silent: true })

    const surviving = graph.links.find(
      (l): l is SerialisedLinkArray =>
        Array.isArray(l) && (l as SerialisedLinkArray)[0] === 99
    )
    expect(surviving).toBeDefined()
  })
})

describe('repairLinks live-graph branch', () => {
  it('uses graph.getNodeById and treats links as a record when the live-graph hook is present', () => {
    const node1: SerialisedNode = { id: 1, outputs: [output([])] }
    const node2: SerialisedNode = { id: 2, inputs: [input(null)] }
    const linkRecord: Record<number, SerialisedLinkObject> = {
      42: {
        id: 42,
        origin_id: 999,
        origin_slot: 0,
        target_id: 2,
        target_slot: 0,
        type: '*'
      }
    }
    const liveGraph = {
      nodes: [node1, node2],
      links: linkRecord,
      getNodeById: (id: string | number) =>
        [node1, node2].find((n) => n.id == id)
    } as unknown as SerialisedGraph & {
      getNodeById: (id: string | number) => SerialisedNode | undefined
    }

    repairLinks(liveGraph, { fix: true, silent: true })

    expect(linkRecord[42]).toBeUndefined()
  })
})

describe('repairLinks happy-path repair flow', () => {
  it('patches a missing origin reference and deletes a dangling link, reporting non-zero patched and deleted counts', () => {
    const graph: SerialisedGraph = {
      nodes: [
        { id: 1, outputs: [output([])] },
        { id: 2, inputs: [input(10)] },
        { id: 3, outputs: [output([])] }
      ],
      links: [
        [10, 1, 0, 2, 0, '*'],
        [99, 3, 0, 999, 0, '*']
      ]
    }

    const result = repairLinks(graph, { fix: true, silent: true })

    expect(result.patched).toBeGreaterThan(0)
    expect(result.deleted).toBeGreaterThan(0)
    expect(graph.nodes[0]!.outputs![0]!.links).toContain(10)
    const danglingSurvives = (graph.links as SerialisedLinkArray[]).some(
      (l) => Array.isArray(l) && l[0] === 99
    )
    expect(danglingSurvives).toBe(false)
  })
})
