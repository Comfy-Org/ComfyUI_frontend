import { describe, expect, it } from 'vitest'

import { safeInternalPath } from './redirect'

const ORIGIN = 'https://comfy.org'
const HOME = '/workshop/'

describe('safeInternalPath', () => {
  it('keeps a same-origin absolute path with its query and hash', () => {
    expect(
      safeInternalPath('/workshop/models/x/?tab=api#run', ORIGIN, HOME)
    ).toBe('/workshop/models/x/?tab=api#run')
  })

  it.for([
    ['a protocol-relative URL', '//evil.example/x'],
    ['a backslash-prefixed URL', '/\\evil.example'],
    ['an absolute URL', 'https://evil.example/'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a relative path', 'workshop/'],
    ['a tab hiding a protocol-relative URL', '/\t//evil.example'],
    ['an empty string', ''],
    ['null', null],
    ['undefined', undefined]
  ] as const)('falls back for %s', ([, raw]) => {
    expect(safeInternalPath(raw, ORIGIN, HOME)).toBe(HOME)
  })

  it('normalises the path through the URL parser', () => {
    expect(safeInternalPath('/workshop/../login/', ORIGIN, HOME)).toBe(
      '/login/'
    )
  })

  it('carries the workspace deep-link parameter through a sign-in redirect', () => {
    expect(
      safeInternalPath('/v1/pricing?workspace=w-abc&x=1', ORIGIN, HOME)
    ).toBe('/v1/pricing?workspace=w-abc&x=1')
  })

  it.for([
    ['a dot-segment before a protocol-relative host', '/..//evil.example'],
    ['repeated dot-segments before a protocol-relative host', '/../..//evil.example'],
    ['a named segment resolved away before a protocol-relative host', '/a/..//evil.example'],
    ['a single-dot segment before a protocol-relative host', '/.//evil.example']
  ] as const)('falls back for %s', ([, raw]) => {
    // Each resolves same-origin inside `new URL`, but its normalised pathname
    // starts with `//` — protocol-relative once the browser re-resolves the
    // returned string (#20922).
    expect(safeInternalPath(raw, ORIGIN, HOME)).toBe(HOME)
  })

  it('still normalises ordinary dot-segments that stay inside the origin', () => {
    expect(safeInternalPath('/workshop/../../login/', ORIGIN, HOME)).toBe('/login/')
    expect(safeInternalPath('/a/./b/', ORIGIN, HOME)).toBe('/a/b/')
  })
})
