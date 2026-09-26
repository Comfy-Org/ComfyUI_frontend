import { describe, expect, it } from 'vitest'

import { isValidUrl } from '@/utils/formatUtil'
import { toSafeExternalHref } from '@/utils/urlSafety'

describe('toSafeExternalHref', () => {
  it('passes http and https URLs through unchanged', () => {
    expect(toSafeExternalHref('https://github.com/user/repo')).toBe(
      'https://github.com/user/repo'
    )
    expect(toSafeExternalHref('http://example.com/a?b=1#c')).toBe(
      'http://example.com/a?b=1#c'
    )
  })

  it.for([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    '\tjavascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'blob:https://example.com/uuid',
    'file:///etc/passwd'
  ])('rejects %s', (url) => {
    expect(toSafeExternalHref(url)).toBeUndefined()
  })

  it('rejects unparseable, relative, and empty input', () => {
    expect(toSafeExternalHref('not a url')).toBeUndefined()
    expect(toSafeExternalHref('./docs/README.md')).toBeUndefined()
    expect(toSafeExternalHref('')).toBeUndefined()
    expect(toSafeExternalHref(null)).toBeUndefined()
    expect(toSafeExternalHref(undefined)).toBeUndefined()
  })

  it('is stricter than isValidUrl, which parses executable schemes', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(true)
    expect(toSafeExternalHref('javascript:alert(1)')).toBeUndefined()
  })
})
