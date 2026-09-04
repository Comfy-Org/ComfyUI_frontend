// @vitest-environment jsdom
// dompurify is inert under happy-dom — see the tripwire note in
// vitest.setup.ts (capricorn86/happy-dom#2182, FE-1189).
import { describe, expect, it } from 'vitest'

import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

describe('markdownRendererUtil', () => {
  describe('renderMarkdownToHtml', () => {
    it('resolves a relative link href against the base URL', () => {
      const html = renderMarkdownToHtml(
        '[result](view?filename=gen.png)',
        'http://host/api'
      )
      expect(html).toContain('href="http://host/api/view?filename=gen.png"')
    })

    it('resolves a relative href against a bare root base', () => {
      const html = renderMarkdownToHtml('[a](view)', '/')

      expect(html).toContain('href="/view"')
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

    it('keeps a quoted title inside its attribute', () => {
      const html = renderMarkdownToHtml(
        '[asset](https://example.com/a "quo\\"te onmouseover=alert(1)")'
      )

      expect(html).toContain('title="quo&quot;te onmouseover=alert(1)"')
      expect(html).toContain('href="https://example.com/a"')
    })

    it('does not double-encode a URL that already carries entities', () => {
      // Extension-visible regression: full entity escaping turned an
      // already-encoded &amp; into &amp;amp; and broke the URL.
      const html = renderMarkdownToHtml(
        '[report](https://example.com/view?a=1&amp;b=2)'
      )

      expect(html).toContain('href="https://example.com/view?a=1&amp;b=2"')
      expect(html).not.toContain('&amp;amp;')
    })

    it('still escapes a quote inside an href attribute', () => {
      const html = renderMarkdownToHtml(
        '[x](https://example.com/a"onmouseover=alert(1))'
      )

      expect(html).toContain('a&quot;onmouseover')
    })

    it('titles and alts stay quote-only like URLs', () => {
      const html = renderMarkdownToHtml(
        '[y](https://example.com/x?a=1&amp;b=2 "Tips &amp; tricks")'
      )

      // One rule at every attribute position: full escaping double-encoded
      // character references ("Tips &amp;amp; tricks" in tooltips).
      expect(html).toContain('title="Tips &amp; tricks"')
      expect(html).toContain('href="https://example.com/x?a=1&amp;b=2"')
      expect(html).not.toContain('&amp;amp;')
    })

    it('escapes a quote in image alt text', () => {
      const html = renderMarkdownToHtml('![q"t](https://example.com/i.png)')

      expect(html).toContain('alt="q&quot;t"')
    })

    it('quote-escapes an image src without touching its ampersands', () => {
      const html = renderMarkdownToHtml(
        '![p](https://example.com/img?w=1&amp;h=2)'
      )

      expect(html).toContain('src="https://example.com/img?w=1&amp;h=2"')
      expect(html).not.toContain('&amp;amp;')
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

    it('does not double-encode entity-bearing autolink text', () => {
      const html = renderMarkdownToHtml(
        'See https://example.com/view?a=1&amp;b=2 for results'
      )

      expect(html).toContain('>https://example.com/view?a=1&amp;b=2</a>')
      expect(html).not.toContain('&amp;amp;')

      // Characterization: raw & in autolink text serializes single-encoded
      // under any escape policy at this position.
      const raw = renderMarkdownToHtml('Go to https://example.com/a?x=1&y=2')
      expect(raw).toContain('>https://example.com/a?x=1&amp;y=2</a>')
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
})
