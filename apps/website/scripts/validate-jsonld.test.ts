import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { websiteRoot } from '@website/paths'

import { main, validateHtml } from './validate-jsonld'

const site = 'https://comfy.org'
const canonical = `${site}/example/`
const org = {
  '@type': 'Organization',
  '@id': `${site}/#organization`,
  name: 'Comfy Org'
}
const webPage = {
  '@type': 'WebPage',
  '@id': `${canonical}#webpage`,
  url: canonical,
  name: 'Example'
}

function html(nodes: object[], pageCanonical: string | null = canonical) {
  const graph = { '@context': 'https://schema.org', '@graph': nodes }
  const link = pageCanonical
    ? `<link rel="canonical" href="${pageCanonical}">`
    : ''
  return `${link}<script type="application/ld+json">${JSON.stringify(graph)}</script>`
}

function messages(nodes: object[], pagePath = '/example/'): string[] {
  return validateHtml(html([org, webPage, ...nodes]), pagePath).map(
    ({ message }) => message
  )
}

function rulesHit(nodes: object[], pagePath = '/example/'): string[] {
  return validateHtml(html([org, webPage, ...nodes]), pagePath).map(
    ({ rule }) => rule
  )
}

const offer = (price: unknown, priceCurrency: unknown = 'USD') => ({
  '@type': 'Offer',
  price,
  priceCurrency
})
const product = {
  '@type': 'Product',
  '@id': `${canonical}#product`,
  name: 'Comfy Cloud',
  image: `${site}/og.webp`,
  brand: { '@id': org['@id'] },
  offers: [offer('20')]
}
const video = {
  '@type': 'VideoObject',
  '@id': `${canonical}#video`,
  name: 'Tutorial',
  thumbnailUrl: `${site}/thumb.webp`,
  contentUrl: `${site}/tutorial.mp4`,
  uploadDate: '2026-07-16T00:00:00+00:00'
}
const crumbs = (items: unknown[]) => ({
  '@type': 'BreadcrumbList',
  '@id': `${canonical}#breadcrumb`,
  itemListElement: items
})
const home = {
  '@type': 'ListItem',
  position: 1,
  name: 'Home',
  item: `${site}/`
}
const page = { '@type': 'ListItem', position: 2, name: 'Page' }

