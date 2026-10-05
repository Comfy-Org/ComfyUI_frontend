import { describe, expect, it } from 'vitest'

import { auditMarkdownAlternates } from './markdownAlternateAudit'

const ORIGIN = 'https://comfy.org'

function page(route: string, twinHref?: string, canonical?: string) {
  const head = [
    canonical && `<link rel="canonical" href="${canonical}">`,
    twinHref && `<link rel="alternate" type="text/markdown" href="${twinHref}">`
  ]
  return {
    route,
    html: `<html><head>${head.filter(Boolean).join('')}</head><body></body></html>`
  }
}

function twin(canonical?: string) {
  const front = canonical
    ? `title: "T"\ncanonical: ${canonical}\n`
    : 'title: "T"\n'
  return `---\n${front}---\n\n# T\n`
}

describe('auditMarkdownAlternates', () => {
  it.for([
    {
      name: 'a twin that names its page',
      twins: { '/cli.md': twin(`${ORIGIN}/cli/`) },
      problems: []
    },
    {
      name: 'a twin that was not built',
      twins: {},
      problems: ['/cli/: advertises /cli.md, which was not built']
    },
    {
      name: 'a twin without a canonical',
      twins: { '/cli.md': twin() },
      problems: ['/cli/: /cli.md has no canonical in its front matter']
    },
    {
      name: 'a twin whose canonical drops the trailing slash',
      twins: { '/cli.md': twin(`${ORIGIN}/cli`) },
      problems: [
        `/cli/: /cli.md names canonical ${ORIGIN}/cli, the page says ${ORIGIN}/cli/`
      ]
    }
  ])('reports $name', ({ twins, problems }) => {
    const report = auditMarkdownAlternates(
      [page('/cli/', '/cli.md', `${ORIGIN}/cli/`)],
      (path) => twins[path as keyof typeof twins],
      ORIGIN
    )
    expect(report).toEqual({ advertised: 1, problems })
  })

  it('skips pages that advertise no markdown copy', () => {
    const report = auditMarkdownAlternates(
      [page('/payment/success/')],
      () => undefined,
      ORIGIN
    )
    expect(report).toEqual({ advertised: 0, problems: [] })
  })

  it('falls back to the page address when the page has no canonical link', () => {
    const report = auditMarkdownAlternates(
      [page('/', '/index.md')],
      (path) => (path === '/index.md' ? twin(`${ORIGIN}/`) : undefined),
      ORIGIN
    )
    expect(report).toEqual({ advertised: 1, problems: [] })
  })

  it('resolves a percent-encoded twin href to the built file name', () => {
    const report = auditMarkdownAlternates(
      [
        page(
          '/zh-CN/café/',
          '/zh-CN/caf%C3%A9.md',
          `${ORIGIN}/zh-CN/caf%C3%A9/`
        )
      ],
      (path) =>
        path === '/zh-CN/café.md'
          ? twin(`${ORIGIN}/zh-CN/caf%C3%A9/`)
          : undefined,
      ORIGIN
    )
    expect(report).toEqual({ advertised: 1, problems: [] })
  })
})
