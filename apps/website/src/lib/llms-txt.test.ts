import { describe, expect, it } from 'vitest'

import {
  findCanonicalDrift,
  findRedirectedLinks,
  findStaleLinks,
  internalLinks,
  isWorkflowsAppPath,
  normalizePath,
  parseLlmsTxtLinks,
  redirectSourcePattern
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

    expect(findRedirectedLinks(links, ['/cloud/enterprise'])).toEqual(links)
  })

  it('leaves a link that is not a redirect source alone', () => {
    const links = [
      {
        title: 'Enterprise',
        url: 'https://comfy.org/enterprise/',
        description: ''
      }
    ]

    expect(findRedirectedLinks(links, ['/cloud/enterprise'])).toEqual([])
  })

  it('ignores external links even if their path matches a redirect source', () => {
    const links = [
      { title: 'Docs', url: 'https://docs.comfy.org/pricing', description: '' }
    ]

    expect(findRedirectedLinks(links, ['/pricing'])).toEqual([])
  })
})

describe('redirectSourcePattern', () => {
  it.for([
    ['/cloud/enterprise', '/cloud/enterprise', true],
    ['/cloud/enterprise/', '/cloud/enterprise', true],
    ['/cloud/enterprise', '/cloud/enterprise-plans', false],
    ['/p/supported-models/:slug', '/p/supported-models/flux1-dev-fp8', true],
    ['/p/supported-models/:slug', '/p/supported-models', false],
    ['/p/supported-models/:slug', '/p/supported-models/a/b', false],
    ['/models/:path*', '/models', true],
    ['/models/:path*', '/models/a/b.md', true],
    ['/models/:path*', '/models-v2', false],
    ['/models/:path+', '/models', false],
    ['/models/:path+', '/models/a/b', true],
    ['/hub/models.md', '/hub/modelsxmd', false]
  ] as const)('%s matches %s: %s', ([source, path, matches]) => {
    expect(redirectSourcePattern(source).test(path)).toBe(matches)
  })
})

describe('isWorkflowsAppPath', () => {
  it.for([
    ['/workflows', true],
    ['/workflows/use-cases/image-to-3d', true],
    ['/ja/workflows', true],
    ['/hub/workflows/flux', false],
    ['/workflows/unknown/shape', false]
  ] as const)('%s: %s', ([path, expected]) => {
    expect(isWorkflowsAppPath(path)).toBe(expected)
  })
})

describe('findStaleLinks', () => {
  const sectionFile = (url: string) =>
    [
      '# Supported models in ComfyUI',
      '',
      '## Models',
      '',
      `- [FLUX.1 Dev](${url}): Open model`,
      '- [Docs](https://docs.comfy.org/p/supported-models/gone): External'
    ].join('\n')
  const builtPages = new Set([
    '/p/supported-models/flux-1-dev',
    '/p/supported-models/flux-1-dev.md'
  ])
  const checks = {
    redirectSources: ['/models/:path*', '/cloud/enterprise'],
    isServed: (path: string) => builtPages.has(path),
    canonicalFor: () => undefined
  }

  it('fails a link that matches a pattern redirect source', () => {
    expect(
      findStaleLinks(
        sectionFile('https://comfy.org/models/flux-1-dev.md'),
        checks
      )
    ).toEqual([
      '[FLUX.1 Dev](https://comfy.org/models/flux-1-dev.md) is a redirect source'
    ])
  })

  it('fails a link that matches a literal redirect source', () => {
    expect(
      findStaleLinks(sectionFile('https://comfy.org/cloud/enterprise/'), checks)
    ).toEqual([
      '[FLUX.1 Dev](https://comfy.org/cloud/enterprise/) is a redirect source'
    ])
  })

  it('fails a link the build did not produce', () => {
    expect(
      findStaleLinks(
        sectionFile('https://comfy.org/p/supported-models/removed.md'),
        { ...checks, redirectSources: [] }
      )
    ).toEqual([
      '[FLUX.1 Dev](https://comfy.org/p/supported-models/removed.md) is not in the build'
    ])
  })

  it('fails a built page that canonicalizes elsewhere', () => {
    expect(
      findStaleLinks(
        sectionFile('https://comfy.org/p/supported-models/flux-1-dev/'),
        {
          ...checks,
          canonicalFor: () => 'https://comfy.org/hub/models/flux-1-dev/'
        }
      )
    ).toEqual([
      '[FLUX.1 Dev](https://comfy.org/p/supported-models/flux-1-dev/) now canonicalizes to https://comfy.org/hub/models/flux-1-dev/'
    ])
  })

  it('passes once the link points at the live page', () => {
    expect(
      findStaleLinks(
        sectionFile('https://comfy.org/p/supported-models/flux-1-dev.md'),
        checks
      )
    ).toEqual([])
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
