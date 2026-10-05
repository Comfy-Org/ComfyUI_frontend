import { describe, expect, expectTypeOf, it } from 'vitest'

import { toGroupId } from '@/types/groupId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

import type { SelectableKey, SelectableKind } from './selectionState'
import { parseSelectableKey, toSelectableKey } from './selectionState'

describe('selectable keys', () => {
  it.for([
    {
      key: toSelectableKey('node', toNodeId('a:b:c')),
      expected: { kind: 'node', id: 'a:b:c' }
    },
    {
      key: toSelectableKey('node', toNodeId('a\nb')),
      expected: { kind: 'node', id: 'a\nb' }
    },
    {
      key: toSelectableKey('node', toNodeId('')),
      expected: { kind: 'node', id: '' }
    },
    {
      key: toSelectableKey('group', toGroupId(7)),
      expected: { kind: 'group', id: '7' }
    },
    {
      key: toSelectableKey('reroute', toRerouteId(9)),
      expected: { kind: 'reroute', id: '9' }
    },
    {
      key: toSelectableKey('io', toNodeId(-10)),
      expected: { kind: 'io', id: '-10' }
    }
  ])('round-trips $key without truncating the ID', ({ key, expected }) => {
    expect(key).toBe(`${expected.kind}:${expected.id}`)
    expect(parseSelectableKey(key)).toEqual(expected)
  })

  it('encodes the selectable prefix in the key type', () => {
    expectTypeOf<SelectableKey>().toExtend<`${SelectableKind}:${string}`>()
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
