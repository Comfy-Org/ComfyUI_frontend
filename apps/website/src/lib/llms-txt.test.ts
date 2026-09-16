import { describe, expect, it } from 'vitest'

import {
  findCanonicalDrift,
  findRedirectedLinks,
  internalLinks,
  normalizePath,
  parseLlmsTxtLinks
} from './llms-txt'

describe('parseLlmsTxtLinks', () => {
  it('extracts title, url, and description from a bullet line', () => {
    const llmsTxt = [
      '# Comfy',
      '',
      '- [Comfy Desktop](https://comfy.org/download/): Free desktop app.',
      'not a bullet line',
      '- [Docs](https://docs.comfy.org/): Documentation.'
    ].join('\n')

    expect(parseLlmsTxtLinks(llmsTxt)).toEqual([
      {
        title: 'Comfy Desktop',
        url: 'https://comfy.org/download/',
        description: 'Free desktop app.'
      },
      {
        title: 'Docs',
        url: 'https://docs.comfy.org/',
        description: 'Documentation.'
      }
    ])
  })

  it('ignores bullets that are not links', () => {
    expect(parseLlmsTxtLinks('- just a bullet, no link')).toEqual([])
  })
})

describe('normalizePath', () => {
  it('drops a trailing slash', () => {
    expect(normalizePath('/download/')).toBe('/download')
  })

  it('keeps the root path as /', () => {
    expect(normalizePath('/')).toBe('/')
  })

  it('leaves a path with no trailing slash unchanged', () => {
    expect(normalizePath('/download')).toBe('/download')
  })
})

describe('internalLinks', () => {
  it('keeps only links on the given hostname, normalized', () => {
    const links = [
      { title: 'Desktop', url: 'https://comfy.org/download/', description: '' },
      { title: 'Docs', url: 'https://docs.comfy.org/', description: '' }
    ]

    expect(internalLinks(links)).toEqual([
      { path: '/download', link: links[0] }
    ])
  })
})

describe('findRedirectedLinks', () => {
  it('flags a link whose path is a known redirect source', () => {
    const links = [
      {
        title: 'Enterprise',
        url: 'https://comfy.org/cloud/enterprise/',
        description: 'stale'
      }
    ]

    expect(findRedirectedLinks(links, new Set(['/cloud/enterprise']))).toEqual(
      links
    )
  })

  it('leaves a link that is not a redirect source alone', () => {
    const links = [
      {
        title: 'Enterprise',
        url: 'https://comfy.org/enterprise/',
        description: ''
      }
    ]

    expect(findRedirectedLinks(links, new Set(['/cloud/enterprise']))).toEqual(
      []
    )
  })

  it('ignores external links even if their path matches a redirect source', () => {
    const links = [
      { title: 'Docs', url: 'https://docs.comfy.org/pricing', description: '' }
    ]

    expect(findRedirectedLinks(links, new Set(['/pricing']))).toEqual([])
  })
})

describe('findCanonicalDrift', () => {
  it('flags a link whose built page canonicalizes elsewhere', () => {
    const links = [
      {
        title: 'Old Enterprise',
        url: 'https://comfy.org/cloud/enterprise/',
        description: 'stale'
      }
    ]

    const drift = findCanonicalDrift(
      links,
      () => 'https://comfy.org/enterprise/'
    )

    expect(drift).toEqual([
      { link: links[0], canonical: 'https://comfy.org/enterprise/' }
    ])
  })

  it('leaves a link whose canonical matches its own URL alone', () => {
    const links = [
      {
        title: 'Enterprise',
        url: 'https://comfy.org/enterprise/',
        description: ''
      }
    ]

    const drift = findCanonicalDrift(
      links,
      () => 'https://comfy.org/enterprise/'
    )

    expect(drift).toEqual([])
  })

  it('skips a link with no built page (e.g. the external workflows app)', () => {
    const links = [
      {
        title: 'Workflows',
        url: 'https://comfy.org/workflows/',
        description: ''
      }
    ]

    const drift = findCanonicalDrift(links, () => undefined)

    expect(drift).toEqual([])
  })

  it('flags a same-path canonical on a different origin', () => {
    const links = [
      {
        title: 'Enterprise',
        url: 'https://comfy.org/enterprise/',
        description: ''
      }
    ]

    const drift = findCanonicalDrift(
      links,
      () => 'https://evil.example.com/enterprise/'
    )

    expect(drift).toEqual([
      { link: links[0], canonical: 'https://evil.example.com/enterprise/' }
    ])
  })
})
