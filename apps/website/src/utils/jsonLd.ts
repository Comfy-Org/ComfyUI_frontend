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

export interface PageContext {
  siteUrl: string
  locale: Locale
}

export type WebPageType =
  | 'WebPage'
  | 'AboutPage'
  | 'ContactPage'
  | 'CollectionPage'

export interface Crumb {
  name: string
  url?: string
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

// Resolves a route path against the site origin so every page derives its
// canonical URL and `@id`s from the same source.
export function absoluteUrl(site: URL | undefined, path: string): string {
  return new URL(path, site ?? 'https://comfy.org').href
}

// Adapts the Astro globals a page has on hand into the context the builders
// need, so every page derives siteUrl, locale and canonical URL identically.
export function pageContext(
  site: URL | undefined,
  pathname: string,
  currentLocale: string | undefined
): PageContext & { url: string } {
  return {
    siteUrl: siteUrlFrom(site),
    locale: currentLocale === 'zh-CN' ? 'zh-CN' : 'en',
    url: absoluteUrl(site, pathname)
  }
}

export function organizationId(siteUrl: string): string {
  return `${siteUrl}/#organization`
}

function websiteId(siteUrl: string): string {
  return `${siteUrl}/#website`
}

function breadcrumbId(pageUrl: string): string {
  return `${pageUrl}#breadcrumb`
}

function webPageId(pageUrl: string): string {
  return `${pageUrl}#webpage`
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

export function breadcrumbNode(pageUrl: string, crumbs: Crumb[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId(pageUrl),
    itemListElement: crumbs.map((crumb, index) => {
      // Google reads the current page URL for the final crumb, so its `item`
      // is intentionally omitted.
      const isLast = index === crumbs.length - 1
      return isLast || !crumb.url
        ? { '@type': 'ListItem', position: index + 1, name: crumb.name }
        : {
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.name,
            item: crumb.url
          }
    })
  }
}

export function itemListNode(
  pageUrl: string,
  items: { url: string; name: string }[]
): JsonLdNode {
  return {
    '@type': 'ItemList',
    '@id': `${pageUrl}#itemlist`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: item.url,
      name: item.name
    }))
  }
}

export interface WebPageInput {
  siteUrl: string
  locale: Locale
  url: string
  name: string
  description?: string
  imageUrl?: string
  crumbs?: Crumb[]
  mainEntityId?: string
}

export function webPageNode(
  input: WebPageInput,
  type: WebPageType = 'WebPage'
): JsonLdNode {
  const hasCrumbs = Boolean(input.crumbs && input.crumbs.length > 0)
  return {
    '@type': type,
    '@id': webPageId(input.url),
    url: input.url,
    name: input.name,
    description: input.description,
    isPartOf: { '@id': websiteId(input.siteUrl) },
    primaryImageOfPage: input.imageUrl
      ? { '@type': 'ImageObject', url: input.imageUrl }
      : undefined,
    breadcrumb: hasCrumbs ? { '@id': breadcrumbId(input.url) } : undefined,
    mainEntity: input.mainEntityId ? { '@id': input.mainEntityId } : undefined,
    inLanguage: input.locale
  }
}

export interface SoftwareAppInput {
  siteUrl: string
  id: string
  name: string
  url: string
  applicationCategory: string
  // Set only for Comfy Org's own software (ComfyUI). Third-party packs and
  // listed models must not claim Comfy Org as author or publisher.
  firstParty?: boolean
  applicationSubCategory?: string
  description?: string
  operatingSystem?: string
  image?: string
  softwareVersion?: string
  license?: string
  codeRepository?: string
  authorName?: string
  isFree?: boolean
}

export function softwareApplicationNode(input: SoftwareAppInput): JsonLdNode {
  const orgRef = { '@id': organizationId(input.siteUrl) }
  const author = input.firstParty
    ? orgRef
    : input.authorName
      ? { '@type': 'Person', name: input.authorName }
      : undefined
  return {
    '@type': 'SoftwareApplication',
    '@id': input.id,
    name: input.name,
    url: input.url,
    applicationCategory: input.applicationCategory,
    applicationSubCategory: input.applicationSubCategory,
    description: input.description,
    operatingSystem: input.operatingSystem,
    image: input.image,
    softwareVersion: input.softwareVersion,
    license: input.license,
    codeRepository: input.codeRepository,
    author,
    publisher: input.firstParty ? orgRef : undefined,
    // Free/open-source is a true offer, unlike a fabricated price.
    offers: input.isFree
      ? { '@type': 'Offer', price: 0, priceCurrency: 'USD' }
      : undefined
  }
}

export interface SourceCodeInput {
  siteUrl: string
  id: string
  name: string
  codeRepository: string
  programmingLanguage?: string
  runtimePlatform?: string
}

export function softwareSourceCodeNode(input: SourceCodeInput): JsonLdNode {
  return {
    '@type': 'SoftwareSourceCode',
    '@id': input.id,
    name: input.name,
    codeRepository: input.codeRepository,
    programmingLanguage: input.programmingLanguage,
    runtimePlatform: input.runtimePlatform,
    author: { '@id': organizationId(input.siteUrl) }
  }
}

interface OfferInput {
  name: string
  price: string | number
  url?: string
}

export interface ProductInput {
  siteUrl: string
  id: string
  name: string
  url: string
  description?: string
  offers: OfferInput[]
}

export function productNode(input: ProductInput): JsonLdNode {
  return {
    '@type': 'Product',
    '@id': input.id,
    name: input.name,
    url: input.url,
    description: input.description,
    brand: { '@id': organizationId(input.siteUrl) },
    offers: input.offers.map((offer) => ({
      '@type': 'Offer',
      name: offer.name,
      price: offer.price,
      priceCurrency: 'USD',
      url: offer.url,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: offer.price,
        priceCurrency: 'USD',
        unitText: 'MONTH'
      }
    }))
  }
}

// The DRY entry point every page uses: prepends the site-wide Organization and
// WebSite, adds the page's primary WebPage entity plus an optional breadcrumb,
// then layers on any page-specific nodes (Article, Product, VideoObject, ...).
export function buildPageGraph(
  ctx: PageContext,
  page: Omit<WebPageInput, 'siteUrl' | 'locale'> & { type?: WebPageType },
  ...extraNodes: (JsonLdNode | null | undefined)[]
): JsonLdGraph {
  const { type = 'WebPage', ...rest } = page
  const input: WebPageInput = {
    ...rest,
    siteUrl: ctx.siteUrl,
    locale: ctx.locale
  }
  const hasCrumbs = Boolean(page.crumbs && page.crumbs.length > 0)
  return buildGraph(
    organizationNode(ctx.siteUrl),
    websiteNode(ctx.siteUrl, ctx.locale),
    webPageNode(input, type),
    hasCrumbs ? breadcrumbNode(page.url, page.crumbs!) : undefined,
    ...extraNodes
  )
}
