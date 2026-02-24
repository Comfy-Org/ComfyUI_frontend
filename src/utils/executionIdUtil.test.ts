import { describe, expect, it } from 'vitest'

import type { ComfyNode } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  buildSubgraphExecutionPaths,
  getAncestorExecutionIds,
  getParentExecutionIds
} from '@/utils/executionIdUtil'

function node(id: number, type: string): ComfyNode {
  return { id, type } as ComfyNode
}

function subgraphDef(id: string, nodes: ComfyNode[]) {
  return { id, name: id, nodes, inputNode: {}, outputNode: {} }
}

describe('getAncestorExecutionIds', () => {
  it('returns only itself for a root node', () => {
    expect(getAncestorExecutionIds('65')).toEqual(['65'])
  })

  it('returns all ancestors including self for nested IDs', () => {
    expect(getAncestorExecutionIds('65:70')).toEqual(['65', '65:70'])
    expect(getAncestorExecutionIds('65:70:63')).toEqual([
      '65',
      '65:70',
      '65:70:63'
    ])
  })
})

describe('getParentExecutionIds', () => {
  it('returns empty for a root node', () => {
    expect(getParentExecutionIds('65')).toEqual([])
  })

  it('returns all ancestors excluding self for nested IDs', () => {
    expect(getParentExecutionIds('65:70')).toEqual(['65'])
    expect(getParentExecutionIds('65:70:63')).toEqual(['65', '65:70'])
  })
})

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
    expect(() =>
      buildSubgraphExecutionPaths([node(5, 'def-A')], [cyclicDef])
    ).not.toThrow()
  })

  it('does not recurse infinitely on mutually cyclic subgraph definitions', () => {
    const defA = subgraphDef('def-A', [node(70, 'def-B')])
    const defB = subgraphDef('def-B', [node(80, 'def-A')])
    expect(() =>
      buildSubgraphExecutionPaths([node(5, 'def-A')], [defA, defB])
    ).not.toThrow()
  })
})
