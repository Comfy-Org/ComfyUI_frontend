// @vitest-environment jsdom
// DOMPurify's sanitize walks a real DOM tree; happy-dom drops the sanitized inner
// tree when re-serializing DOMPurify's <template> round-trip, so this XSS-guard suite
// runs against jsdom, the reference DOM DOMPurify is tested against upstream.
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import MarkdownStream from './MarkdownStream.vue'

// Pins the agent-reply rendering contract (markdown in, safe HTML out) as it flows
// through the shared platform renderer; the renderer itself has its own tests.
describe('MarkdownStream', () => {
  it('renders markdown prose', () => {
    render(MarkdownStream, { props: { text: '**bold**' } })
    expect(screen.getByText('bold', { selector: 'strong' })).toBeInTheDocument()
  })

  it('strips a script tag (XSS guard)', () => {
    const { html } = render(MarkdownStream, {
      props: { text: 'hi <script>alert(1)</script> there' }
    })
    expect(html()).not.toContain('<script')
    expect(screen.getByText(/hi/)).toBeInTheDocument()
  })

  it('opens links in a new tab with rel=noopener', () => {
    render(MarkdownStream, { props: { text: '[docs](https://example.com)' } })
    const link = screen.getByRole('link', { name: 'docs' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('drops a javascript: url', () => {
    const { html } = render(MarkdownStream, {
      props: { text: '[x](javascript:alert(1))' }
    })
    expect(html()).not.toContain('javascript:')
  })
})
