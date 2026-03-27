import { describe, expect, it } from 'vitest'

import {
  groupItemKey,
  inputItemKey,
  parseGroupItemKey,
  parseInputItemKey
} from './itemKeyHelper'

describe('inputItemKey', () => {
  it('builds key from nodeId and widgetName', () => {
    expect(inputItemKey('5', 'steps')).toBe('input:5:steps')
  })

  it('handles numeric nodeId', () => {
    expect(inputItemKey(42, 'cfg')).toBe('input:42:cfg')
  })

  it('preserves colons in widgetName', () => {
    expect(inputItemKey('1', 'a:b:c')).toBe('input:1:a:b:c')
  })
})

describe('groupItemKey', () => {
  it('builds key from groupId', () => {
    expect(groupItemKey('abc-123')).toBe('group:abc-123')
  })
})

describe('parseInputItemKey', () => {
  it('parses a valid input key', () => {
    expect(parseInputItemKey('input:5:steps')).toEqual({
      nodeId: '5',
      widgetName: 'steps'
    })
  })

  it('handles widgetName containing colons', () => {
    expect(parseInputItemKey('input:1:a:b:c')).toEqual({
      nodeId: '1',
      widgetName: 'a:b:c'
    })
  })

  it('returns null for non-input keys', () => {
    expect(parseInputItemKey('group:abc')).toBeNull()
    expect(parseInputItemKey('output:5')).toBeNull()
    expect(parseInputItemKey('run-controls')).toBeNull()
  })
})

describe('parseGroupItemKey', () => {
  it('parses a valid group key', () => {
    expect(parseGroupItemKey('group:abc-123')).toBe('abc-123')
  })

  it('returns null for non-group keys', () => {
    expect(parseGroupItemKey('input:5:steps')).toBeNull()
    expect(parseGroupItemKey('run-controls')).toBeNull()
  })
})
