import { describe, expect, it } from 'vitest'

import { t, translationKeys } from '../../i18n/translations'
import { parseSafeRichText } from './safeRichText'
import type { SafeRichTextNode } from './safeRichText'

function collectText(nodes: SafeRichTextNode[]): string {
  return nodes
    .map((node) =>
      node.type === 'text' ? node.value : collectText(node.children)
    )
    .join('')
}

function collectAttr(nodes: SafeRichTextNode[], name: string): string[] {
  return nodes.flatMap((node) => {
    if (node.type === 'text') return []
    const value = node.attrs[name]
    return [...(value ? [value] : []), ...collectAttr(node.children, name)]
  })
}

function collectTags(nodes: SafeRichTextNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === 'text' ? [] : [node.tag, ...collectTags(node.children)]
  )
}

describe('parseSafeRichText', () => {
  it('keeps the supported rich-text structure and safe attributes', () => {
    expect(
      parseSafeRichText(
        '<ol><li><strong>Step</strong></li></ol><a href="/docs" target="_blank" rel="opener" class="underline evil">Docs</a>'
      )
    ).toEqual([
      {
        type: 'element',
        tag: 'ol',
        attrs: {},
        children: [
          {
            type: 'element',
            tag: 'li',
            attrs: {},
            children: [
              {
                type: 'element',
                tag: 'strong',
                attrs: {},
                children: [{ type: 'text', value: 'Step' }]
              }
            ]
          }
        ]
      },
      {
        type: 'element',
        tag: 'a',
        attrs: {
          href: '/docs',
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'underline'
        },
        children: [{ type: 'text', value: 'Docs' }]
      }
    ])
  })

  it('drops active content, event handlers, styles, and unsafe URLs', () => {
    expect(
      parseSafeRichText(
        '<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)" onclick="alert(1)">Link</a><span class="whitespace-nowrap evil" style="color:red">Text</span>'
      )
    ).toEqual([
      {
        type: 'element',
        tag: 'a',
        attrs: {},
        children: [{ type: 'text', value: 'Link' }]
      },
      {
        type: 'element',
        tag: 'span',
        attrs: { class: 'whitespace-nowrap' },
        children: [{ type: 'text', value: 'Text' }]
      }
    ])
  })

  it('allows only HTTPS, mailto, and same-origin relative links', () => {
    const links = parseSafeRichText(
      '<a href="https://comfy.org">HTTPS</a><a href="mailto:support@comfy.org">Mail</a><a href="/docs">Relative</a><a href="//evil.example">Protocol relative</a><a href="/\\evil.example">Backslash</a><a href="http://evil.example">HTTP</a>'
    )

    // Assert on the collected hrefs, not toMatchObject with `attrs: {}` — an
    // empty object is a subset of every object, so that form asserts nothing
    // about the links that are supposed to be rejected.
    expect(collectAttr(links, 'href')).toEqual([
      'https://comfy.org',
      'mailto:support@comfy.org',
      '/docs'
    ])
    expect(links).toHaveLength(6)
  })

  it.for([
    ['tab', '/\t//evil.example'],
    ['newline', '/\n//evil.example'],
    ['carriage return', '/\r//evil.example'],
    ['tab inside the host', '/\t/\t/evil.example'],
    ['protocol relative', '//evil.example'],
    ['backslash', '/\\evil.example'],
    ['plain HTTP', 'http://evil.example']
  ] as const)('drops an off-origin href smuggled past a %s', ([, href]) => {
    expect(
      collectAttr(parseSafeRichText(`<a href="${href}">x</a>`), 'href')
    ).toEqual([])
  })

  it.for([
    ['tab', '/\t//evil.example'],
    ['newline', '/\n//evil.example'],
    ['carriage return', '/\r//evil.example']
  ] as const)(
    'resolves off-origin once a %s is stripped by URL parsing',
    ([, href]) => {
      expect(new URL(href, 'https://comfy.org').origin).toBe(
        'https://evil.example'
      )
    }
  )

  it('drops aria and data attributes, which are not on the allowlist', () => {
    const [link] = parseSafeRichText(
      '<a href="/docs" aria-label="label" aria-hidden="true" data-x="1" id="anchor">x</a>'
    )

    expect(link).toEqual({
      type: 'element',
      tag: 'a',
      attrs: { href: '/docs' },
      children: [{ type: 'text', value: 'x' }]
    })
  })

  it('handles empty and malformed input', () => {
    expect(parseSafeRichText('')).toEqual([])
    expect(parseSafeRichText('<a href="/docs">Unclosed')).toEqual([
      {
        type: 'element',
        tag: 'a',
        attrs: { href: '/docs' },
        children: [{ type: 'text', value: 'Unclosed' }]
      }
    ])
  })

  it('preserves the text, links, and classes in every current translation', () => {
    for (const key of translationKeys) {
      for (const locale of ['en', 'zh-CN'] as const) {
        const source = t(key, locale)
        if (!/<[a-z]/i.test(source)) continue

        const parsed = parseSafeRichText(source)
        const context = `${key} (${locale})`
        expect(collectTags(parsed), context).toEqual(
          [...source.matchAll(/<([a-z][\w-]*)\b/gi)].map((match) =>
            match[1].toLowerCase()
          )
        )
        expect(collectText(parsed), context).toBe(
          source.replace(/<[^>]*>/g, '')
        )
        expect(collectAttr(parsed, 'href'), context).toEqual(
          [...source.matchAll(/href=["']([^"']+)/g)].map((match) => match[1])
        )
        expect(collectAttr(parsed, 'class'), context).toEqual(
          [...source.matchAll(/class=["']([^"']+)/g)].map((match) => match[1])
        )
      }
    }
  })
})
