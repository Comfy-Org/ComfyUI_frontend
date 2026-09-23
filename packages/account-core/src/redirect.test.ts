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
})
