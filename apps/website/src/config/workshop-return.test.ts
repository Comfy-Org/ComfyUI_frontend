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
    ['undefined', undefined],
    ['a tab after the leading slash', '/\t/evil.com'],
    ['a newline after the leading slash', '/\n/evil.com'],
    ['a carriage return after the leading slash', '/\r/evil.com'],
    ['a tab-hidden backslash', '/\t\\evil.com']
  ] as const)('falls back to the Workshop home for %s', ([, raw]) => {
    expect(
      safeReturnPath(raw),
      'the browser strips C0 control chars before parsing, so /<TAB>//evil.com resolves cross-origin'
    ).toBe('/workshop/')
  })
})
