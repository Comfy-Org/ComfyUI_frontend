import { describe, expect, it } from 'vitest'

import type { FlattenableWorkflowNode } from '@/platform/workflow/core/utils/workflowFlattening'
import {
  buildSubgraphExecutionPaths,
  flattenWorkflowNodes
} from '@/platform/workflow/core/utils/workflowFlattening'

function node(id: number, type: string): FlattenableWorkflowNode {
  return { id, type }
}

function subgraphDef(
  id: string,
  nodes: FlattenableWorkflowNode[],
  nestedDefs: unknown[] = []
) {
  return {
    id,
    name: id,
    nodes,
    definitions: { subgraphs: nestedDefs },
    inputNode: {},
    outputNode: {}
  }
}

describe('buildSubgraphExecutionPaths', () => {
  it('returns empty map when there are no subgraph definitions', () => {
    expect(buildSubgraphExecutionPaths([node(5, 'SomeNode')], [])).toEqual(
      new Map()
    )
  })

  it('returns empty map when no root node matches a subgraph type', () => {
    const def = subgraphDef('def-A', [])
    expect(
      buildSubgraphExecutionPaths([node(5, 'UnrelatedNode')], [def])
    ).toEqual(new Map())
  })

  it('skips malformed subgraph definitions', () => {
    const malformedDef = {
      id: 'def-A',
      name: 'def-A',
      nodes: [null],
      inputNode: {},
      outputNode: {}
    }

    expect(
      buildSubgraphExecutionPaths([node(5, 'def-A')], [malformedDef])
    ).toEqual(new Map())
  })

  it('maps a single subgraph instance to its execution path', () => {
    const def = subgraphDef('def-A', [])
    const result = buildSubgraphExecutionPaths([node(5, 'def-A')], [def])
    expect(result.get('def-A')).toEqual(['5'])
  })

  it('collects multiple instances of the same subgraph type', () => {
    const def = subgraphDef('def-A', [])
    const result = buildSubgraphExecutionPaths(
      [node(5, 'def-A'), node(10, 'def-A')],
      [def]
    )
    expect(result.get('def-A')).toEqual(['5', '10'])
  })

  it('builds nested execution paths for subgraphs within subgraphs', () => {
    const innerDef = subgraphDef('def-B', [])
    const outerDef = subgraphDef('def-A', [node(70, 'def-B')])
    const result = buildSubgraphExecutionPaths(
      [node(5, 'def-A')],
      [outerDef, innerDef]
    )
    expect(result.get('def-A')).toEqual(['5'])
    expect(result.get('def-B')).toEqual(['5:70'])
  })

  it('does not recurse infinitely on self-referential subgraph definitions', () => {
    const cyclicDef = subgraphDef('def-A', [node(70, 'def-A')])
    const result = buildSubgraphExecutionPaths([node(5, 'def-A')], [cyclicDef])
    expect(result.get('def-A')).toEqual(['5'])
  })

  it('does not recurse infinitely on mutually cyclic subgraph definitions', () => {
    const defA = subgraphDef('def-A', [node(70, 'def-B')])
    const defB = subgraphDef('def-B', [node(80, 'def-A')])
    const result = buildSubgraphExecutionPaths([node(5, 'def-A')], [defA, defB])
    expect(result.get('def-A')).toEqual(['5'])
    expect(result.get('def-B')).toEqual(['5:70'])
  })
})

describe('flattenWorkflowNodes', () => {
  it('returns root nodes when no subgraphs exist', () => {
    const result = flattenWorkflowNodes({
      nodes: [node(1, 'KSampler'), node(2, 'CLIPLoader')]
    })

    expect(result).toHaveLength(2)
    expect(result.map((n) => n.id)).toEqual([1, 2])
  })

  it('returns empty array when nodes is undefined', () => {
    const result = flattenWorkflowNodes({})
    expect(result).toEqual([])
  })

  it('includes subgraph nodes with prefixed IDs', () => {
    const result = flattenWorkflowNodes({
      nodes: [node(5, 'def-A')],
      definitions: {
        subgraphs: [
          subgraphDef('def-A', [node(10, 'Inner'), node(20, 'Inner2')])
        ]
      }
    })

    expect(result).toHaveLength(3)
    expect(result.map((n) => n.id)).toEqual([5, '5:10', '5:20'])
  })

  it('skips malformed subgraph definitions', () => {
    const result = flattenWorkflowNodes({
      nodes: [node(5, 'def-A')],
      definitions: {
        subgraphs: [
          {
            id: 'def-A',
            name: 'def-A',
            nodes: [null],
            inputNode: {},
            outputNode: {}
          }
        ]
      }
    })

    expect(result.map((n) => n.id)).toEqual([5])
  })

  it('prefixes nested subgraph nodes with full execution path', () => {
    const innerDef = subgraphDef('def-B', [node(3, 'Leaf')])
    const outerDef = subgraphDef('def-A', [node(10, 'def-B')], [innerDef])
    const result = flattenWorkflowNodes({
      nodes: [node(5, 'def-A')],
      definitions: {
        subgraphs: [outerDef]
      }
    })

    expect(result.map((n) => n.id)).toEqual([5, '5:10', '5:10:3'])
  })

  it('does not clone phantom nodes from self-referential subgraphs', () => {
    const cyclicDef = subgraphDef('def-A', [node(70, 'def-A')])
    const result = flattenWorkflowNodes({
      nodes: [node(5, 'def-A')],
      definitions: {
        subgraphs: [cyclicDef]
      }
    })

    expect(result.map((n) => n.id)).toEqual([5, '5:70'])
  })

  it('does not clone phantom nodes from mutually cyclic subgraphs', () => {
    const defA = subgraphDef('def-A', [node(70, 'def-B')])
    const defB = subgraphDef('def-B', [node(80, 'def-A')])
    const result = flattenWorkflowNodes({
      nodes: [node(5, 'def-A')],
      definitions: {
        subgraphs: [defA, defB]
      }
    })

    expect(result.map((n) => n.id)).toEqual([5, '5:70', '5:70:80'])
  })
})
