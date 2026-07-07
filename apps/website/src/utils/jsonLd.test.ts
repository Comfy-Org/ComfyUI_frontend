import { describe, expect, it } from 'vitest'

import { externalLinks } from '../config/routes'
import { escapeJsonLd } from './escapeJsonLd'
import type { JsonLdNode } from './jsonLd'
import {
  buildGraph,
  organizationNode,
  siteUrlFrom,
  websiteNode
} from './jsonLd'

const siteUrl = 'https://comfy.org'

describe('siteUrlFrom', () => {
  it('strips the trailing slash Astro.site carries', () => {
    expect(siteUrlFrom(new URL('https://comfy.org/'))).toBe('https://comfy.org')
  })

  it('falls back to the production origin when the site is undefined', () => {
    expect(siteUrlFrom(undefined)).toBe('https://comfy.org')
  })
})

describe('buildGraph', () => {
  it('stamps the schema.org context and drops absent nodes', () => {
    const graph = buildGraph(organizationNode(siteUrl), null, undefined)
    expect(graph['@context']).toBe('https://schema.org')
    expect(graph['@graph'].map((node) => node['@type'])).toEqual([
      'Organization'
    ])
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
    const org = organizationNode(siteUrl)
    const website = websiteNode(siteUrl, 'zh-CN')
    expect(website.publisher).toEqual({ '@id': org['@id'] })
    expect(website.inLanguage).toBe('zh-CN')
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