describe('validateHtml', () => {
  it.for([
    { rule: 'honesty', bad: { '@type': 'AggregateRating', ratingValue: 5 } },
    { rule: 'honesty', bad: { ...product, review: [] } },
    { rule: 'offer', bad: offer('') },
    { rule: 'offer', bad: { '@type': 'Offer', price: '5' } },
    { rule: 'offer', bad: offer('-20') },
    { rule: 'offer', bad: offer(-20) },
    { rule: 'offer', bad: offer('Infinity') },
    { rule: 'offer', bad: offer('1e3') },
    { rule: 'offer', bad: offer('20', 0) },
    { rule: 'product', bad: { ...product, name: undefined } },
    { rule: 'product', bad: { ...product, name: ' ' } },
    { rule: 'product', bad: { ...product, image: undefined } },
    { rule: 'product', bad: { ...product, offers: [] } },
    { rule: 'product', bad: { ...product, brand: { name: 'Comfy' } } },
    { rule: 'video', bad: { ...video, name: undefined } },
    { rule: 'video', bad: { ...video, uploadDate: '2026-07-16' } },
    { rule: 'video', bad: { ...video, uploadDate: undefined } },
    { rule: 'video', bad: { ...video, thumbnailUrl: undefined } },
    {
      rule: 'event',
      bad: { '@type': 'Event', name: 'Meetup', startDate: '2026-10-07T10:00' }
    },
    { rule: 'event', bad: { '@type': 'Event', name: 'Meetup' } },
    { rule: 'imagesAreImages', bad: { ...product, image: `${site}/a.mp4` } },
    { rule: 'imagesAreImages', bad: { ...product, image: `${site}/a.MP4` } },
    {
      rule: 'imagesAreImages',
      bad: { ...product, image: `${site}/a.mp4#t=1` }
    },
    {
      rule: 'imagesAreImages',
      bad: { ...video, thumbnailUrl: `${site}/a.webm` }
    },
    {
      rule: 'imagesAreImages',
      bad: { '@type': 'ImageObject', url: `${site}/a.mp4` }
    },
    {
      rule: 'imagesAreImages',
      bad: { '@type': 'ImageObject', contentUrl: `${site}/a.mov?v=1` }
    },
    {
      rule: 'imagesAreImages',
      bad: { '@type': 'ImageObject', contentUrl: [`${site}/a.mp4`] }
    },
    { rule: 'breadcrumb', bad: crumbs([home, { ...page, position: 3 }]) },
    { rule: 'breadcrumb', bad: crumbs([{ ...home, item: '/' }, page]) },
    {
      rule: 'breadcrumb',
      bad: crumbs([{ ...home, item: { '@id': '/' } }, page])
    },
    { rule: 'breadcrumb', bad: crumbs([{ ...home, name: undefined }, page]) },
    { rule: 'breadcrumb', bad: crumbs([home, null, page]) },
    {
      rule: 'itemList',
      bad: {
        '@type': 'ItemList',
        numberOfItems: 2,
        itemListElement: [{ '@type': 'ListItem', position: 1, url: canonical }]
      }
    },
    { rule: 'idsOnSite', bad: { ...video, '@id': '/example/#video' } },
    {
      rule: 'idsOnSite',
      bad: { ...video, '@id': 'https://comfy.org.evil.com/#video' }
    },
    { rule: 'noPlaceholders', bad: { ...video, name: 'undefined' } },
    { rule: 'noPlaceholders', bad: { ...video, name: 'null' } },
    { rule: 'noPlaceholders', bad: { ...video, name: 'NaN' } },
    { rule: 'noPlaceholders', bad: { ...video, description: ' ' } },
    { rule: 'noPlaceholders', bad: { ...video, sameAs: ['undefined'] } },
    {
      rule: 'idRefs',
      bad: { ...video, isPartOf: { '@id': `${site}/#missing` } }
    },
    {
      rule: 'idRefs',
      bad: {
        ...video,
        isPartOf: { '@id': `${site}/#missing`, '@type': 'WebSite' }
      }
    },
    { rule: 'duplicateIds', bad: { ...webPage, name: 'Again' } }
  ])('flags $rule', ({ rule, bad }) => {
    expect(rulesHit([bad])).toContain(rule)
  })

  it('passes a complete graph', () => {
    expect(
      rulesHit([
        product,
        video,
        { '@type': 'Event', name: 'All day', startDate: '2026-10-06' },
        {
          '@type': 'Event',
          name: 'Talk',
          startDate: '2026-10-07T10:00:00-07:00'
        },
        {
          '@type': 'Event',
          name: 'Launch',
          startDate: '2026-10-07T17:00:00.000Z'
        },
        { '@type': 'ImageObject', url: `${site}/a.webp` },
        crumbs([home, page]),
        {
          '@type': 'ItemList',
          numberOfItems: 1,
          itemListElement: [
            { '@type': 'ListItem', position: 1, url: canonical }
          ]
        },
        {
          '@type': 'ItemList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, url: canonical }
          ]
        },
        {
          '@type': 'CollectionPage',
          '@id': `${site}/other/#collection`,
          url: `${site}/other/`
        },
        {
          '@type': 'WebSite',
          '@id': `${site}/#website`,
          publisher: { '@id': org['@id'], '@type': 'Organization' }
        }
      ])
    ).toEqual([])
  })

  it.for([
    { shape: 'a string item URL', list: [home, page] },
    {
      shape: 'a Thing item with an @id',
      list: [
        {
          '@type': 'ListItem',
          position: 1,
          item: { '@id': `${site}/`, name: 'Home' }
        },
        page
      ]
    },
    { shape: 'items out of array order', list: [page, home] }
  ])('accepts a breadcrumb with $shape', ({ list }) => {
    expect(rulesHit([crumbs(list)])).toEqual([])
  })

  it.for([
    { shape: 'a typed inline Brand', brand: { '@type': 'Brand', name: 'C' } },
    { shape: 'no brand', brand: undefined }
  ])('accepts a Product with $shape', ({ brand }) => {
    expect(rulesHit([{ ...product, brand }])).toEqual([])
  })

  it.for([
    { price: 1e21, rules: [] },
    { price: 1e-7, rules: [] },
    { price: Number.NaN, rules: ['offer'] }
  ])('checks a numeric price of $price', ({ price, rules }) => {
    expect(rulesHit([offer(price)])).toEqual(rules)
  })

  it('reads price and currency from priceSpecification', () => {
    expect(
      rulesHit([
        {
          '@type': 'Offer',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: 10,
            priceCurrency: 'USD'
          }
        }
      ])
    ).toEqual([])
  })

  it.for([
    { pagePath: '/download/', rules: [] },
    { pagePath: '/hub/models/local/flux-dev/', rules: [] },
    { pagePath: '/hub/models/luma-photon-flash/', rules: ['offer'] },
    { pagePath: '/models/luma-photon-flash/', rules: ['offer'] },
    { pagePath: '/zh-CN/hub/models/luma-photon-flash/', rules: ['offer'] },
    { pagePath: '/ja/models/luma-photon-flash/', rules: ['offer'] }
  ])('checks a zero-price Offer on $pagePath', ({ pagePath, rules }) => {
    expect(rulesHit([offer('0.00')], pagePath)).toEqual(rules)
  })

  it('names the node and shows values as JSON in each message', () => {
    expect(
      messages([
        crumbs([home, null, { ...page, position: '2' }]),
        { '@type': 'Offer', price: '5' }
      ])
    ).toEqual([
      `${canonical}#breadcrumb: BreadcrumbList entry 2 is not a ListItem`,
      `${canonical}#breadcrumb: BreadcrumbList item 2 has position "2"`,
      'Offer: Offer missing priceCurrency or a concrete price: price "5", priceCurrency undefined'
    ])
  })

  it('flags a page node whose @id or url drifts from the canonical', () => {
    const aboutPage = { ...webPage, '@type': 'AboutPage' }
    const violations = validateHtml(
      html([org, aboutPage], `${site}/other/`),
      '/'
    )
    expect(violations.map(({ rule }) => rule)).toEqual(['webPage', 'webPage'])
  })

  it('skips the WebPage check when the page has no canonical', () => {
    const drifted = { ...webPage, url: `${site}/other/` }
    expect(validateHtml(html([org, drifted], null), '/')).toEqual([])
  })

  it('reads the canonical whatever the attribute order', () => {
    const markup = html([org, webPage]).replace(
      `<link rel="canonical" href="${canonical}">`,
      `<link href="${site}/other/" rel="canonical">`
    )
    expect(validateHtml(markup, '/').map(({ rule }) => rule)).toEqual([
      'webPage',
      'webPage'
    ])
  })

  it('reports unparseable JSON-LD', () => {
    expect(
      validateHtml('<script type="application/ld+json">{</script>', '/')
    ).toMatchObject([{ rule: 'json' }])
  })
})

