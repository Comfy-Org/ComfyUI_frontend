import { externalLinks } from '../config/routes'
import type { Locale } from '../i18n/translations'

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

const sameAs = [
  externalLinks.github,
  externalLinks.x,
  externalLinks.youtube,
  externalLinks.discord,
  externalLinks.instagram,
  externalLinks.reddit,
  externalLinks.linkedin,
  externalLinks.wikidataComfyOrg
]

const comfyUiSameAs = [
  externalLinks.wikidataComfyUi,
  externalLinks.wikipediaComfyUi,
  externalLinks.g2ComfyUi
]

function siteUrlFrom(site: URL | undefined): string {
  return (site?.href ?? 'https://comfy.org/').replace(/\/$/, '')
}

export function absoluteUrl(site: URL | undefined, path: string): string {
  const resolved = new URL(path, site ?? 'https://comfy.org').href
  return resolved.endsWith('/') ? resolved : `${resolved}/`
}

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

export function jsonLdId(pageUrl: string, fragment: string): string {
  return `${pageUrl}#${fragment}`
}

export function organizationId(siteUrl: string): string {
  return `${siteUrl}/#organization`
}

function websiteId(siteUrl: string): string {
  return `${siteUrl}/#website`
}

function buildGraph(...nodes: (JsonLdNode | null | undefined)[]): JsonLdGraph {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter((node): node is JsonLdNode => Boolean(node))
  }
}

function organizationNode(siteUrl: string): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': organizationId(siteUrl),
    name: 'Comfy Org',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/web-app-manifest-512x512.png`,
      width: 512,
      height: 512
    },
    sameAs
  }
}

function websiteNode(siteUrl: string): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': websiteId(siteUrl),
    name: 'Comfy',
    url: siteUrl,
    publisher: { '@id': organizationId(siteUrl) }
  }
}

function breadcrumbNode(pageUrl: string, crumbs: Crumb[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': jsonLdId(pageUrl, 'breadcrumb'),
    itemListElement: crumbs.map((crumb, index) => {
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
  name: string,
  items: { url: string; name?: string }[]
): JsonLdNode {
  return {
    '@type': 'ItemList',
    '@id': jsonLdId(pageUrl, 'itemlist'),
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: item.url,
      ...(item.name ? { name: item.name } : {})
    }))
  }
}

interface ArticleInput {
  siteUrl: string
  pageUrl: string
  title: string
  description?: string
  imageUrl?: string
  locale: Locale
}

export function articleNode(input: ArticleInput): JsonLdNode {
  const webPageRef = { '@id': jsonLdId(input.pageUrl, 'webpage') }
  const orgRef = { '@id': organizationId(input.siteUrl) }
  return {
    '@type': 'Article',
    '@id': jsonLdId(input.pageUrl, 'article'),
    headline: input.title,
    name: input.title,
    description: input.description,
    image: input.imageUrl,
    inLanguage: input.locale,
    isPartOf: webPageRef,
    mainEntityOfPage: webPageRef,
    author: orgRef,
    publisher: orgRef
  }
}

interface WebPageInput {
  siteUrl: string
  locale: Locale
  url: string
  name: string
  description?: string
  imageUrl?: string
  crumbs?: Crumb[]
  mainEntityId?: string
}

function webPageNode(input: WebPageInput, type: WebPageType): JsonLdNode {
  const hasCrumbs = Boolean(input.crumbs && input.crumbs.length > 0)
  return {
    '@type': type,
    '@id': jsonLdId(input.url, 'webpage'),
    url: input.url,
    name: input.name,
    description: input.description,
    isPartOf: { '@id': websiteId(input.siteUrl) },
    primaryImageOfPage: input.imageUrl
      ? { '@type': 'ImageObject', url: input.imageUrl }
      : undefined,
    breadcrumb: hasCrumbs
      ? { '@id': jsonLdId(input.url, 'breadcrumb') }
      : undefined,
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
  sameAs?: string[]
  mainEntityOfPage?: string
  isBasedOnId?: string
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
    sameAs: input.sameAs,
    mainEntityOfPage: input.mainEntityOfPage,
    isBasedOn: input.isBasedOnId ? { '@id': input.isBasedOnId } : undefined,
    offers: input.isFree
      ? {
          '@type': 'Offer',
          price: 0,
          priceCurrency: 'USD',
          seller: input.firstParty ? orgRef : undefined
        }
      : undefined
  }
}

interface SourceCodeInput {
  siteUrl: string
  id: string
  name: string
  codeRepository: string
  programmingLanguage?: string
  targetProductId?: string
}

function softwareSourceCodeNode(input: SourceCodeInput): JsonLdNode {
  return {
    '@type': 'SoftwareSourceCode',
    '@id': input.id,
    name: input.name,
    codeRepository: input.codeRepository,
    programmingLanguage: input.programmingLanguage,
    targetProduct: input.targetProductId
      ? { '@id': input.targetProductId }
      : undefined,
    author: { '@id': organizationId(input.siteUrl) }
  }
}

export function comfyUiSoftwareId(siteUrl: string): string {
  return `${siteUrl}/#software`
}

