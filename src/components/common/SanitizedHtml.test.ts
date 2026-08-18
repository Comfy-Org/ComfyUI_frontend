import { cleanup, render, screen } from '@testing-library/vue'
import sharedDomPurify from 'dompurify'
import { afterEach, describe, expect, it } from 'vitest'

import SanitizedHtml from './SanitizedHtml.vue'

const renderHtml = (html: string) =>
  render(SanitizedHtml, {
    props: { as: 'section', html },
    attrs: { 'data-testid': 'sanitized-html' }
  })

const rendered = () => screen.getByTestId('sanitized-html').innerHTML

describe('SanitizedHtml', () => {
  it('preserves safe markup while removing executable content', () => {
    renderHtml(
      [
        '<strong>Safe content</strong>',
        '<a id="safe-link" href="https://example.com" target="_blank">safe link</a>',
        '<a id="unsafe-link" href="javascript:alert(1)">unsafe link</a>',
        '<img src="x" alt="unsafe image" onerror="alert(1)">',
        '<script>alert(1)</script>'
      ].join('')
    )

    expect(screen.getByTestId('sanitized-html')).toBeInTheDocument()
    expect(
      screen.getByText('Safe content', { selector: 'strong' })
    ).toBeVisible()
    expect(screen.getByText('unsafe link')).not.toHaveAttribute('href')
    expect(screen.getByRole('link', { name: 'safe link' })).toHaveAttribute(
      'target',
      '_blank'
    )
    expect(screen.getByRole('link', { name: 'safe link' })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    )
    expect(
      screen.getByRole('img', { name: 'unsafe image' })
    ).not.toHaveAttribute('onerror')
    expect(screen.queryByText('alert(1)')).not.toBeInTheDocument()
  })

  describe('tag allowlist', () => {
    it('strips the interactive tags credential-phishing needs', () => {
      const blocked = [
        [
          'form',
          '<form action="https://evil.example"><input name="pw"></form>'
        ],
        ['input', '<input type="password" name="pw">'],
        ['button', '<button formaction="https://evil.example">go</button>'],
        ['textarea', '<textarea>text</textarea>'],
        ['select', '<select><option>one</option></select>'],
        ['style', '<style>body{display:none}</style>'],
        ['iframe', '<iframe src="https://evil.example"></iframe>'],
        ['object', '<object data="https://evil.example"></object>'],
        ['embed', '<embed src="https://evil.example">'],
        ['base', '<base href="https://evil.example/">'],
        ['meta', '<meta http-equiv="refresh" content="0;url=https://evil">']
      ]

      for (const [tag, html] of blocked) {
        cleanup()
        renderHtml(html)
        expect(rendered(), tag).not.toContain(`<${tag}`)
      }
    })

    it('keeps the tags markdown rendering needs', () => {
      const allowed = [
        ['p', '<p>paragraph</p>'],
        ['h2', '<h2>heading</h2>'],
        ['ul', '<ul><li>item</li></ul>'],
        ['pre', '<pre><code>code</code></pre>'],
        ['table', '<table><tbody><tr><td>cell</td></tr></tbody></table>'],
        ['blockquote', '<blockquote>quote</blockquote>'],
        ['img', '<img src="https://example.com/a.png" alt="a">']
      ]

      for (const [tag, html] of allowed) {
        cleanup()
        renderHtml(html)
        expect(rendered(), tag).toContain(`<${tag}`)
      }
    })
  })

  describe('target hardening', () => {
    it('adds rel to a non-_blank target, not just _blank', () => {
      renderHtml('<a href="https://example.com" target="pwn">named</a>')
      const link = screen.getByRole('link', { name: 'named' })
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('preserves an existing rel while adding noopener and noreferrer', () => {
      renderHtml(
        '<a href="https://example.com" target="_blank" rel="nofollow">x</a>'
      )
      const rel = screen.getByRole('link', { name: 'x' }).getAttribute('rel')
      expect(rel?.split(' ').sort()).toEqual([
        'nofollow',
        'noopener',
        'noreferrer'
      ])
    })
  })

  it('strips style, so overlay and clickjacking payloads cannot render', () => {
    renderHtml('<div style="position:fixed;inset:0;z-index:9999">overlay</div>')
    expect(rendered()).toContain('overlay')
    expect(rendered()).not.toContain('position:fixed')
    expect(rendered()).not.toContain('style=')
  })

  describe('isolation from the shared DOMPurify singleton', () => {
    afterEach(() => {
      sharedDomPurify.removeAllHooks()
    })

    it('is unaffected by hooks added to the shared instance', () => {
      sharedDomPurify.addHook('uponSanitizeElement', (node) => {
        // A deliberately destructive hook: if the singleton were shared, this
        // would empty every element this component renders.
        if (node instanceof Element) node.remove()
      })

      renderHtml('<strong>still here</strong>')
      expect(rendered()).toContain('still here')
    })
  })

  describe('degenerate input', () => {
    it('renders malformed markup without throwing', () => {
      const inputs = [
        ['empty string', ''],
        ['whitespace', '   '],
        ['plain text', 'just text'],
        ['unclosed tag', '<strong>unclosed'],
        ['stray closing tag', 'text</div>'],
        ['bare angle bracket', 'a < b'],
        ['nested unclosed', '<div><span>deep']
      ]

      for (const [name, html] of inputs) {
        cleanup()
        expect(() => renderHtml(html), name).not.toThrow()
      }
    })

    it('neutralises mutation and encoding payloads', () => {
      const payloads = [
        [
          'mutation via malformed nesting',
          '<noscript><p title="</noscript><img src=x onerror=alert(1)>">'
        ],
        [
          'svg foreignObject wrapper',
          '<svg><foreignObject><p>x</p></foreignObject></svg>'
        ],
        [
          'math annotation wrapper',
          '<math><annotation-xml encoding="text/html"><p>x</p></annotation-xml></math>'
        ],
        ['double-encoded handler', '<img src=x onerror=&#97;lert(1)>'],
        ['case-varied handler', '<img src=x OnErRoR=alert(1)>']
      ]

      for (const [name, html] of payloads) {
        cleanup()
        renderHtml(html)
        expect(rendered(), name).not.toContain('onerror')
        expect(rendered(), name).not.toContain('alert(1)')
      }
    })
  })
})
