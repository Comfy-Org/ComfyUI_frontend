import { describe, expect, it } from 'vitest'

import { escapeHtml } from './htmlEscape'

describe('escapeHtml', () => {
  it('escapes angle brackets so tag-like text is not parsed as markup', () => {
    expect(escapeHtml('<lora:my_style_v2:0.8>')).toBe(
      '&lt;lora:my_style_v2:0.8&gt;'
    )
  })

  it('escapes ampersands, quotes and apostrophes', () => {
    expect(escapeHtml('a & b "c" \'d\'')).toBe(
      'a &amp; b &quot;c&quot; &#39;d&#39;'
    )
  })

  it('leaves text without HTML-significant characters untouched', () => {
    expect(escapeHtml('plain text')).toBe('plain text')
  })

  it('returns an empty string for empty input', () => {
    expect(escapeHtml('')).toBe('')
  })
})
