import { describe, expect, it } from 'vitest'

import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import { detectCustomNodeTypes } from './workflowCustomNodeDetectionService'

const mockDef = {} as ComfyNodeDefImpl

function createNode(type?: string, subgraphNodes?: LGraphNode[]): LGraphNode {
  return {
    type,
    isSubgraphNode: () => !!subgraphNodes,
    subgraph: subgraphNodes
      ? ({ nodes: subgraphNodes } as unknown as Subgraph)
      : undefined
  } as unknown as LGraphNode
}

function createGraph(nodes: LGraphNode[]): LGraph {
  return { nodes } as unknown as LGraph
}

describe('detectCustomNodeTypes', () => {
  it('returns empty array for null graph', () => {
    expect(detectCustomNodeTypes(null, {})).toEqual([])
  })

  it('returns empty array when all nodes are core', () => {
    const graph = createGraph([createNode('KSampler'), createNode('VAEDecode')])
    const defs = { KSampler: mockDef, VAEDecode: mockDef }
    expect(detectCustomNodeTypes(graph, defs)).toEqual([])
  })

  it('detects nodes not in core definitions', () => {
    const graph = createGraph([
      createNode('KSampler'),
      createNode('CustomUpscaler')
    ])
    const defs = { KSampler: mockDef }
    expect(detectCustomNodeTypes(graph, defs)).toEqual(['CustomUpscaler'])
  })

  it('deduplicates repeated custom node types', () => {
    const graph = createGraph([
      createNode('CustomNode'),
      createNode('CustomNode'),
      createNode('CustomNode')
    ])
    expect(detectCustomNodeTypes(graph, {})).toEqual(['CustomNode'])
  })

  it('detects custom nodes inside subgraphs', () => {
    const graph = createGraph([
      createNode('KSampler'),
      createNode('Wrapper', [
        createNode('NestedCustom'),
        createNode('KSampler')
      ])
    ])
    const defs = { KSampler: mockDef, Wrapper: mockDef }
    expect(detectCustomNodeTypes(graph, defs)).toEqual(['NestedCustom'])
  })

  it('ignores nodes without a type', () => {
    const graph = createGraph([createNode(undefined), createNode('KSampler')])
    const defs = { KSampler: mockDef }
    expect(detectCustomNodeTypes(graph, defs)).toEqual([])
  })
})
