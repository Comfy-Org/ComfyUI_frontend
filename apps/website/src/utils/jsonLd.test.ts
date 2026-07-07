import { describe, expect, it } from 'vitest'

import { externalLinks } from '../config/routes'
import { escapeJsonLd } from './escapeJsonLd'
import type { JsonLdGraph, JsonLdNode } from './jsonLd'
import {
  absoluteUrl,
  buildGraph,
  buildPageGraph,
  breadcrumbNode,
  itemListNode,
  organizationNode,
  pageContext,
  productNode,
  siteUrlFrom,
  softwareApplicationNode,
  webPageNode,
  websiteNode
} from './jsonLd'

const siteUrl = 'https://comfy.org'

function nodeOfType(graph: JsonLdGraph, type: string): JsonLdNode | undefined {
  return graph['@graph'].find((node) => node['@type'] === type)
}

// Mirrors the CI validator: collect defined @ids vs bare {@id} references so a
// broken cross-link in a composed graph fails the test.
function resolveIds(graph: JsonLdGraph): {
  defined: Set<string>
  references: string[]
} {
  const defined = new Set<string>()
  const references: string[] = []
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk)
      return
    }
    if (value && typeof value === 'object') {
      const node = value as Record<string, unknown>
      const id = node['@id']
      if (typeof id === 'string') {
        if (Object.keys(node).length === 1) references.push(id)
        else defined.add(id)
      }
      Object.values(node).forEach(walk)
    }
  }
  walk(graph)
  return { defined, references }
}

describe('siteUrlFrom', () => {
  it('strips the trailing slash Astro.site carries', () => {
    expect(siteUrlFrom(new URL('https://comfy.org/'))).toBe('https://comfy.org')
  })

  it('falls back to the production origin when the site is undefined', () => {
    expect(siteUrlFrom(undefined)).toBe('https://comfy.org')
  })
})

describe('absoluteUrl', () => {
  it('resolves a route path against the site origin', () => {
    expect(absoluteUrl(new URL('https://comfy.org/'), '/cloud/pricing')).toBe(
      'https://comfy.org/cloud/pricing'
    )
  })
})

describe('pageContext', () => {
  it('normalizes an unknown locale to English', () => {
    const ctx = pageContext(new URL('https://comfy.org/'), '/about', undefined)
    expect(ctx.locale).toBe('en')
    expect(ctx.url).toBe('https://comfy.org/about')
  })

  it('preserves the Chinese locale', () => {
    const ctx = pageContext(new URL('https://comfy.org/'), '/zh-CN', 'zh-CN')
    expect(ctx.locale).toBe('zh-CN')
  })
})

describe('organizationNode', () => {
  const org = organizationNode(siteUrl)

  it('points the logo at a raster image, not an SVG', () => {
    const logo = org.logo as { url: string }
    expect(logo.url).toMatch(/\.png$/)
  })

  it('single-sources sameAs from the footer links and drops the stale handles', () => {
    const links = org.sameAs as string[]
    expect(links).toContain(externalLinks.github)
    expect(links).toContain(externalLinks.linkedin)
    expect(links).not.toContain('https://x.com/comaboratory')
    expect(links).not.toContain('https://github.com/comfyanonymous/ComfyUI')
  })

  it('never asserts a rating it does not have', () => {
    expect('aggregateRating' in org).toBe(false)
    expect('review' in org).toBe(false)
  })
})

describe('websiteNode', () => {
  it('connects to the organization by @id and carries the page locale', () => {
    const website = websiteNode(siteUrl, 'zh-CN')
    expect(website.publisher).toEqual({
      '@id': organizationNode(siteUrl)['@id']
    })
    expect(website.inLanguage).toBe('zh-CN')
  })
})

describe('breadcrumbNode', () => {
  const node = breadcrumbNode('https://comfy.org/cloud/pricing', [
    { name: 'Home', url: 'https://comfy.org/' },
    { name: 'Pricing' }
  ])
  const items = node.itemListElement as Record<string, unknown>[]

  it('links every crumb except the last, which is the current page', () => {
    expect(items[0].item).toBe('https://comfy.org/')
    expect('item' in items[1]).toBe(false)
    expect(items.map((item) => item.position)).toEqual([1, 2])
  })
})

describe('itemListNode', () => {
  it('numbers items from one and anchors its @id to the page', () => {
    const node = itemListNode('https://comfy.org/careers', [
      { name: 'Engineer', url: 'https://jobs.example/1' },
      { name: 'Designer', url: 'https://jobs.example/2' }
    ])
    expect(node['@id']).toBe('https://comfy.org/careers#itemlist')
    const items = node.itemListElement as Record<string, unknown>[]
    expect(items.map((item) => item.position)).toEqual([1, 2])
  })
})