describe('main', () => {
  async function siteWith(pages: Record<string, string>): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'validate-jsonld-'))
    onTestFinished(() => rm(directory, { recursive: true, force: true }))
    for (const [route, content] of Object.entries(pages)) {
      await mkdir(join(directory, 'dist', route), { recursive: true })
      await writeFile(join(directory, 'dist', route, 'index.html'), content)
    }
    return directory
  }

  it.for<{ name: string; pages: Record<string, string>; status: number }>([
    { name: 'an empty dist', pages: {}, status: 1 },
    { name: 'a valid page', pages: { a: html([org, webPage]) }, status: 0 },
    {
      name: 'an invalid page',
      pages: { a: html([org, webPage, { ...video, name: 'null' }]) },
      status: 1
    }
  ])('returns $status for $name', async ({ pages, status }) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const directory = await siteWith(pages)
    expect(main(join(directory, 'dist'))).toBe(status)
  })

  it('returns 1 when dist does not exist', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const directory = await siteWith({})
    expect(main(join(directory, 'missing'))).toBe(1)
  })

  it('fails the CLI when there is no built HTML', async () => {
    const directory = await siteWith({})
    const loader = pathToFileURL(
      createRequire(import.meta.url).resolve('tsx')
    ).href
    const result = spawnSync(
      process.execPath,
      ['--import', loader, join(import.meta.dirname, 'validate-jsonld.ts')],
      {
        cwd: directory,
        env: {
          ...process.env,
          TSX_TSCONFIG_PATH: join(websiteRoot, 'tsconfig.json')
        },
        encoding: 'utf8'
      }
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('JSON-LD validation found no HTML')
  })
})
