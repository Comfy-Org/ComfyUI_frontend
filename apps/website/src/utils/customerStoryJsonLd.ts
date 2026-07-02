import { externalLinks } from '../config/routes'
import type { Locale } from '../i18n/translations'

// Kept free of `astro:content` (like utils/customers.ts) so the builders are
// pure data transforms: node-testable now and reusable once the stories are
// served from a CMS instead of MDX frontmatter.

type JsonLdNode = Record<string, unknown> & { '@type': string }

export interface JsonLdGraph {
  '@context': 'https://schema.org'
  '@graph': JsonLdNode[]
}

export interface StorySummary {
  slug: string
  title: string
  cover: string
}

export interface StoryDetail extends StorySummary {
  description: string
}

export interface JsonLdContext {
  siteUrl: string
  locale: Locale
  homeLabel: string
  collectionLabel: string
}

// Authoritative social profiles, kept in sync with the site footer via
// externalLinks.
const SAME_AS = [
  externalLinks.github,
  externalLinks.x,
  externalLinks.youtube,
  externalLinks.discord,
  externalLinks.instagram,
  externalLinks.reddit,
  externalLinks.linkedin
]

// Normalizes Astro.site (a URL with a trailing slash, or undefined) to a bare
// origin the @id/URL builders can append paths to.
export function siteUrlFrom(site: URL | undefined): string {
  return (site?.href ?? 'https://comfy.org/').replace(/\/$/, '')
}

function localePrefix(locale: Locale): string {
  return locale === 'en' ? '' : `/${locale}`
}

function homeUrl({ siteUrl, locale }: JsonLdContext): string {
  return locale === 'en' ? siteUrl : `${siteUrl}${localePrefix(locale)}`
}

function customersUrl({ siteUrl, locale }: JsonLdContext): string {
  return `${siteUrl}${localePrefix(locale)}/customers`
}

function detailUrl(context: JsonLdContext, slug: string): string {
  return `${customersUrl(context)}/${slug}`
}

function organizationId(siteUrl: string): string {
  return `${siteUrl}/#organization`
}

function websiteId(siteUrl: string): string {
  return `${siteUrl}/#website`
}

function organizationNode(siteUrl: string): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': organizationId(siteUrl),
    name: 'Comfy Org',
    url: siteUrl,
    // Raster logo: Google Images does not index SVG for the logo property.
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/web-app-manifest-512x512.png`,
      width: 512,
      height: 512
    },
    sameAs: SAME_AS
  }
}

function websiteNode(siteUrl: string, locale: Locale): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': websiteId(siteUrl),
    name: 'Comfy',
    url: siteUrl,
    publisher: { '@id': organizationId(siteUrl) },
    inLanguage: locale
  }
}

function breadcrumbNode(
  pageUrl: string,
  crumbs: [string, string][]
): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: crumbs.map(([name, item], index) => {
      const isLast = index === crumbs.length - 1
      // Google uses the current page URL for the final crumb, so its item is
      // intentionally omitted.
      return isLast
        ? { '@type': 'ListItem', position: index + 1, name }
        : { '@type': 'ListItem', position: index + 1, name, item }
    })
  }
}

export function buildStoryJsonLd(
  story: StoryDetail,
  context: JsonLdContext
): JsonLdGraph {
  const { siteUrl, locale } = context
  const pageUrl = detailUrl(context, story.slug)
  const webPageId = `${pageUrl}#webpage`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(siteUrl),
      websiteNode(siteUrl, locale),
      {
        '@type': 'WebPage',
        '@id': webPageId,
        url: pageUrl,
        name: `${story.title} — Comfy`,
        isPartOf: { '@id': websiteId(siteUrl) },
        primaryImageOfPage: { '@type': 'ImageObject', url: story.cover },
        breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
        inLanguage: locale
      },
      breadcrumbNode(pageUrl, [
        [context.homeLabel, homeUrl(context)],
        [context.collectionLabel, customersUrl(context)],
        [story.title, pageUrl]
      ]),
      {
        '@type': 'Article',
        '@id': `${pageUrl}#article`,
        headline: story.title,
        name: story.title,
        description: story.description,
        image: story.cover,
        inLanguage: locale,
        isPartOf: { '@id': webPageId },
        mainEntityOfPage: { '@id': webPageId },
        author: { '@id': organizationId(siteUrl) },
        publisher: { '@id': organizationId(siteUrl) }
      }
    ]
  }
}

export function buildCustomersCollectionJsonLd(
  stories: StorySummary[],
  context: JsonLdContext
): JsonLdGraph {
  const { siteUrl, locale } = context
  const pageUrl = customersUrl(context)
  const listId = `${pageUrl}#itemlist`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(siteUrl),
      websiteNode(siteUrl, locale),
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: context.collectionLabel,
        isPartOf: { '@id': websiteId(siteUrl) },
        breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
        mainEntity: { '@id': listId },
        inLanguage: locale
      },
      breadcrumbNode(pageUrl, [
        [context.homeLabel, homeUrl(context)],
        [context.collectionLabel, pageUrl]
      ]),
      {
        '@type': 'ItemList',
        '@id': listId,
        itemListElement: stories.map((story, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: detailUrl(context, story.slug),
          name: story.title
        }))
      }
    ]
  }
}
