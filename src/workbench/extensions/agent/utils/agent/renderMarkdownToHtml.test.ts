// @vitest-environment jsdom
// DOMPurify's sanitize walks a real DOM tree; happy-dom drops the sanitized inner
// tree when re-serializing DOMPurify's <template> round-trip, so this XSS-guard suite
// runs against jsdom, the reference DOM DOMPurify is tested against upstream.
import { describe, expect, it } from 'vitest'

import { renderMarkdownToHtml } from './renderMarkdownToHtml'

describe('renderMarkdownToHtml', () => {
  it('renders basic markdown', () => {
    expect(renderMarkdownToHtml('**bold**')).toContain('<strong>bold</strong>')
  })

  it('strips a script tag (XSS guard)', () => {
    const out = renderMarkdownToHtml('hi <script>alert(1)</script> there')
    expect(out).not.toContain('<script')
    expect(out).toContain('hi')
  })

  it('opens links in a new tab with rel=noopener', () => {
    const out = renderMarkdownToHtml('[docs](https://example.com)')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('drops a javascript: url', () => {
    const out = renderMarkdownToHtml('[x](javascript:alert(1))')
    expect(out).not.toContain('javascript:')
  })
})