function comfyUiSourceCodeId(siteUrl: string): string {
  return `${siteUrl}/#sourcecode`
}

export function comfyUiApplicationNode(siteUrl: string): JsonLdNode {
  return softwareApplicationNode({
    siteUrl,
    id: comfyUiSoftwareId(siteUrl),
    name: 'ComfyUI',
    url: siteUrl,
    firstParty: true,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Windows, macOS, Linux',
    isFree: true,
    sameAs: comfyUiSameAs,
    mainEntityOfPage: `${siteUrl}/`,
    isBasedOnId: comfyUiSourceCodeId(siteUrl)
  })
}

export function comfyUiSourceCodeNode(siteUrl: string): JsonLdNode {
  return softwareSourceCodeNode({
    siteUrl,
    id: comfyUiSourceCodeId(siteUrl),
    name: 'ComfyUI',
    codeRepository: externalLinks.github,
    programmingLanguage: 'Python',
    targetProductId: comfyUiSoftwareId(siteUrl)
  })
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
  offers: OfferInput[]
}

export function productNode(input: ProductInput): JsonLdNode {
  return {
    '@type': 'Product',
    '@id': input.id,
    name: input.name,
    url: input.url,
    brand: { '@id': organizationId(input.siteUrl) },
    offers: input.offers.map((offer) => ({
      '@type': 'Offer',
      name: offer.name,
      price: offer.price,
      priceCurrency: 'USD',
      url: offer.url,
      seller: { '@id': organizationId(input.siteUrl) },
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: offer.price,
        priceCurrency: 'USD',
        unitText: 'MONTH'
      }
    }))
  }
}

export interface VideoObjectInput {
  siteUrl: string
  /** Fragment @id, typically jsonLdId(pageUrl, 'video'). */
  id: string
  pageUrl: string
  name: string
  description: string
  thumbnailUrl: string
  contentUrl: string
  uploadDate: string
  locale: Locale
  embedUrl?: string
}

export function videoObjectNode(input: VideoObjectInput): JsonLdNode {
  return {
    '@type': 'VideoObject',
    '@id': input.id,
    name: input.name,
    description: input.description,
    thumbnailUrl: input.thumbnailUrl,
    contentUrl: input.contentUrl,
    embedUrl: input.embedUrl,
    uploadDate: input.uploadDate,
    inLanguage: input.locale,
    publisher: { '@id': organizationId(input.siteUrl) },
    isPartOf: { '@id': jsonLdId(input.pageUrl, 'webpage') }
  }
}

export interface PageGraphInput {
  url: string
  name: string
  type?: WebPageType
  description?: string
  imageUrl?: string
  crumbs?: Crumb[]
  mainEntityId?: string
}

export function buildPageGraph(
  ctx: PageContext,
  page: PageGraphInput,
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
    websiteNode(ctx.siteUrl),
    webPageNode(input, type),
    hasCrumbs ? breadcrumbNode(page.url, page.crumbs!) : undefined,
    ...extraNodes
  )
}

export function collectGraphIds(value: unknown): {
  defined: Set<string>
  references: string[]
} {
  const defined = new Set<string>()
  const references: string[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>
      const id = record['@id']
      if (typeof id === 'string') {
        if (Object.keys(record).length === 1) references.push(id)
        else defined.add(id)
      }
      Object.values(record).forEach(walk)
    }
  }
  walk(value)
  return { defined, references }
}
