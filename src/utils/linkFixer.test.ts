import { fixBadLinks } from '@comfyorg/workflow-validation'
import { describe, expect, it, vi } from 'vitest'

import type { SerialisedLLinkArray } from '@/lib/litegraph/src/LLink'
import type {
  ISerialisedGraph,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'

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
