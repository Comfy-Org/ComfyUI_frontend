import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import type { SerialisedLLinkArray } from '@/lib/litegraph/src/LLink'
import type {
  ISerialisedGraph,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'

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
    const originNode = fromAny<LGraphNode, unknown>({
      id: toNodeId(1),
      outputs: [{ links: [linkId] }]
    })
    const link = fromPartial<LLink>({
      id: linkId,
      origin_id: originNode.id,
      origin_slot: 0,
      target_id: toNodeId(2),
      target_slot: 0,
      type: '*'
    })
    const links = new Map([[linkId, link]])
    const graph = fromAny<LGraph, unknown>({
      links,
      _removeLink: vi.fn((id) => links.delete(id)),
      getNodeById: vi.fn((nodeId) =>
        nodeId === originNode.id ? originNode : null
      )
    })

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
})

describe('fixBadLinks ↔ linkStore integration', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('treats a store-registered link as consistent without repairs', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', '*')
    b.addInput('in', '*')
    graph.add(a)
    graph.add(b)

    // Registered via the chokepoint; slot views derive from the store.
    const link = new LLink(toLinkId(9), '*', a.id, 0, b.id, 0)
    graph._addLink(link)

    const store = useLinkStore()
    const graphId = graph.rootGraph.id
    expect(store.isInputSlotConnected(graphId, b.id, 0)).toBe(true)
    expect(b.inputs[0].link).toBe(link.id)

    const result = fixBadLinks(graph, { fix: true, silent: true })

    expect(result).toMatchObject({ hasBadLinks: false, deleted: 0 })
    expect(graph._links.has(link.id)).toBe(true)
    expect(store.isInputSlotConnected(graphId, b.id, 0)).toBe(true)
  })
})
