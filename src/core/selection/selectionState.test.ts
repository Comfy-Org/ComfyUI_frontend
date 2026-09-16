import { describe, expect, expectTypeOf, it } from 'vitest'

import { toGroupId } from '@/types/groupId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

import { parseSelectableKey, toSelectableKey } from './selectionState'

describe('selectable keys', () => {
  it('round-trips kind and id, including ids containing separators', () => {
    const key = toSelectableKey('node', toNodeId('a:b'))
    expect(key).toBe('node:a:b')
    expect(parseSelectableKey(key)).toEqual({ kind: 'node', id: 'a:b' })
    expect(parseSelectableKey(toSelectableKey('group', toGroupId(7)))).toEqual({
      kind: 'group',
      id: '7'
    })
  })

  it('requires the ID brand belonging to the selectable kind', () => {
    expectTypeOf(toSelectableKey).toBeCallableWith('node', toNodeId(1))
    expectTypeOf(toSelectableKey).toBeCallableWith('io', toNodeId(-10))
    expectTypeOf(toSelectableKey).toBeCallableWith('group', toGroupId(2))
    expectTypeOf(toSelectableKey).toBeCallableWith('reroute', toRerouteId(3))
    // @ts-expect-error Group selection requires a GroupId.
    expectTypeOf(toSelectableKey).toBeCallableWith('group', 'invalid')
    // @ts-expect-error Reroute selection requires a RerouteId.
    expectTypeOf(toSelectableKey).toBeCallableWith('reroute', 'invalid')
    // @ts-expect-error Numeric entity IDs cannot be interchanged.
    expectTypeOf(toSelectableKey).toBeCallableWith('group', toRerouteId(2))
    // @ts-expect-error Node selection requires a NodeId.
    expectTypeOf(toSelectableKey).toBeCallableWith('node', toGroupId(2))
  })
})
