import { fromPartial } from '@total-typescript/shoehorn'
import type { PartialDeep } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import type { SerialisedLLinkArray } from '@/lib/litegraph/src/LLink'
import type {
  ISerialisedGraph,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'

import type { LinkId } from '@/types/linkId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { fixBadLinks } from './linkFixer'

type SerialisedInput = NonNullable<ISerialisedNode['inputs']>[number]
type SerialisedOutput = NonNullable<ISerialisedNode['outputs']>[number]

function createInput(link: number | null): SerialisedInput {
  return {
    name: 'input',
    type: '*',
    link
  } satisfies Partial<SerialisedInput> as SerialisedInput
}

function createOutput(links: number[]): SerialisedOutput {
  return {
    name: 'output',
    type: '*',
    links
  } satisfies Partial<SerialisedOutput> as SerialisedOutput
}

function createNode({
  id,
  inputs = [],
  outputs = []
}: {
  id: number
  inputs?: SerialisedInput[]
  outputs?: SerialisedOutput[]
}): ISerialisedNode {
  return {
    id,
    type: 'TestNode',
    pos: [0, 0],
    size: [100, 100],
    flags: {},
    order: 0,
    mode: 0,
    inputs,
    outputs
  }
}

function createGraph({
  nodes,
  links
}: {
  nodes: ISerialisedNode[]
  links: SerialisedLLinkArray[]
}): ISerialisedGraph {
  return {
    id: 'b4e984f1-b421-4d24-b8b4-ff895793af13',
    revision: 0,
    version: 0.4,
    last_node_id: Math.max(...nodes.map((node) => Number(node.id)), 0),
    last_link_id: Math.max(...links.map((link) => link[0]), 0),
    nodes,
    links,
    groups: []
  }
}

describe('fixBadLinks', () => {
  it('leaves a valid serialized graph unchanged', () => {
    const graph = createGraph({
      nodes: [
        createNode({ id: 1, outputs: [createOutput([1])] }),
        createNode({ id: 2, inputs: [createInput(1)] })
      ],
      links: [[1, 1, 0, 2, 0, '*']]
    })
    const logger = { log: vi.fn() }

    const result = fixBadLinks(graph, { logger })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: false,
      patched: 0,
      deleted: 0
    })
    expect(graph.nodes[0]?.outputs?.[0]?.links).toEqual([1])
    expect(graph.nodes[1]?.inputs?.[0]?.link).toBe(1)
    expect(logger.log).not.toHaveBeenCalled()
  })

  it('reports a missing origin output link during a dry run', () => {
    const graph = createGraph({
      nodes: [
        createNode({ id: 1, outputs: [createOutput([])] }),
        createNode({ id: 2, inputs: [createInput(1)] })
      ],
      links: [[1, 1, 0, 2, 0, '*']]
    })
    const logger = { log: vi.fn() }

    const result = fixBadLinks(graph, { logger })

    expect(result).toMatchObject({
      hasBadLinks: true,
      fixed: false,
      patched: 1,
      deleted: 0
    })
    expect(graph.nodes[0]?.outputs?.[0]?.links).toEqual([])
    expect(graph.nodes[1]?.inputs?.[0]?.link).toBe(1)
    expect(logger.log).toHaveBeenCalled()
  })

  it('adds a missing origin output link in fix mode', () => {
    const graph = createGraph({
      nodes: [
        createNode({ id: 1, outputs: [createOutput([])] }),
        createNode({ id: 2, inputs: [createInput(1)] })
      ],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 1,
      deleted: 0
    })
    expect(graph.nodes[0]?.outputs?.[0]?.links).toEqual([1])
    expect(graph.nodes[1]?.inputs?.[0]?.link).toBe(1)
  })

  it('sets a missing target input link in fix mode', () => {
    const graph = createGraph({
      nodes: [
        createNode({ id: 1, outputs: [createOutput([1])] }),
        createNode({ id: 2, inputs: [createInput(null)] })
      ],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 1,
      deleted: 0
    })
    expect(graph.nodes[0]?.outputs?.[0]?.links).toEqual([1])
    expect(graph.nodes[1]?.inputs?.[0]?.link).toBe(1)
  })

  it('reports a missing target input link during a dry run', () => {
    const graph = createGraph({
      nodes: [
        createNode({ id: 1, outputs: [createOutput([1])] }),
        createNode({ id: 2, inputs: [createInput(null)] })
      ],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph)

    expect(result).toMatchObject({
      hasBadLinks: true,
      fixed: false,
      patched: 1,
      deleted: 0
    })
    expect(graph.nodes[1]?.inputs?.[0]?.link).toBeNull()
  })

  it('removes the origin reference when the target input slot is missing', () => {
    const graph = createGraph({
      nodes: [
        createNode({ id: 1, outputs: [createOutput([1])] }),
        createNode({ id: 2 })
      ],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 1,
      deleted: 1
    })
    expect(graph.nodes[0]?.outputs?.[0]?.links).toEqual([])
    expect(graph.nodes[1]?.inputs).toEqual([])
    expect(graph.links).toEqual([])
  })

  it('removes a stale origin reference instead of overwriting another target link', () => {
    const graph = createGraph({
      nodes: [
        createNode({ id: 1, outputs: [createOutput([1])] }),
        createNode({ id: 2, inputs: [createInput(2)] })
      ],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 1,
      deleted: 1
    })
    expect(graph.nodes[0]?.outputs?.[0]?.links).toEqual([])
    expect(graph.nodes[1]?.inputs?.[0]?.link).toBe(2)
    expect(graph.links).toEqual([])
  })

  it('keeps the later target link when two links target the same input slot', () => {
    const graph = createGraph({
      nodes: [
        createNode({ id: 1, outputs: [createOutput([1])] }),
        createNode({ id: 2, outputs: [createOutput([2])] }),
        createNode({ id: 3, inputs: [createInput(null)] })
      ],
      links: [
        [1, 1, 0, 3, 0, '*'],
        [2, 2, 0, 3, 0, '*']
      ]
    })

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      deleted: 1
    })
    expect(graph.nodes[0]?.outputs?.[0]?.links).toEqual([])
    expect(graph.nodes[1]?.outputs?.[0]?.links).toEqual([2])
    expect(graph.nodes[2]?.inputs?.[0]?.link).toBe(2)
    expect(graph.links).toEqual([[2, 2, 0, 3, 0, '*']])
  })

  it('reports stale origin references during a dry run', () => {
    const graph = createGraph({
      nodes: [
        createNode({ id: 1, outputs: [createOutput([1])] }),
        createNode({ id: 2, inputs: [createInput(2)] })
      ],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph)

    expect(result).toMatchObject({
      hasBadLinks: true,
      fixed: false,
      patched: 1,
      deleted: 1
    })
    expect(graph.nodes[0]?.outputs?.[0]?.links).toEqual([1])
    expect(graph.links).toEqual([[1, 1, 0, 2, 0, '*']])
  })

  it('cleans dangling references when a linked node is missing', () => {
    const graph = createGraph({
      nodes: [createNode({ id: 2, inputs: [createInput(1)] })],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 1,
      deleted: 1
    })
    expect(graph.nodes[0]?.inputs?.[0]?.link).toBeNull()
    expect(graph.links).toEqual([])
  })

  it('deletes missing-origin links when the target does not reference them', () => {
    const graph = createGraph({
      nodes: [createNode({ id: 2, inputs: [createInput(null)] })],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 0,
      deleted: 1
    })
    expect(graph.nodes[0]?.inputs?.[0]?.link).toBeNull()
    expect(graph.links).toEqual([])
  })

  it('cleans dangling origin references when the target node is missing', () => {
    const graph = createGraph({
      nodes: [createNode({ id: 1, outputs: [createOutput([1])] })],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 1,
      deleted: 1
    })
    expect(graph.nodes[0]?.outputs?.[0]?.links).toEqual([])
    expect(graph.links).toEqual([])
  })

  it('deletes missing-target links when the origin does not reference them', () => {
    const graph = createGraph({
      nodes: [createNode({ id: 1, outputs: [createOutput([])] })],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 0,
      deleted: 1
    })
    expect(graph.nodes[0]?.outputs?.[0]?.links).toEqual([])
    expect(graph.links).toEqual([])
  })

  it('deletes a stale link that neither endpoint references', () => {
    const graph = createGraph({
      nodes: [
        createNode({ id: 1, outputs: [createOutput([])] }),
        createNode({ id: 2, inputs: [createInput(null)] })
      ],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 0,
      deleted: 1
    })
    expect(graph.links).toEqual([])
  })

  it('deletes stale links from live graph link maps', () => {
    const linkId = toLinkId(1)
    const originNode = fromPartial<LGraphNode>({
      id: toNodeId(1),
      outputs: [{ links: [linkId] }]
    } as PartialDeep<LGraphNode>)
    const link = fromPartial<LLink>({
      id: linkId,
      origin_id: originNode.id,
      origin_slot: 0,
      target_id: toNodeId(2),
      target_slot: 0,
      type: '*'
    })
    const links = new Map([[linkId, link]]) as Map<LinkId, LLink> &
      Record<LinkId, LLink>
    const graph = fromPartial<LGraph>({
      links,
      getNodeById: vi.fn((nodeId) =>
        nodeId === originNode.id ? originNode : null
      )
    } as PartialDeep<LGraph>)

    const result = fixBadLinks(graph, { fix: true, silent: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 1,
      deleted: 1
    })
    expect(links.has(linkId)).toBe(false)
    expect(originNode.outputs?.[0]?.links).toEqual([])
  })

  it('suppresses logger calls in silent mode while still applying fixes', () => {
    const graph = createGraph({
      nodes: [
        createNode({ id: 1, outputs: [createOutput([])] }),
        createNode({ id: 2, inputs: [createInput(1)] })
      ],
      links: [[1, 1, 0, 2, 0, '*']]
    })
    const logger = { log: vi.fn() }

    const result = fixBadLinks(graph, { fix: true, silent: true, logger })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 1,
      deleted: 0
    })
    expect(graph.nodes[0]?.outputs?.[0]?.links).toEqual([1])
    expect(logger.log).not.toHaveBeenCalled()
  })

  it('creates missing origin output slots in fix mode', () => {
    const graph = createGraph({
      nodes: [
        createNode({ id: 1 }),
        createNode({ id: 2, inputs: [createInput(1)] })
      ],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 1,
      deleted: 0
    })
    expect(graph.nodes[0]?.outputs?.[0]?.links).toEqual([1])
  })

  it('deletes links whose serialized endpoints are both missing', () => {
    const graph = createGraph({
      nodes: [],
      links: [[1, 1, 0, 2, 0, '*']]
    })

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 0,
      deleted: 1
    })
    expect(graph.links).toEqual([])
  })

  it('ignores null serialized link entries', () => {
    const graph = {
      ...createGraph({
        nodes: [createNode({ id: 1 })],
        links: []
      }),
      links: [null]
    }

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: false,
      patched: 0,
      deleted: 0
    })
    expect(graph.links).toEqual([])
  })

  it('deletes object-shaped serialized links', () => {
    const objectLink = {
      id: 1,
      origin_id: 1,
      origin_slot: 0,
      target_id: 2,
      target_slot: 0,
      type: '*'
    }
    const graph = fromPartial<ISerialisedGraph>({
      ...createGraph({
        nodes: [],
        links: []
      })
    } as PartialDeep<ISerialisedGraph>)
    Reflect.set(graph, 'links', [objectLink])

    const result = fixBadLinks(graph, { fix: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 0,
      deleted: 1
    })
    expect(graph.links).toEqual([])
  })

  it('treats invalid live graph endpoint ids as missing', () => {
    const linkId = toLinkId(1)
    const link = fromPartial<LLink>({
      id: linkId,
      origin_id: toNodeId(''),
      origin_slot: 0,
      target_id: toNodeId(''),
      target_slot: 0,
      type: '*'
    })
    const links = new Map([[linkId, link]]) as Map<LinkId, LLink> &
      Record<LinkId, LLink>
    const graph = fromPartial<LGraph>({
      links,
      getNodeById: vi.fn()
    } as PartialDeep<LGraph>)

    const result = fixBadLinks(graph, { fix: true, silent: true })

    expect(result).toMatchObject({
      hasBadLinks: false,
      fixed: true,
      patched: 0,
      deleted: 1
    })
    expect(graph.getNodeById).not.toHaveBeenCalled()
    expect(links.has(linkId)).toBe(false)
  })
})
