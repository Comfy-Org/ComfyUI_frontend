import { describe, expect, it } from 'vitest'

import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

const OVERLAY_PAYLOAD = 'position:fixed;inset:0;z-index:99999;background:red'

function parseOne(html: string, selector: string): Element {
  const container = document.createElement('div')
  container.innerHTML = html
  const element = container.querySelector(selector)
  if (!element) throw new Error(`no ${selector} in ${html}`)
  return element
}

describe('markdownRendererUtil', () => {
  describe('renderMarkdownToHtml', () => {
    it('resolves a relative link href against the base URL', () => {
      const html = renderMarkdownToHtml(
        '[result](view?filename=gen.png)',
        'http://host/api'
      )
      expect(html).toContain('href="http://host/api/view?filename=gen.png"')
    })

    it('leaves fragment and query hrefs alone', () => {
      const html = renderMarkdownToHtml('[jump](#section)', 'http://host/api')
      expect(html).toContain('href="#section"')
    })

    it('does not rebase a data-URI image', () => {
      const html = renderMarkdownToHtml(
        '![p](data:image/png;base64,AAAA)',
        'http://host/api'
      )
      expect(html).toContain('src="data:image/png;base64,AAAA"')
    })

    it('joins a slashless base onto raw media srcs with a separator', () => {
      const html = renderMarkdownToHtml(
        '<video src="view?filename=out.mp4"></video>',
        '/api'
      )
      expect(html).toContain('src="/api/view?filename=out.mp4"')
    })

    it('leaves absolute and rooted link hrefs alone', () => {
      const html = renderMarkdownToHtml(
        '[a](https://example.com/x) [b](/api/view?f=1)',
        'http://host/api'
      )
      expect(html).toContain('href="https://example.com/x"')
      expect(html).toContain('href="/api/view?f=1"')
    })

    it('routes first-party Comfy API URLs through the active API base', () => {
      const url =
        'https://cloud.comfy.org/api/view?filename=gen.png&type=output'
      const html = renderMarkdownToHtml(
        `[${url}](${url}) ![result](${url})`,
        'http://localhost:5228/api'
      )

      expect(html).toContain(
        'href="http://localhost:5228/api/view?filename=gen.png&amp;type=output"'
      )
      expect(html).toContain(
        '>http://localhost:5228/api/view?filename=gen.png&amp;type=output</a>'
      )
      expect(html).toContain(
        'src="http://localhost:5228/api/view?filename=gen.png&amp;type=output"'
      )
    })

    it('rewrites protocol-relative Comfy API URLs through the parse fallback', () => {
      const html = renderMarkdownToHtml(
        '[asset](//cloud.comfy.org/api/view?filename=gen.png)',
        'http://localhost:5228/api'
      )

      expect(html).toContain(
        'href="http://localhost:5228/api/view?filename=gen.png"'
      )
    })

    it.for([
      {
        label: 'image href',
        markdown: `![x](<y" style="${OVERLAY_PAYLOAD}">)`,
        selector: 'img'
      },
      {
        label: 'link href',
        markdown: `[c](<y" style="${OVERLAY_PAYLOAD}">)`,
        selector: 'a'
      },
      {
        label: 'image alt text',
        markdown: `![a" style="${OVERLAY_PAYLOAD}](https://e.com/i.png)`,
        selector: 'img'
      }
    ])(
      'traps a quote-breakout payload from $label inside its attribute',
      ({ markdown, selector }) => {
        expect(markdown).toContain(`style="${OVERLAY_PAYLOAD}`)

        const element = parseOne(renderMarkdownToHtml(markdown, ''), selector)

        expect(element.getAttribute('style')).toBeNull()
        expect(element.outerHTML).toContain(OVERLAY_PAYLOAD)
      }
    )

    it('keeps a quoted title inside its attribute', () => {
      const html = renderMarkdownToHtml(
        '[asset](https://example.com/a "quo\\"te onmouseover=alert(1)")'
      )

      expect(html).toContain('title="quo&quot;te onmouseover=alert(1)"')
      expect(html).toContain('href="https://example.com/a"')
    })

    it('leaves absolute raw-HTML media srcs verbatim', () => {
      const html = renderMarkdownToHtml(
        '<video src="https://cloud.comfy.org/api/view?f=a.mp4" controls></video>',
        'http://localhost:5228/api'
      )

      expect(html).toContain('src="https://cloud.comfy.org/api/view?f=a.mp4"')
    })

    it('does not rebase API URLs on unrelated hosts', () => {
      const html = renderMarkdownToHtml(
        '[asset](https://example.com/api/view?filename=gen.png)',
        'http://localhost:5228/api'
      )

      expect(html).toContain(
        'href="https://example.com/api/view?filename=gen.png"'
      )
    })

    it('should render basic markdown to HTML', () => {
      const markdown = '# Hello\n\nThis is a test.'
      const html = renderMarkdownToHtml(markdown)

      expect(html).toContain('<h1')
      expect(html).toContain('Hello')
      expect(html).toContain('<p>')
      expect(html).toContain('This is a test.')
    })

    it('should render links with target="_blank" and rel="noopener noreferrer"', () => {
      const markdown = '[Click here](https://example.com)'
      const html = renderMarkdownToHtml(markdown)

      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
      expect(html).toContain('href="https://example.com"')
      expect(html).toContain('Click here')
    })

    it('should render multiple links with target="_blank"', () => {
      const markdown =
        '[Link 1](https://example.com) and [Link 2](https://test.com)'
      const html = renderMarkdownToHtml(markdown)

      const targetBlankMatches = html.match(/target="_blank"/g)
      expect(targetBlankMatches).toHaveLength(2)

      const relMatches = html.match(/rel="noopener noreferrer"/g)
      expect(relMatches).toHaveLength(2)
    })

    it('should handle relative image paths with baseUrl', () => {
      const markdown = '![Alt text](image.png)'
      const baseUrl = 'https://cdn.example.com'
      const html = renderMarkdownToHtml(markdown, baseUrl)

      expect(html).toContain(`src="${baseUrl}/image.png"`)
      expect(html).toContain('alt="Alt text"')
    })

    it('should not modify absolute image URLs', () => {
      const markdown = '![Alt text](https://example.com/image.png)'
      const baseUrl = 'https://cdn.example.com'
      const html = renderMarkdownToHtml(markdown, baseUrl)

      expect(html).toContain('src="https://example.com/image.png"')
      expect(html).not.toContain(baseUrl)
    })

    it('should handle empty markdown', () => {
      const html = renderMarkdownToHtml('')

      expect(html).toBe('')
    })

    it('should sanitize potentially dangerous HTML', () => {
      const markdown = '<script>alert("xss")</script>'
      const html = renderMarkdownToHtml(markdown)

      expect(html).not.toContain('<script>')
      expect(html).not.toContain('alert')
    })

    it('should allow video tags with proper attributes', () => {
      const markdown =
        '<video src="video.mp4" controls autoplay loop muted></video>'
      const html = renderMarkdownToHtml(markdown)

      expect(html).toContain('<video')
      expect(html).toContain('src="video.mp4"')
      expect(html).toContain('controls')
    })

    it('should render links with title attribute', () => {
      const markdown = '[Link](https://example.com "This is a title")'
      const html = renderMarkdownToHtml(markdown)

      expect(html).toContain('title="This is a title"')
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
    })

    it('should handle bare URLs (autolinks)', () => {
      const markdown = 'Visit https://example.com for more info.'
      const html = renderMarkdownToHtml(markdown)

      expect(html).toContain('href="https://example.com"')
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
    })

    it('should render complex markdown with links, images, and text', () => {
      const markdown = `
# Release Notes

Check out our [documentation](https://docs.example.com) for more info.

![Screenshot](screenshot.png)

Visit our [homepage](https://example.com) to learn more.
      `
      const baseUrl = 'https://cdn.example.com'
      const html = renderMarkdownToHtml(markdown, baseUrl)

      // Check links have target="_blank"
      const targetBlankMatches = html.match(/target="_blank"/g)
      expect(targetBlankMatches).toHaveLength(2)

      // Check image has baseUrl prepended
      expect(html).toContain(`${baseUrl}/screenshot.png`)

      // Check heading
      expect(html).toContain('Release Notes')
    })
  })

  describe('URL entity handling', () => {
    function attrOf(html: string, sel: string, attr: string) {
      const host = document.createElement('div')
      host.innerHTML = html
      return host.querySelector(sel)?.getAttribute(attr) ?? null
    }

    it('does not double-encode an entity a link URL already carries', () => {
      const html = renderMarkdownToHtml('[x](https://e.com/?a=1&amp;b=2)')

      expect(attrOf(html, 'a', 'href')).toBe('https://e.com/?a=1&b=2')
    })

    it('does not double-encode an entity an image URL already carries', () => {
      const html = renderMarkdownToHtml('![x](https://e.com/i.png?a=1&amp;b=2)')

      expect(attrOf(html, 'img', 'src')).toBe('https://e.com/i.png?a=1&b=2')
    })

    it.for([
      {
        label: 'decimal entity in a link',
        markdown: '[x](https://e.com/?a=1&#38;b=2)',
        selector: 'a',
        attribute: 'href',
        expected: 'https://e.com/?a=1&b=2'
      },
      {
        label: 'hex entity in a link',
        markdown: '[x](https://e.com/?a=1&#x26;b=2)',
        selector: 'a',
        attribute: 'href',
        expected: 'https://e.com/?a=1&b=2'
      },
      {
        label: 'decimal entity in an image',
        markdown: '![x](https://e.com/i.png?a=1&#38;b=2)',
        selector: 'img',
        attribute: 'src',
        expected: 'https://e.com/i.png?a=1&b=2'
      },
      {
        label: 'hex entity in an image',
        markdown: '![x](https://e.com/i.png?a=1&#x26;b=2)',
        selector: 'img',
        attribute: 'src',
        expected: 'https://e.com/i.png?a=1&b=2'
      }
    ])('decodes one numeric ampersand layer from $label', (testCase) => {
      const html = renderMarkdownToHtml(testCase.markdown)

      expect(attrOf(html, testCase.selector, testCase.attribute)).toBe(
        testCase.expected
      )
    })

    it('leaves a bare ampersand in a URL intact', () => {
      const html = renderMarkdownToHtml('[x](https://e.com/?a=1&b=2)')

      expect(attrOf(html, 'a', 'href')).toBe('https://e.com/?a=1&b=2')
    })

    it('decodes one entity layer only, keeping deeper ones literal', () => {
      const html = renderMarkdownToHtml('[x](https://e.com/?a=1&amp;amp;b=2)')

      expect(attrOf(html, 'a', 'href')).toBe('https://e.com/?a=1&amp;b=2')
    })

    it('removes a scheme made executable by entity decoding', () => {
      const html = renderMarkdownToHtml('[x](javascript&colon;alert(1))')

      expect(attrOf(html, 'a', 'href')).toBeNull()
    })

    it('still traps a quote that would break out of the attribute', () => {
      const html = renderMarkdownToHtml(
        '[x](https://e.com/?a="onload=alert(1))'
      )
      const anchor = parseOne(html, 'a')

      expect(anchor.getAttribute('href')).toContain('"onload=alert(1)')
      expect(
        Array.from(anchor.attributes)
          .map((a) => a.name)
          .sort()
      ).toEqual(['href', 'rel', 'target'])
    })
  })
})
