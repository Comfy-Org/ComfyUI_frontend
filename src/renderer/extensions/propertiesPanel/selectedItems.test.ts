import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Positionable } from '@comfyorg/graph-model/interfaces'
import { toGroupId } from '@comfyorg/graph-model/groupId'

import { flatAndCategorizeSelectedItems } from './selectedItems'

describe('flatAndCategorizeSelectedItems', () => {
  let testGroup1: LGraphGroup
  let testGroup2: LGraphGroup
  let testNode1: LGraphNode
  let testNode2: LGraphNode
  let testNode3: LGraphNode

  beforeEach(() => {
    testGroup1 = new LGraphGroup('Group 1', toGroupId(1))
    testGroup2 = new LGraphGroup('Group 2', toGroupId(2))
    testNode1 = new LGraphNode('Node 1')
    testNode2 = new LGraphNode('Node 2')
    testNode3 = new LGraphNode('Node 3')
  })

  it('should return empty arrays for empty input', () => {
    const result = flatAndCategorizeSelectedItems([])

    expect(result.all).toEqual([])
    expect(result.nodes).toEqual([])
    expect(result.groups).toEqual([])
    expect(result.others).toEqual([])
    expect(result.nodeToParentGroup.size).toBe(0)
  })

  it('should categorize nodes', () => {
    const result = flatAndCategorizeSelectedItems([testNode1])

    expect(result.all).toEqual([testNode1])
    expect(result.nodes).toEqual([testNode1])
    expect(result.groups).toEqual([])
    expect(result.others).toEqual([])
    expect(result.nodeToParentGroup.size).toBe(0)
  })

  it('should categorize single group without children', () => {
    const result = flatAndCategorizeSelectedItems([testGroup1])

    expect(result.all).toEqual([testGroup1])
    expect(result.nodes).toEqual([])
    expect(result.groups).toEqual([testGroup1])
    expect(result.others).toEqual([])
  })

  it('should flatten group with child nodes', () => {
    testGroup1._children.add(testNode1)
    testGroup1._children.add(testNode2)

    const result = flatAndCategorizeSelectedItems([testGroup1])

    expect(result.all).toEqual([testGroup1, testNode1, testNode2])
    expect(result.nodes).toEqual([testNode1, testNode2])
    expect(result.groups).toEqual([testGroup1])
    expect(result.nodeToParentGroup.get(testNode1)).toBe(testGroup1)
    expect(result.nodeToParentGroup.get(testNode2)).toBe(testGroup1)
  })

  it('should handle nested groups', () => {
    testGroup1._children.add(testGroup2)
    testGroup2._children.add(testNode1)

    const result = flatAndCategorizeSelectedItems([testGroup1])

    expect(result.all).toEqual([testGroup1, testGroup2, testNode1])
    expect(result.nodes).toEqual([testNode1])
    expect(result.groups).toEqual([testGroup1, testGroup2])
    expect(result.nodeToParentGroup.get(testNode1)).toBe(testGroup2)
  })

  it('should handle mixed selection of nodes and groups', () => {
    testGroup1._children.add(testNode2)

    const result = flatAndCategorizeSelectedItems([
      testNode1,
      testGroup1,
      testNode3
    ])

    expect(result.all).toContain(testNode1)
    expect(result.all).toContain(testNode2)
    expect(result.all).toContain(testNode3)
    expect(result.all).toContain(testGroup1)

    expect(result.nodes).toEqual([testNode1, testNode2, testNode3])
    expect(result.groups).toEqual([testGroup1])
    expect(result.nodeToParentGroup.get(testNode1)).toBeUndefined()
    expect(result.nodeToParentGroup.get(testNode2)).toBe(testGroup1)
    expect(result.nodeToParentGroup.get(testNode3)).toBeUndefined()
  })

  it('should remove duplicate items across group and direct selection', () => {
    testGroup1._children.add(testNode1)

    const result = flatAndCategorizeSelectedItems([testGroup1, testNode1])

    expect(result.all).toEqual([testGroup1, testNode1])
    expect(result.nodes).toEqual([testNode1])
    expect(result.groups).toEqual([testGroup1])
    expect(result.nodeToParentGroup.get(testNode1)).toBe(testGroup1)
  })

  it('should handle non-node/non-group items as others', () => {
    const unknownItem: Positionable = {
      id: toGroupId(99),
      pos: [0, 0],
      boundingRect: [0, 0, 100, 100],
      move: vi.fn(),
      snapToGrid: () => false
    }

    const result = flatAndCategorizeSelectedItems([
      testNode1,
      unknownItem,
      testGroup1
    ])

    expect(result.nodes).toEqual([testNode1])
    expect(result.groups).toEqual([testGroup1])
    expect(result.others).toEqual([unknownItem])
    expect(result.all).not.toContain(unknownItem)
  })
})
