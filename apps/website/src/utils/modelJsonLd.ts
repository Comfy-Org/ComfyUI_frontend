import type { ModelDeveloper } from '../config/model-vendors'
import { t } from '../i18n/translations'
import type { Crumb, JsonLdNode } from './jsonLd'
import { jsonLdId, organizationId, softwareApplicationNode } from './jsonLd'

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
      { name: t('workshop.title'), url: `${siteUrl}/models/` },
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
