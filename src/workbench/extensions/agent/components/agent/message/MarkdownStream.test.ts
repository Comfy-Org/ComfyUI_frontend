// @vitest-environment jsdom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import MarkdownStream from './MarkdownStream.vue'

describe('MarkdownStream', () => {
  it('renders markdown prose', () => {
    render(MarkdownStream, { props: { text: '**bold**' } })
    expect(screen.getByText('bold', { selector: 'strong' })).toBeInTheDocument()
  })

  it('renders empty text without error or content', () => {
    const { html } = render(MarkdownStream, { props: { text: '' } })
    expect(html()).not.toContain('<script')
    expect(screen.queryByRole('link')).toBeNull()
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

  it('renders a fenced block as a framed code block with its language and a copy button', () => {
    render(MarkdownStream, {
      props: { text: 'before\n```python\nprint("hi")\n```\nafter' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByText('python')).toBeInTheDocument()
    expect(
      screen.getByText('print("hi")', { selector: 'code' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    expect(screen.getByText('before')).toBeInTheDocument()
    expect(screen.getByText('after')).toBeInTheDocument()
  })

  it('handles a 4-backtick fence containing a 3-backtick fence', () => {
    render(MarkdownStream, {
      props: { text: '````md\n```js\ncode\n```\n````' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByText(/```js/, { selector: 'code' })).toBeInTheDocument()
    expect(screen.getByText('md')).toBeInTheDocument()
  })

  it('leaves an inline triple-backtick span mid-sentence as prose', () => {
    render(MarkdownStream, {
      props: { text: 'use ```npm i``` to install' }
    })
    expect(screen.getByText('npm i', { selector: 'code' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
  })

  it('keeps a 4-space-indented block as prose-rendered code, not a framed block', () => {
    render(MarkdownStream, {
      props: { text: 'steps:\n\n    npm install\n\ndone' },
      global: { plugins: [i18n] }
    })
    expect(
      screen.getByText('npm install', { selector: 'code' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
  })

  it('labels a fence by the first word of its info string', () => {
    render(MarkdownStream, {
      props: { text: '```python title=x\nprint("hi")\n```' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByText('python')).toBeInTheDocument()
    expect(screen.queryByText(/title=x/)).not.toBeInTheDocument()
  })

  it('labels a bare fence with no language as text', () => {
    render(MarkdownStream, {
      props: { text: '```\nplain body\n```' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByText('text')).toBeInTheDocument()
    expect(
      screen.getByText('plain body', { selector: 'code' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })
})
