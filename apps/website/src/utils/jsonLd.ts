import { externalLinks } from '../config/routes'
import type { Locale } from '../i18n/translations'

// Shared schema.org JSON-LD builders for the whole site. Pure data transforms
// (no `astro:content` or Astro globals) so they are node-testable and stay
// reusable when content moves from TS data files to a CMS.

export type JsonLdNode = Record<string, unknown> & { '@type': string }

export interface JsonLdGraph {
  '@context': 'https://schema.org'
  '@graph': JsonLdNode[]
}

// Owner-controlled social profiles, single-sourced from the footer links so
// `sameAs` can never drift from the real accounts.
const sameAs = [
  externalLinks.github,
  externalLinks.x,
  externalLinks.youtube,
  externalLinks.discord,
  externalLinks.instagram,
  externalLinks.reddit,
  externalLinks.linkedin
]

// Normalizes Astro.site (a trailing-slash URL, or undefined) to a bare origin
// the `@id`/URL builders can append paths to.
export function siteUrlFrom(site: URL | undefined): string {
  return (site?.href ?? 'https://comfy.org/').replace(/\/$/, '')
}

function organizationId(siteUrl: string): string {
  return `${siteUrl}/#organization`
}

function websiteId(siteUrl: string): string {
  return `${siteUrl}/#website`
}

export function buildGraph(
  ...nodes: (JsonLdNode | null | undefined)[]
): JsonLdGraph {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter((node): node is JsonLdNode => Boolean(node))
  }
}

export function organizationNode(siteUrl: string): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': organizationId(siteUrl),
    name: 'Comfy Org',
    url: siteUrl,
    // Google Images does not index SVG for the logo property, so point at the
    // raster app-manifest icon.
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/web-app-manifest-512x512.png`,
      width: 512,
      height: 512
    },
    sameAs
  }
}

export function websiteNode(siteUrl: string, locale: Locale): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': websiteId(siteUrl),
    name: 'Comfy',
    url: siteUrl,
    publisher: { '@id': organizationId(siteUrl) },
    inLanguage: locale
  }
}
