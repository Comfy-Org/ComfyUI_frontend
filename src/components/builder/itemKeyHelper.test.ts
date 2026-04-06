import { describe, expect, it } from 'vitest'

import {
  groupItemKey,
  inputItemKey,
  parseGroupItemKey,
  parseInputItemKey
} from './itemKeyHelper'

describe('inputItemKey', () => {
  it('builds key from string nodeId', () => {
    expect(inputItemKey('42', 'steps')).toBe('input:42:steps')
  })

  it('builds key from numeric nodeId', () => {
    expect(inputItemKey(7, 'cfg')).toBe('input:7:cfg')
  })
})

describe('groupItemKey', () => {
  it('builds key from groupId', () => {
    expect(groupItemKey('abc-123')).toBe('group:abc-123')
  })
})

describe('parseInputItemKey', () => {
  it('parses a valid input key', () => {
    expect(parseInputItemKey('input:42:steps')).toEqual({
      nodeId: '42',
      widgetName: 'steps'
    })
  })

  it('handles widget names containing colons', () => {
    expect(parseInputItemKey('input:5:a:b:c')).toEqual({
      nodeId: '5',
      widgetName: 'a:b:c'
    })
  })

  it('returns null for non-input keys', () => {
    expect(parseInputItemKey('group:abc')).toBeNull()
    expect(parseInputItemKey('output:1')).toBeNull()
  })
})

describe('parseGroupItemKey', () => {
  it('parses a valid group key', () => {
    expect(parseGroupItemKey('group:abc-123')).toBe('abc-123')
  })

  it('returns null for non-group keys', () => {
    expect(parseGroupItemKey('input:1:steps')).toBeNull()
  })
})
