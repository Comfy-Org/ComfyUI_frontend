// @vitest-environment happy-dom

import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SafeRichText from './SafeRichTextContent'

describe('SafeRichText', () => {
  it('renders supported markup and safe attributes', () => {
    render(SafeRichText, {
      props: {
        as: 'div',
        html: '<ol><li><strong>Step</strong></li></ol><a href="/docs" target="_blank" rel="opener" class="underline unknown">Docs</a>'
      },
      attrs: { 'aria-label': 'Summary' }
    })

    const root = screen.getByLabelText('Summary')
    const link = within(root).getByRole('link', { name: 'Docs' })

    const list = within(root).getByRole('list')
    expect(within(list).getByText('Step', { selector: 'strong' })).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/docs')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.className).toBe('underline')
  })

  it('drops active content, unsafe attributes, and unsafe URLs', () => {
    render(SafeRichText, {
      props: {
        html: '<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)" onclick="alert(1)">Link</a><span class="whitespace-nowrap unknown" style="color:red">Text</span>'
      }
    })

    expect(
      screen.queryByText('alert(1)', { exact: false, ignore: false })
    ).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('Link').hasAttribute('href')).toBe(false)
    expect(screen.getByText('Link').hasAttribute('onclick')).toBe(false)
    expect(screen.getByText('Text').className).toBe('whitespace-nowrap')
    expect(screen.getByText('Text').hasAttribute('style')).toBe(false)
  })

  it.for([
    ['protocol-relative URL', '//evil.example'],
    ['backslash URL', '/\\evil.example'],
    ['tab-smuggled URL', '/\t//evil.example'],
    ['HTTP URL', 'http://evil.example']
  ] as const)('drops a %s', ([, href]) => {
    render(SafeRichText, { props: { html: `<a href="${href}">Link</a>` } })

    expect(screen.getByText('Link').hasAttribute('href')).toBe(false)
  })
})
