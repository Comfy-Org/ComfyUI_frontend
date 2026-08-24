import { describe, expect, it } from 'vitest'

import { negotiate, parseAccept } from './accept'

const SUPPORTED = ['text/html', 'text/markdown'] as const

describe('parseAccept', () => {
  it('parses types, parameters, and q-values', () => {
    expect(parseAccept('text/markdown, text/html;q=0.8, */*;q=0.1')).toEqual([
      { type: 'text', subtype: 'markdown', q: 1 },
      { type: 'text', subtype: 'html', q: 0.8 },
      { type: '*', subtype: '*', q: 0.1 }
    ])
  })

  it('lowercases type names and tolerates whitespace', () => {
    expect(parseAccept(' TEXT/Markdown ;  q=0.5 ')).toEqual([
      { type: 'text', subtype: 'markdown', q: 0.5 }
    ])
  })

  it('skips entries without a slash', () => {
    expect(parseAccept('gibberish, text/html')).toEqual([
      { type: 'text', subtype: 'html', q: 1 }
    ])
  })

  it('clamps out-of-range q and ignores malformed q', () => {
    expect(parseAccept('text/html;q=2')[0]?.q).toBe(1)
    expect(parseAccept('text/html;q=-1')[0]?.q).toBe(0)
    expect(parseAccept('text/html;q=abc')[0]?.q).toBe(1)
    expect(parseAccept('text/html;q=')[0]?.q).toBe(1)
  })

  it('does not split on delimiters inside quoted parameter values', () => {
    expect(parseAccept('text/html;q=0.5;x="a, text/markdown, b"')).toEqual([
      { type: 'text', subtype: 'html', q: 0.5 }
    ])
    expect(parseAccept('text/html;x="a;q=0"')[0]?.q).toBe(1)
  })
})

// Test vectors from acceptmarkdown.com/guides/accept-parsing.
describe('negotiate', () => {
  it('serves markdown for a bare text/markdown', () => {
    expect(negotiate('text/markdown', SUPPORTED).choice).toBe('text/markdown')
  })

  it('serves markdown when it outranks html by q', () => {
    expect(negotiate('text/markdown, text/html;q=0.8', SUPPORTED).choice).toBe(
      'text/markdown'
    )
  })

  it('serves html for a bare text/html', () => {
    expect(negotiate('text/html', SUPPORTED).choice).toBe('text/html')
  })

  it('respects q=0 as explicit rejection', () => {
    expect(negotiate('text/markdown;q=0, text/html', SUPPORTED).choice).toBe(
      'text/html'
    )
  })

  it('returns null when the only match is rejected', () => {
    expect(negotiate('text/markdown;q=0', ['text/markdown']).choice).toBeNull()
  })

  it('a specific q=0 overrides a wildcard for that type', () => {
    const result = negotiate('text/markdown;q=0, */*', SUPPORTED)
    expect(result.scores['text/markdown']).toBe(0)
    expect(result.choice).toBe('text/html')
  })

  it('missing header means no constraint: serve the default', () => {
    expect(negotiate(null, SUPPORTED).choice).toBe('text/html')
  })

  it('*/* serves the default', () => {
    expect(negotiate('*/*', SUPPORTED).choice).toBe('text/html')
  })

  it('text/* ties resolve to the server-preferred type', () => {
    expect(negotiate('text/*', SUPPORTED).choice).toBe('text/html')
  })

  it('a real Chrome header serves html, not markdown', () => {
    const chrome =
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    expect(negotiate(chrome, SUPPORTED).choice).toBe('text/html')
  })

  it('an empty header (present but blank) is unsatisfiable', () => {
    expect(negotiate('', SUPPORTED).choice).toBeNull()
  })

  it('unsupported-only headers are unsatisfiable', () => {
    expect(negotiate('application/pdf', SUPPORTED).choice).toBeNull()
  })

  it('reports per-type scores', () => {
    const { scores } = negotiate('text/markdown, text/html;q=0.8', SUPPORTED)
    expect(scores).toEqual({ 'text/html': 0.8, 'text/markdown': 1 })
  })
})
