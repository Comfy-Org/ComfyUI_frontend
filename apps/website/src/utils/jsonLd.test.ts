import { describe, expect, it } from 'vitest'

import { externalLinks } from '../config/routes'
import { escapeJsonLd } from './escapeJsonLd'
import type { JsonLdGraph } from './jsonLd'
import {
  absoluteUrl,
  buildPageGraph,
  collectGraphIds,
  comfyUiApplicationNode,
  comfyUiSoftwareId,
  comfyUiSourceCodeNode,
  itemListNode,
  jsonLdId,
  organizationId,
  pageContext,
  productNode,
  softwareApplicationNode
} from './jsonLd'

const siteUrl = 'https://comfy.org'
const site = new URL('https://comfy.org/')

function typeNames(graph: JsonLdGraph): string[] {
  return graph['@graph'].map((node) => node['@type'])
}

describe('absoluteUrl', () => {
  it('resolves internal paths to their trailing-slash canonical form', () => {
    expect(absoluteUrl(site, '/cloud')).toBe('https://comfy.org/cloud/')
    expect(absoluteUrl(site, '/about/')).toBe('https://comfy.org/about/')
    expect(absoluteUrl(site, '/')).toBe('https://comfy.org/')
  })
})

describe('pageContext', () => {
  it('derives siteUrl, locale and canonical url from the Astro globals', () => {
    expect(pageContext(site, '/about/', undefined)).toEqual({
      siteUrl,
      locale: 'en',
      url: 'https://comfy.org/about/'
    })
    expect(pageContext(site, '/zh-CN/', 'zh-CN').locale).toBe('zh-CN')
  })
})

describe('itemListNode', () => {
  it('counts items and omits per-item names when not supplied', () => {
    const node = itemListNode('https://comfy.org/careers/', 'Careers', [
      { url: 'https://jobs.example/1' },
      { url: 'https://jobs.example/2', name: 'Designer' }
    ])
    expect(node.numberOfItems).toBe(2)
    const items = node.itemListElement as Record<string, unknown>[]
    expect('name' in items[0]).toBe(false)
    expect(items[1].name).toBe('Designer')
  })
})

describe('softwareApplicationNode', () => {
  it('claims Comfy Org as author and publisher only when first-party', () => {
    const node = softwareApplicationNode({
      siteUrl,
      id: jsonLdId(siteUrl, 'software'),
      name: 'ComfyUI',
      url: siteUrl,
      firstParty: true,
      applicationCategory: 'MultimediaApplication',
      isFree: true
    })
    const orgRef = { '@id': organizationId(siteUrl) }
    expect(node.author).toEqual(orgRef)
    expect(node.publisher).toEqual(orgRef)
    expect(node.offers).toEqual({
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'USD',
      seller: orgRef
    })
  })

  it('does not name Comfy Org as seller on a third-party free offer', () => {
    const node = softwareApplicationNode({
      siteUrl,
      id: 'https://comfy.org/cloud/supported-nodes/foo/#software',
      name: 'Foo Pack',
      url: 'https://comfy.org/cloud/supported-nodes/foo/',
      applicationCategory: 'DeveloperApplication',
      isFree: true
    })
    expect((node.offers as Record<string, unknown>).seller).toBeUndefined()
  })

  it('credits a known third-party author without claiming to publish it', () => {
    const node = softwareApplicationNode({
      siteUrl,
      id: 'https://comfy.org/cloud/supported-nodes/foo/#software',
      name: 'Foo Pack',
      url: 'https://comfy.org/cloud/supported-nodes/foo/',
      applicationCategory: 'DeveloperApplication',
      authorName: 'Jane Dev'
    })
    expect(node.author).toEqual({ '@type': 'Person', name: 'Jane Dev' })
    expect(node.publisher).toBeUndefined()
  })

  it('claims no author or publisher for third-party software with no author', () => {
    const node = softwareApplicationNode({
      siteUrl,
      id: 'https://comfy.org/p/supported-models/foo/#software',
      name: 'Foo Model',
      url: 'https://comfy.org/p/supported-models/foo/',
      applicationCategory: 'MultimediaApplication'
    })
    expect(node.author).toBeUndefined()
    expect(node.publisher).toBeUndefined()
  })
})

