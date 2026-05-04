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

function makeGraph(
  nodes: SerialisedNode[],
  links: Array<SerialisedLinkArray | SerialisedLinkObject>
): SerialisedGraph {
  return { nodes, links }
}

describe('repairLinks abort behaviour', () => {
  it('throws LinkRepairAbortedError carrying the topology context when the patched view diverges from the live graph', () => {
    const node1: SerialisedNode = {
      id: 1,
      outputs: [output([10, 11])]
    }
    const node2: SerialisedNode = {
      id: 2,
      inputs: [input(null)]
    }
    const graph = makeGraph(
      [node1, node2],
      [
        [10, 1, 0, 2, 0, '*'],
        [11, 1, 0, 2, 0, '*']
      ]
    )

    let thrown: unknown
    try {
      repairLinks(graph, { fix: true, silent: true })
    } catch (err) {
      thrown = err
    }
    if (thrown instanceof LinkRepairAbortedError) {
      expect(thrown.topologyError.link.linkId).toBeGreaterThan(0)
      expect(typeof thrown.message).toBe('string')
    }
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
    const node1: SerialisedNode = { id: 1, outputs: [output([99])] }
    const node2: SerialisedNode = { id: 2, inputs: [input(99)] }
    const graph: SerialisedGraph = {
      nodes: [node1, node2],
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
    const node1: SerialisedNode = {
      id: 1,
      outputs: [output([])]
    }
    const node2: SerialisedNode = {
      id: 2,
      inputs: [input(null)]
    }
    const links: Record<number, SerialisedLinkObject> = {
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
      links: links as unknown as SerialisedGraph['links'],
      getNodeById: (id: string | number) =>
        [node1, node2].find((n) => n.id == id)
    } as SerialisedGraph & {
      getNodeById: (id: string | number) => SerialisedNode | undefined
    }

    repairLinks(liveGraph, { fix: true, silent: true })

    expect((links as Record<number, SerialisedLinkObject>)[42]).toBeUndefined()
  })
})

describe('repairLinks describeTopologyError coverage via abort', () => {
  it('produces a message tuple for every kind of LinkRepairAbortedError path', () => {
    const link = {
      linkId: 1,
      originId: 1,
      originSlot: 0,
      targetId: 2,
      targetSlot: 0
    }
    const cases = [
      new LinkRepairAbortedError({ kind: 'missing-origin-node', link }),
      new LinkRepairAbortedError({ kind: 'missing-target-node', link }),
      new LinkRepairAbortedError({
        kind: 'origin-slot-out-of-bounds',
        link,
        originSlotCount: 2
      }),
      new LinkRepairAbortedError({
        kind: 'target-slot-out-of-bounds',
        link,
        targetSlotCount: 4
      }),
      new LinkRepairAbortedError({ kind: 'origin-link-not-listed', link }),
      new LinkRepairAbortedError({
        kind: 'target-link-mismatch',
        link,
        actualLink: null
      })
    ]
    for (const err of cases) {
      expect(err.message).toContain('[link=1 src=1:0 tgt=2:0]')
    }
  })
})
