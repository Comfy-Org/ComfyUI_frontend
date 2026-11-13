import { describe, expect, it } from 'vitest'

import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createMockLGraphGroup,
  createMockLGraphNode
} from '@/utils/__tests__/litegraphTestUtils'

import { findParentGroup } from './parentGroup'

const node: LGraphNode = Object.assign(createMockLGraphNode(), {
  boundingRect: new Rectangle(100, 100, 50, 50)
})

function group(x: number, y: number, width: number, height: number) {
  return createMockLGraphGroup({
    boundingRect: new Rectangle(x, y, width, height)
  })
}

const outside = group(0, 0, 50, 50)
const outer = group(0, 0, 300, 300)
const inner = group(50, 50, 150, 150)
const wide = group(0, 0, 200, 200)
const overlapping = group(100, 100, 120, 120)

describe('findParentGroup', () => {
  it.for([
    { name: 'no groups', groups: [], expected: null },
    { name: 'a group away from the node', groups: [outside], expected: null },
    { name: 'one containing group', groups: [outside, wide], expected: wide },
    { name: 'nested, outer first', groups: [outer, inner], expected: inner },
    { name: 'nested, inner first', groups: [inner, outer], expected: inner },
    {
      name: 'overlapping, larger first',
      groups: [wide, overlapping],
      expected: overlapping
    },
    {
      name: 'overlapping, smaller first',
      groups: [overlapping, wide],
      expected: overlapping
    }
  ])('picks the parent group for $name', ({ groups, expected }) => {
    expect(findParentGroup(groups, node)).toBe(expected)
  })
})
