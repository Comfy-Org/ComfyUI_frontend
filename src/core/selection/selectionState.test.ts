import { describe, expect, it } from 'vitest'

import { parseSelectableKey, toSelectableKey } from './selectionState'

describe('selectable keys', () => {
  it('round-trips kind and id, including ids containing separators', () => {
    const key = toSelectableKey('node', 'a:b')
    expect(key).toBe('node:a:b')
    expect(parseSelectableKey(key)).toEqual({ kind: 'node', id: 'a:b' })
    expect(parseSelectableKey(toSelectableKey('group', 7))).toEqual({
      kind: 'group',
      id: '7'
    })
  })
})
