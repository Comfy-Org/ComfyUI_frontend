import { describe, expect, test } from 'vitest'
import type { LocationQuery } from 'vue-router'

import { getSafePreviousFullPath } from './previousFullPath'

describe('getSafePreviousFullPath', () => {
  test('returns null when missing', () => {
    expect(getSafePreviousFullPath({})).toBeNull()
  })

  test('decodes and returns internal relative paths', () => {
    const query: LocationQuery = {
      previousFullPath: encodeURIComponent('/some/path?x=1')
    }
    expect(getSafePreviousFullPath(query)).toBe('/some/path?x=1')
  })

  test('rejects protocol-relative urls', () => {
    const query: LocationQuery = {
      previousFullPath: encodeURIComponent('//evil.com')
    }
    expect(getSafePreviousFullPath(query)).toBeNull()
  })

  test('rejects absolute external urls', () => {
    const query: LocationQuery = {
      previousFullPath: encodeURIComponent('https://evil.com/path')
    }
    expect(getSafePreviousFullPath(query)).toBeNull()
  })

  test('takes the first entry when the param is repeated', () => {
    const query: LocationQuery = {
      previousFullPath: [
        encodeURIComponent('/first'),
        encodeURIComponent('//evil.com')
      ]
    }
    expect(
      getSafePreviousFullPath(query),
      'reading the last entry would let an attacker override a legitimate value by appending a second one'
    ).toBe('/first')
  })

  test('rejects a repeated param whose first entry is unsafe', () => {
    const query: LocationQuery = {
      previousFullPath: [
        encodeURIComponent('https://evil.com'),
        encodeURIComponent('/safe')
      ]
    }
    expect(getSafePreviousFullPath(query)).toBeNull()
  })

  test('rejects malformed encodings', () => {
    const query: LocationQuery = {
      previousFullPath: '%E0%A4%A'
    }
    expect(getSafePreviousFullPath(query)).toBeNull()
  })
})
