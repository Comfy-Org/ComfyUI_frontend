import { describe, expect, it } from 'vitest'

import {
  advertisementShortfall,
  auditMarkdownAlternates
} from './markdownAlternateAudit'

const ORIGIN = 'https://comfy.org'

function page(route: string, twinHref?: string, canonical?: string) {
  return pageWithLink(
    route,
    twinHref &&
      `<link rel="alternate" type="text/markdown" href="${twinHref}">`,
    canonical
  )
}

function pageWithLink(route: string, twinLink?: string, canonical?: string) {
  const head = [
    canonical && `<link rel="canonical" href="${canonical}">`,
    twinLink
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
      canonicalChecked: 1,
      problems: []
    },
    {
      name: 'a twin that was not built',
      twins: {},
      canonicalChecked: 0,
      problems: ['/cli/: advertises /cli.md, which was not built']
    },
    {
      name: 'a twin without a canonical',
      twins: { '/cli.md': twin() },
      canonicalChecked: 0,
      problems: ['/cli/: /cli.md has no canonical in its front matter']
    },
    {
      name: 'a twin whose canonical drops the trailing slash',
      twins: { '/cli.md': twin(`${ORIGIN}/cli`) },
      canonicalChecked: 1,
      problems: [
        `/cli/: /cli.md names canonical ${ORIGIN}/cli, the page says ${ORIGIN}/cli/`
      ]
    }
  ])('reports $name', ({ twins, canonicalChecked, problems }) => {
    const report = auditMarkdownAlternates(
      [page('/cli/', '/cli.md', `${ORIGIN}/cli/`)],
      (path) => twins[path as keyof typeof twins],
      ORIGIN
    )
    expect(report).toEqual({ advertised: 1, canonicalChecked, problems })
  })

  it.for([
    `<link rel='alternate' type='text/markdown' href='/cli.md'>`,
    '<link rel=alternate type=text/markdown href=/cli.md>',
    '<link href="/cli.md" type="text/markdown" rel="alternate">',
    '<LINK TYPE="Text/Markdown" HREF="/cli.md" REL="alternate"/>'
  ])('reads the href of %s', (link) => {
    const report = auditMarkdownAlternates(
      [pageWithLink('/cli/', link)],
      () => undefined,
      ORIGIN
    )
    expect(report.problems).toEqual([
      '/cli/: advertises /cli.md, which was not built'
    ])
  })

  it.for([
    {
      name: 'a preload link',
      head: '<link rel="preload" type="text/markdown" href="/missing.md">'
    },
    {
      name: 'a link inside a comment',
      head: '<!-- <link rel="alternate" type="text/markdown" href="/missing.md"> -->'
    },
    {
      name: 'a link inside a script',
      head: '<script>"<link rel=alternate type=text/markdown href=/missing.md>"</script>'
    }
  ])('does not count $name as an advertisement', ({ head }) => {
    const report = auditMarkdownAlternates(
      [{ route: '/cli/', html: `<html><head>${head}</head></html>` }],
      () => undefined,
      ORIGIN
    )
    expect(report).toEqual({ advertised: 0, canonicalChecked: 0, problems: [] })
  })

  it('reads the real link after a commented-out one', () => {
    const report = auditMarkdownAlternates(
      [
        pageWithLink(
          '/cli/',
          '<!-- <link rel="alternate" type="text/markdown" href="/cli.md"> -->' +
            '<link rel="alternate" type="text/markdown" href="/missing.md">'
        )
      ],
      (path) => (path === '/cli.md' ? twin(`${ORIGIN}/cli/`) : undefined),
      ORIGIN
    )
    expect(report.problems).toEqual([
      '/cli/: advertises /missing.md, which was not built'
    ])
  })

  it('reports a twin href on another origin', () => {
    const report = auditMarkdownAlternates(
      [page('/cli/', 'https://other.example/cli.md')],
      () => twin(`${ORIGIN}/cli/`),
      ORIGIN
    )
    expect(report.problems).toEqual([
      `/cli/: advertises https://other.example/cli.md, which is not on ${ORIGIN}`
    ])
  })

  it('reports a markdown link whose href cannot be read', () => {
    const report = auditMarkdownAlternates(
      [pageWithLink('/cli/', '<link rel="alternate" type="text/markdown">')],
      () => twin(`${ORIGIN}/cli/`),
      ORIGIN
    )
    expect(report).toEqual({
      advertised: 1,
      canonicalChecked: 0,
      problems: ['/cli/: has a text/markdown link with no readable href']
    })
  })

  it('reports an href that is not a valid URL instead of throwing', () => {
    const report = auditMarkdownAlternates(
      [page('/guide/', '/100%-guide.md'), page('/cli/', '/cli.md')],
      (path) => (path === '/cli.md' ? twin(`${ORIGIN}/cli/`) : undefined),
      ORIGIN
    )
    expect(report.problems).toEqual([
      '/guide/: advertises /100%-guide.md, which is not a valid URL'
    ])
  })

  it('skips pages that advertise no markdown copy', () => {
    const report = auditMarkdownAlternates(
      [page('/payment/success/')],
      () => undefined,
      ORIGIN
    )
    expect(report).toEqual({ advertised: 0, canonicalChecked: 0, problems: [] })
  })

  it('checks only existence when the page emits no canonical', () => {
    const report = auditMarkdownAlternates(
      [page('/old-cli/', '/cli.md')],
      (path) => (path === '/cli.md' ? twin(`${ORIGIN}/cli/`) : undefined),
      ORIGIN
    )
    expect(report).toEqual({ advertised: 1, canonicalChecked: 0, problems: [] })
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
    expect(report).toEqual({ advertised: 1, canonicalChecked: 1, problems: [] })
  })
})

describe('advertisementShortfall', () => {
  it.for([
    { advertised: 855, builtPages: 950, fails: false },
    { advertised: 760, builtPages: 950, fails: false },
    { advertised: 759, builtPages: 950, fails: true },
    { advertised: 55, builtPages: 950, fails: true },
    { advertised: 0, builtPages: 0, fails: true }
  ])(
    '$advertised of $builtPages advertising fails: $fails',
    ({ advertised, builtPages, fails }) => {
      expect(advertisementShortfall(advertised, builtPages) !== undefined).toBe(
        fails
      )
    }
  )
})
