import { describe, expect, it } from 'vitest'

import type {
  JsonLdGraph,
  JsonLdContext,
  StorySummary
} from './customerStoryJsonLd'
import {
  buildCustomersCollectionJsonLd,
  buildStoryJsonLd
} from './customerStoryJsonLd'
import { escapeJsonLd } from './escapeJsonLd'

const enContext: JsonLdContext = {
  siteUrl: 'https://comfy.org',
  locale: 'en',
  homeLabel: 'Home',
  collectionLabel: 'Customer Stories'
}

const story = {
  slug: 'series-entertainment',
  title:
    'How Series Entertainment Rebuilt Game and Video Production with ComfyUI',
  description: 'Scaling emotional storytelling across 100,000+ assets.',
  cover:
    'https://media.comfy.org/website/customers/series-entertainment/cover.webp'
}

const summaries: StorySummary[] = [
  {
    slug: 'series-entertainment',
    title: 'Series Entertainment',
    cover: 'https://media.comfy.org/a.webp'
  },
  {
    slug: 'moment-factory',
    title: 'Moment Factory',
    cover: 'https://media.comfy.org/b.webp'
  },
  {
    slug: 'ubisoft-chord',
    title: 'Ubisoft CHORD',
    cover: 'https://media.comfy.org/c.webp'
  }
]

function nodeOfType(graph: JsonLdGraph, type: string) {
  return graph['@graph'].find((node) => node['@type'] === type)
}

describe('buildStoryJsonLd', () => {
  const graph = buildStoryJsonLd(story, enContext)

  it('emits the five connected node types', () => {
    const types = graph['@graph'].map((node) => node['@type'])
    expect(types).toEqual([
      'Organization',
      'WebSite',
      'WebPage',
      'BreadcrumbList',
      'Article'
    ])
  })

  it('links the Article to the page, organization, and image it describes', () => {
    const article = nodeOfType(graph, 'Article')!
    const pageUrl = 'https://comfy.org/customers/series-entertainment'
    expect(article['@id']).toBe(`${pageUrl}#article`)
    expect(article.headline).toBe(story.title)
    expect(article.image).toBe(story.cover)
    expect(article.mainEntityOfPage).toEqual({ '@id': `${pageUrl}#webpage` })
    expect(article.author).toEqual({ '@id': 'https://comfy.org/#organization' })
    expect(article.publisher).toEqual({
      '@id': 'https://comfy.org/#organization'
    })
  })

  it('uses a raster logo the Organization references by id', () => {
    const org = nodeOfType(graph, 'Organization')!
    expect(org['@id']).toBe('https://comfy.org/#organization')
    expect(org.logo).toMatchObject({
      '@type': 'ImageObject',
      url: 'https://comfy.org/web-app-manifest-512x512.png'
    })
  })

  it('builds a three-step breadcrumb with the final crumb url omitted', () => {
    const breadcrumb = nodeOfType(graph, 'BreadcrumbList')!
    const items = breadcrumb.itemListElement as Record<string, unknown>[]
    expect(items.map((item) => item.position)).toEqual([1, 2, 3])
    expect(items[0].item).toBe('https://comfy.org')
    expect(items[1].item).toBe('https://comfy.org/customers')
    expect(items[2].item).toBeUndefined()
    expect(items[2].name).toBe(story.title)
  })

  it('localizes language and url prefix for zh-CN', () => {
    const zh = buildStoryJsonLd(story, {
      ...enContext,
      locale: 'zh-CN',
      homeLabel: '首页',
      collectionLabel: '客户故事'
    })
    const article = nodeOfType(zh, 'Article')!
    expect(article.inLanguage).toBe('zh-CN')
    expect(article['@id']).toBe(
      'https://comfy.org/zh-CN/customers/series-entertainment#article'
    )
    const breadcrumb = nodeOfType(zh, 'BreadcrumbList')!
    const items = breadcrumb.itemListElement as Record<string, unknown>[]
    expect(items[0].item).toBe('https://comfy.org/zh-CN')
    expect(items[1].item).toBe('https://comfy.org/zh-CN/customers')
  })

  it('serializes safely and round-trips through JSON.parse', () => {
    expect(JSON.parse(escapeJsonLd(graph))).toEqual(graph)
  })
})

describe('buildCustomersCollectionJsonLd', () => {
  const graph = buildCustomersCollectionJsonLd(summaries, enContext)

  it('emits a CollectionPage backed by an ItemList', () => {
    const types = graph['@graph'].map((node) => node['@type'])
    expect(types).toEqual([
      'Organization',
      'WebSite',
      'CollectionPage',
      'BreadcrumbList',
      'ItemList'
    ])
    const page = nodeOfType(graph, 'CollectionPage')!
    expect(page.mainEntity).toEqual({
      '@id': 'https://comfy.org/customers#itemlist'
    })
  })

  it('lists every story with consecutive positions and absolute detail urls', () => {
    const list = nodeOfType(graph, 'ItemList')!
    const items = list.itemListElement as Record<string, unknown>[]
    expect(items).toHaveLength(summaries.length)
    expect(items.map((item) => item.position)).toEqual([1, 2, 3])
    expect(items[0].url).toBe(
      'https://comfy.org/customers/series-entertainment'
    )
    expect(items[2].url).toBe('https://comfy.org/customers/ubisoft-chord')
  })

  it('prefixes detail urls with the locale for zh-CN', () => {
    const zh = buildCustomersCollectionJsonLd(summaries, {
      ...enContext,
      locale: 'zh-CN'
    })
    const list = nodeOfType(zh, 'ItemList')!
    const items = list.itemListElement as Record<string, unknown>[]
    expect(items[0].url).toBe(
      'https://comfy.org/zh-CN/customers/series-entertainment'
    )
  })
})
