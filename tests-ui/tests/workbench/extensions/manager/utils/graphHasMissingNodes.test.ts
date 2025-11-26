import { describe, expect, it } from 'vitest'

import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import {
  collectMissingNodes,
  graphHasMissingNodes
} from '@/workbench/extensions/manager/utils/graphHasMissingNodes'

type NodeDefs = Record<string, unknown>

const createGraph = (nodes: LGraphNode[] = []): LGraph => {
  return { nodes } as unknown as LGraph
}

const createSubgraph = (nodes: LGraphNode[]): Subgraph => {
  return { nodes } as unknown as Subgraph
}

const createNode = (
  type?: string,
  subgraphNodes?: LGraphNode[]
): LGraphNode => {
  return {
    id: Math.random(),
    type,
    isSubgraphNode: subgraphNodes ? () => true : undefined,
    subgraph: subgraphNodes ? createSubgraph(subgraphNodes) : undefined
  } as unknown as LGraphNode
}

describe('graphHasMissingNodes', () => {
  it('returns false when graph is null', () => {
    expect(graphHasMissingNodes(null, {})).toBe(false)
  })

  it('returns false when every node has a definition', () => {
    const graph = createGraph([createNode('FooNode'), createNode('BarNode')])
    const nodeDefs: NodeDefs = {
      FooNode: {},
      BarNode: {}
    }

    expect(graphHasMissingNodes(graph, nodeDefs)).toBe(false)
  })

  it('returns true when at least one node is missing', () => {
    const graph = createGraph([
      createNode('FooNode'),
      createNode('MissingNode')
    ])
    const nodeDefs: NodeDefs = {
      FooNode: {}
    }

    expect(graphHasMissingNodes(graph, nodeDefs)).toBe(true)
  })

  it('checks nodes nested in subgraphs', () => {
    const graph = createGraph([
      createNode('ContainerNode', [createNode('InnerMissing')])
    ])
    const nodeDefs: NodeDefs = {
      ContainerNode: {}
    }

    const missingNodes = collectMissingNodes(graph, nodeDefs)
    expect(missingNodes).toHaveLength(1)
    expect(missingNodes[0]?.type).toBe('InnerMissing')
  })

  it('ignores nodes without a type', () => {
    const graph = createGraph([
      createNode(undefined),
      createNode(null as unknown as string)
    ])

    expect(graphHasMissingNodes(graph, {})).toBe(false)
  })
})