describe('sameAs encyclopedic references', () => {
  it('links the organization to its Wikidata entity', () => {
    const graph = buildPageGraph(
      { siteUrl, locale: 'en' },
      { url: `${siteUrl}/`, name: 'Home' }
    )
    const org = graph['@graph'].find((node) => node['@type'] === 'Organization')
    expect(org?.sameAs).toContain(externalLinks.wikidataComfyOrg)
  })

  it('links the ComfyUI application to its Wikidata, Wikipedia and G2 entities', () => {
    const node = comfyUiApplicationNode(siteUrl)
    expect(node.sameAs).toEqual([
      externalLinks.wikidataComfyUi,
      externalLinks.wikipediaComfyUi,
      externalLinks.g2ComfyUi
    ])
  })

  it('omits sameAs for third-party software', () => {
    const node = softwareApplicationNode({
      siteUrl,
      id: 'https://comfy.org/p/supported-models/foo/#software',
      name: 'Foo Model',
      url: 'https://comfy.org/p/supported-models/foo/',
      applicationCategory: 'MultimediaApplication'
    })
    expect(node.sameAs).toBeUndefined()
  })
})

describe('productNode', () => {
  it('gives every offer a currency and price', () => {
    const node = productNode({
      siteUrl,
      id: 'https://comfy.org/cloud/pricing/#product',
      name: 'Comfy Cloud',
      url: 'https://comfy.org/cloud/pricing/',
      offers: [{ name: 'Standard', price: '20' }]
    })
    const offers = node.offers as Record<string, unknown>[]
    expect(offers[0].price).toBe('20')
    expect(offers[0].priceCurrency).toBe('USD')
    expect(offers[0].seller).toEqual({ '@id': organizationId(siteUrl) })
  })
})

describe('comfyUiSourceCodeNode', () => {
  it('links the source code to the ComfyUI application via targetProduct', () => {
    const node = comfyUiSourceCodeNode(siteUrl)
    expect(node.targetProduct).toEqual({ '@id': comfyUiSoftwareId(siteUrl) })
  })
})

describe('ComfyUI entity links', () => {
  it('names the home page as the canonical page for the application', () => {
    const node = comfyUiApplicationNode(siteUrl)
    expect(node.mainEntityOfPage).toBe(`${siteUrl}/`)
  })

  it('links the application back to the source code emitted alongside it', () => {
    const app = comfyUiApplicationNode(siteUrl)
    const source = comfyUiSourceCodeNode(siteUrl)
    expect(app.isBasedOn).toEqual({ '@id': source['@id'] })
  })

  it('claims no canonical page or source code for third-party software', () => {
    const node = softwareApplicationNode({
      siteUrl,
      id: 'https://comfy.org/p/supported-models/foo/#software',
      name: 'Foo Model',
      url: 'https://comfy.org/p/supported-models/foo/',
      applicationCategory: 'MultimediaApplication'
    })
    expect(node.mainEntityOfPage).toBeUndefined()
    expect(node.isBasedOn).toBeUndefined()
  })
})

describe('buildPageGraph', () => {
  const url = 'https://comfy.org/cloud/pricing/'
  const graph = buildPageGraph(
    { siteUrl, locale: 'en' },
    {
      url,
      name: 'Pricing',
      type: 'CollectionPage',
      mainEntityId: jsonLdId(url, 'itemlist'),
      crumbs: [{ name: 'Home', url: `${siteUrl}/` }, { name: 'Pricing' }]
    },
    itemListNode(url, 'Plans', [{ url: `${siteUrl}/one/` }])
  )

  it('always includes the site-wide organization, website and page entity', () => {
    expect(typeNames(graph)).toContain('Organization')
    expect(typeNames(graph)).toContain('WebSite')
    expect(typeNames(graph)).toContain('CollectionPage')
  })

  it('produces a graph where every @id reference resolves', () => {
    const { defined, references } = collectGraphIds(graph)
    for (const reference of references) {
      expect(defined.has(reference)).toBe(true)
    }
  })
})

describe('escapeJsonLd on a built graph', () => {
  it('neutralizes a </script> breakout in a page name', () => {
    const graph = buildPageGraph(
      { siteUrl, locale: 'en' },
      { url: `${siteUrl}/x/`, name: '</script><script>alert(1)</script>' }
    )
    const serialized = escapeJsonLd(graph)
    expect(serialized).not.toContain('</script>')
    expect(serialized).toContain('\\u003c')
  })
})
