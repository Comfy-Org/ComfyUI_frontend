import { describe, expect, it } from 'vitest'

import { validateHtml } from './validate-jsonld'

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

function html(nodes: object[], pageCanonical = canonical): string {
  const graph = { '@context': 'https://schema.org', '@graph': nodes }
  return `<link rel="canonical" href="${pageCanonical}"><script type="application/ld+json">${JSON.stringify(graph)}</script>`
}

function rulesHit(nodes: object[], pagePath = '/example/'): string[] {
  return validateHtml(html([org, webPage, ...nodes]), pagePath).map(
    ({ rule }) => rule
  )
}

const offer = (price: unknown) => ({
  '@type': 'Offer',
  price,
  priceCurrency: 'USD'
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
  uploadDate: '2026-07-16T00:00:00+00:00'
}
const crumbs = (items: object[]) => ({
  '@type': 'BreadcrumbList',
  '@id': `${canonical}#breadcrumb`,
  itemListElement: items
})

describe('validateHtml', () => {
  it.for([
    { rule: 'honesty', bad: { '@type': 'AggregateRating', ratingValue: 5 } },
    { rule: 'honesty', bad: { ...product, review: [] } },
    { rule: 'offer', bad: offer('') },
    { rule: 'offer', bad: { '@type': 'Offer', price: '5' } },
    { rule: 'product', bad: { ...product, image: undefined } },
    { rule: 'product', bad: { ...product, brand: { name: 'Comfy' } } },
    { rule: 'video', bad: { ...video, uploadDate: '2026-07-16' } },
    { rule: 'video', bad: { ...video, uploadDate: undefined } },
    { rule: 'video', bad: { ...video, thumbnailUrl: undefined } },
    {
      rule: 'event',
      bad: { '@type': 'Event', name: 'Meetup', startDate: '2026-10-07T10:00' }
    },
    { rule: 'imagesAreImages', bad: { ...product, image: `${site}/a.mp4` } },
    {
      rule: 'imagesAreImages',
      bad: { ...video, thumbnailUrl: `${site}/a.webm` }
    },
    {
      rule: 'imagesAreImages',
      bad: { '@type': 'ImageObject', contentUrl: `${site}/a.mov?v=1` }
    },
    {
      rule: 'breadcrumb',
      bad: crumbs([
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
        { '@type': 'ListItem', position: 3, name: 'Page' }
      ])
    },
    {
      rule: 'breadcrumb',
      bad: crumbs([
        { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
        { '@type': 'ListItem', position: 2, name: 'Page' }
      ])
    },
    {
      rule: 'itemList',
      bad: {
        '@type': 'ItemList',
        numberOfItems: 2,
        itemListElement: [{ '@type': 'ListItem', position: 1, url: canonical }]
      }
    },
    { rule: 'idsOnSite', bad: { ...video, '@id': '/example/#video' } },
    { rule: 'noPlaceholders', bad: { ...video, name: 'undefined' } },
    { rule: 'noPlaceholders', bad: { ...video, description: ' ' } },
    {
      rule: 'idRefs',
      bad: { ...video, isPartOf: { '@id': `${site}/#missing` } }
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
        { '@type': 'ImageObject', url: `${site}/a.webp` },
        crumbs([
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
          { '@type': 'ListItem', position: 2, name: 'Page' }
        ]),
        {
          '@type': 'ItemList',
          numberOfItems: 1,
          itemListElement: [
            { '@type': 'ListItem', position: 1, url: canonical }
          ]
        }
      ])
    ).toEqual([])
  })

  it('accepts a typed Brand inline on a Product', () => {
    expect(
      rulesHit([{ ...product, brand: { '@type': 'Brand', name: 'Comfy' } }])
    ).toEqual([])
  })

  it('allows a free Offer outside model pages but not on them', () => {
    expect(rulesHit([offer(0)], '/download/')).toEqual([])
    expect(rulesHit([offer('0.00')], '/hub/models/luma-photon-flash/')).toEqual(
      ['offer']
    )
    expect(rulesHit([offer('0.01')], '/hub/models/luma-photon-flash/')).toEqual(
      []
    )
  })

  it('flags a WebPage whose @id or url drifts from the canonical', () => {
    const violations = validateHtml(html([org, webPage], `${site}/other/`), '/')
    expect(violations.map(({ rule }) => rule)).toEqual(['webPage', 'webPage'])
  })

  it('reports unparseable JSON-LD', () => {
    expect(
      validateHtml('<script type="application/ld+json">{</script>', '/')
    ).toMatchObject([{ rule: 'json' }])
  })
})
