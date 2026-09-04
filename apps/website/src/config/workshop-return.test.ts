import { describe, expect, it } from 'vitest'

import { safeReturnPath } from './workshop-return'

describe('safeReturnPath', () => {
  it('passes a same-origin absolute path through', () => {
    expect(safeReturnPath('/workshop/models/flux/')).toBe(
      '/workshop/models/flux/'
    )
    expect(safeReturnPath('/workshop/?tab=api')).toBe('/workshop/?tab=api')
  })

  it.for([
    ['a protocol-relative URL', '//evil.com/workshop'],
    ['a backslash variant', '/\\evil.com'],
    ['an absolute URL', 'https://evil.com/workshop'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a relative path', 'workshop/models'],
    ['an empty string', ''],
    ['null', null],
    ['undefined', undefined]
  ] as const)('falls back to the Workshop home for %s', ([, raw]) => {
    expect(safeReturnPath(raw)).toBe('/workshop/')
  })
})
