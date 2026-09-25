import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readComparisonSelection,
  saveComparisonSelection
} from './comparison-selection'

beforeEach(() => localStorage.clear())

describe('saved comparison selection', () => {
  it('persists only ordered IDs and restores independently of caller memory', () => {
    const pair: [string, string] = ['left', 'right']
    saveComparisonSelection('user/workspace', pair)
    pair[0] = 'changed'
    expect(
      localStorage.getItem('cinematic-comparison-selection-v1:user%2Fworkspace')
    ).toBe('["left","right"]')
    expect(readComparisonSelection('user/workspace')).toEqual(['left', 'right'])
    saveComparisonSelection('user/workspace', ['right', 'left'])
    expect(readComparisonSelection('user/workspace')).toEqual(['right', 'left'])
  })

  it('isolates user and workspace namespaces, including encoded names', () => {
    saveComparisonSelection('a/b', ['one', 'two'])
    saveComparisonSelection('a%2Fb', ['three', 'four'])
    saveComparisonSelection('other/b', ['five', 'six'])
    expect(readComparisonSelection('a/b')).toEqual(['one', 'two'])
    expect(readComparisonSelection('a%2Fb')).toEqual(['three', 'four'])
    expect(readComparisonSelection('other/b')).toEqual(['five', 'six'])
    expect(readComparisonSelection('a/other')).toBeUndefined()
    for (const namespace of [undefined, '', '  ']) {
      saveComparisonSelection(namespace, ['one', 'two'])
      expect(readComparisonSelection(namespace)).toBeUndefined()
    }
    expect(localStorage.length).toBe(3)
  })

  it.for([
    '{broken',
    'null',
    '{}',
    '[]',
    '["one"]',
    '["one","two","three"]',
    '["same","same"]',
    '["","two"]',
    '["   ","two"]',
    '[1,"two"]',
    JSON.stringify(['x'.repeat(201), 'two']),
    ' '.repeat(4097)
  ])('ignores malformed or oversized saved JSON: %s', (raw) => {
    localStorage.setItem('cinematic-comparison-selection-v1:scope', raw)
    expect(readComparisonSelection('scope')).toBeUndefined()
  })

  it('accepts ID length boundaries and leaves a valid selection intact after rejected saves', () => {
    const pair = ['x'.repeat(200), 'y'.repeat(200)] as const
    saveComparisonSelection('scope', pair)
    for (const invalid of [
      ['', 'two'],
      ['same', 'same'],
      ['x'.repeat(201), 'two'],
      [' ', 'two']
    ] as const)
      saveComparisonSelection('scope', invalid)
    expect(readComparisonSelection('scope')).toEqual(pair)
  })

  it('tolerates blocked reads and writes without disrupting comparison', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    expect(readComparisonSelection('scope')).toBeUndefined()
    expect(() => saveComparisonSelection('scope', ['one', 'two'])).not.toThrow()
  })

  it('is harmless without browser storage', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readComparisonSelection('scope')).toBeUndefined()
    expect(() => saveComparisonSelection('scope', ['one', 'two'])).not.toThrow()
  })
})