describe('webPageNode', () => {
  it('omits the breadcrumb reference when there are no crumbs', () => {
    const node = webPageNode({
      siteUrl,
      locale: 'en',
      url: 'https://comfy.org/about',
      name: 'About'
    })
    expect(node.breadcrumb).toBeUndefined()
    expect(node.isPartOf).toEqual({ '@id': websiteNode(siteUrl, 'en')['@id'] })
  })

  it('applies the requested subtype', () => {
    const node = webPageNode(
      { siteUrl, locale: 'en', url: 'https://comfy.org/about', name: 'About' },
      'AboutPage'
    )
    expect(node['@type']).toBe('AboutPage')
  })
})

describe('softwareApplicationNode', () => {
  it('claims Comfy Org as author and publisher only when marked first-party', () => {
    const node = softwareApplicationNode({
      siteUrl,
      id: `${siteUrl}/#software`,
      name: 'ComfyUI',
      url: siteUrl,
      firstParty: true,
      applicationCategory: 'MultimediaApplication',
      isFree: true
    })
    const orgId = organizationNode(siteUrl)['@id']
    expect(node.author).toEqual({ '@id': orgId })
    expect(node.publisher).toEqual({ '@id': orgId })
    expect(node.offers).toEqual({
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'USD'
    })
  })

  it('credits a known third-party author without claiming to publish it', () => {
    const node = softwareApplicationNode({
      siteUrl,
      id: `${siteUrl}/cloud/supported-nodes/foo#software`,
      name: 'Foo Pack',
      url: `${siteUrl}/cloud/supported-nodes/foo`,
      applicationCategory: 'DeveloperApplication',
      authorName: 'Jane Dev'
    })
    expect(node.author).toEqual({ '@type': 'Person', name: 'Jane Dev' })
    expect(node.publisher).toBeUndefined()
  })

  it('claims no author or publisher for third-party software with no known author', () => {
    const node = softwareApplicationNode({
      siteUrl,
      id: `${siteUrl}/p/supported-models/foo#software`,
      name: 'Foo Model',
      url: `${siteUrl}/p/supported-models/foo`,
      applicationCategory: 'MultimediaApplication'
    })
    expect(node.author).toBeUndefined()
    expect(node.publisher).toBeUndefined()
  })
})

describe('productNode', () => {
  it('emits an honest priced offer per tier', () => {
    const node = productNode({
      siteUrl,
      id: `${siteUrl}/cloud/pricing#product`,
      name: 'Comfy Cloud',
      url: `${siteUrl}/cloud/pricing`,
      offers: [{ name: 'Standard', price: '20' }]
    })
    const offers = node.offers as Record<string, unknown>[]
    expect(offers[0].price).toBe('20')
    expect(offers[0].priceCurrency).toBe('USD')
  })
})

describe('buildPageGraph', () => {
  const graph = buildPageGraph(
    { siteUrl, locale: 'en' },
    {
      url: 'https://comfy.org/cloud/pricing',
      name: 'Pricing',
      type: 'CollectionPage',
      mainEntityId: 'https://comfy.org/cloud/pricing#itemlist',
      crumbs: [{ name: 'Home', url: 'https://comfy.org/' }, { name: 'Pricing' }]
    },
    itemListNode('https://comfy.org/cloud/pricing', [
      { name: 'One', url: 'https://comfy.org/one' }
    ])
  )

  it('prepends the site-wide organization and website', () => {
    expect(nodeOfType(graph, 'Organization')).toBeDefined()
    expect(nodeOfType(graph, 'WebSite')).toBeDefined()
    expect(nodeOfType(graph, 'CollectionPage')).toBeDefined()
  })

  it('produces a fully connected graph where every @id reference resolves', () => {
    const { defined, references } = resolveIds(graph)
    for (const reference of references) {
      expect(defined.has(reference)).toBe(true)
    }
  })
})

describe('escaping', () => {
  it('neutralizes a </script> breakout in a graph value', () => {
    const hostile: JsonLdNode = {
      '@type': 'Thing',
      name: '</script><script>alert(1)</script>'
    }
    const serialized = escapeJsonLd(buildGraph(hostile))
    expect(serialized).not.toContain('</script>')
    expect(serialized).toContain('\\u003c')
  })
})
