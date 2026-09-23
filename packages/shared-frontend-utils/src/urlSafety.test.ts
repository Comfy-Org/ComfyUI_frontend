import { describe, expect, it } from 'vitest'

import { isSafeExternalUrl } from './urlSafety'

describe('isSafeExternalUrl', () => {
  it.for([
    ['http', 'http://example.com'],
    ['https', 'https://example.com/repo'],
    ['https with query and hash', 'https://example.com/x?y=1#z']
  ])('accepts an %s URL', ([, value]) => {
    expect(isSafeExternalUrl(value)).toBe(true)
  })

  it.for([
    ['javascript', 'javascript:alert(1)'],
    ['data', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript', 'vbscript:msgbox(1)'],
    ['file', 'file:///etc/passwd'],
    ['not a URL', 'not a url'],
    ['empty string', '']
  ])('rejects a %s URL', ([, value]) => {
    expect(isSafeExternalUrl(value)).toBe(false)
  })
})
