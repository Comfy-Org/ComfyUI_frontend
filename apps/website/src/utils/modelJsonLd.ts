import { withCatalogLocalePrefix } from '@/config/catalog-locales'
import { isIndexableModelPage } from '@/config/indexing'
import { launchedModelPages } from '@/config/model-page-launch'
import type { ModelPageLaunch } from '@/config/model-page-launch'
import type { ModelDeveloper } from '@/config/model-vendors'
import { modelsUrlKind } from '@/config/models-url-registry'
import { getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import type { Crumb, JsonLdNode } from './jsonLd'
import {
  absoluteUrl,
  itemListNode,
  jsonLdId,
  organizationId,
  softwareApplicationNode
} from './jsonLd'

interface ModelPageJsonLdInput {
  model: {
    name: string
    summary?: string
    thumbnail?: { url: string; kind: 'image' | 'video' | 'audio' }
  }
  useCaseLabel?: string
  url: string
  siteUrl: string
  developer?: ModelDeveloper
  price?: { usd: number; settings: string }
}

const usdFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  maximumSignificantDigits: 4,
  roundingPriority: 'morePrecision',
  useGrouping: false
})

function offerFor(price: ModelPageJsonLdInput['price']) {
  if (!price || !Number.isFinite(price.usd) || price.usd <= 0) return undefined
  const amount = usdFormat.format(price.usd)
  return {
    '@type': 'Offer',
    price: amount,
    priceCurrency: 'USD',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: amount,
      priceCurrency: 'USD',
      description: price.settings
    }
  }
}

export function modelPageJsonLd({
  model,
  useCaseLabel,
  url,
  siteUrl,
  developer,
  price
}: ModelPageJsonLdInput): {
  pageType: 'WebPage'
  mainEntityId: string
  breadcrumbs: Crumb[]
  extraJsonLd: JsonLdNode[]
} {
  const id = jsonLdId(url, 'software')
  const software = softwareApplicationNode({
    siteUrl,
    id,
    name: model.name,
    url,
    description: model.summary,
    applicationCategory: 'MultimediaApplication',
    applicationSubCategory: useCaseLabel,
    operatingSystem: 'Web',
    image: model.thumbnail?.kind === 'image' ? model.thumbnail.url : undefined,
    author: developer && {
      type: 'Organization',
      name: developer.name,
      url: developer.url,
      sameAs: developer.wikidata
        ? [`https://www.wikidata.org/wiki/${developer.wikidata}`]
        : undefined
    },
    mainEntityOfPage: url
  })
  return {
    pageType: 'WebPage',
    mainEntityId: id,
    breadcrumbs: [
      { name: t('breadcrumb.home'), url: `${siteUrl}/` },
      { name: t('workshop.title'), url: `${siteUrl}${getRoutes().workshop}` },
      { name: model.name }
    ],
    extraJsonLd: [
      {
        ...software,
        provider: { '@id': organizationId(siteUrl) },
        offers: offerFor(price)
      }
    ]
  }
}

interface ModelsHubJsonLdInput {
  /** The directory's models, in the order the page lists them. */
  models: readonly { name: string; href?: string }[]
  url: string
  siteUrl: string
  launched?: ModelPageLaunch
}

interface CollectionPageJsonLd {
  pageType: 'CollectionPage'
  mainEntityId?: string
  breadcrumbs: Crumb[]
  extraJsonLd: JsonLdNode[]
}

function collectionPageJsonLd(
  name: string,
  homeName: string,
  listed: { name: string; url: string }[],
  url: string,
  siteUrl: string
): CollectionPageJsonLd {
  const breadcrumbs = [{ name: homeName, url: `${siteUrl}/` }, { name }]
  if (listed.length === 0)
    return { pageType: 'CollectionPage', breadcrumbs, extraJsonLd: [] }
  return {
    pageType: 'CollectionPage',
    mainEntityId: jsonLdId(url, 'itemlist'),
    breadcrumbs,
    extraJsonLd: [itemListNode(url, name, listed)]
  }
}

export function modelsHubJsonLd({
  models,
  url,
  siteUrl,
  launched = launchedModelPages
}: ModelsHubJsonLdInput): CollectionPageJsonLd {
  const site = new URL(siteUrl)
  const listed = models.flatMap(({ name, href }) =>
    href !== undefined &&
    modelsUrlKind(href) === 'model' &&
    isIndexableModelPage(href, launched)
      ? [{ name, url: absoluteUrl(site, href) }]
      : []
  )
  return collectionPageJsonLd(
    t('workshop.title'),
    t('breadcrumb.home'),
    listed,
    url,
    siteUrl
  )
}

interface HubSectionJsonLdInput {
  name: string
  homeName: string
  /** The catalog records the list shows, in page order. */
  items: readonly { name: string; href: string }[]
  url: string
  siteUrl: string
  locale: string
}

export function hubSectionJsonLd({
  name,
  homeName,
  items,
  url,
  siteUrl,
  locale
}: HubSectionJsonLdInput): CollectionPageJsonLd {
  const site = new URL(siteUrl)
  const listed = items.map((item) => ({
    name: item.name,
    url: absoluteUrl(site, withCatalogLocalePrefix(item.href, locale))
  }))
  return collectionPageJsonLd(name, homeName, listed, url, siteUrl)
}
