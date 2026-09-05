import type { WorkshopDetailModel } from './workshop-detail'
import type { WorkshopBrowseModel } from './workshop'
import { WORKSHOP_INITIAL_MODEL_LIMIT } from './workshop'
import type { Crumb, JsonLdNode } from '../utils/jsonLd'
import {
  absoluteUrl,
  itemListNode,
  jsonLdId,
  softwareApplicationNode
} from '../utils/jsonLd'

interface WorkshopCatalogSeoInput {
  site: URL | undefined
  url: string
  title: string
  workshopName: string
  homeName: string
  models: readonly WorkshopBrowseModel[]
}

interface WorkshopModelSeoInput {
  site: URL | undefined
  siteUrl: string
  url: string
  workshopName: string
  homeName: string
  model: WorkshopDetailModel
}

export interface WorkshopSeo {
  mainEntityId: string
  breadcrumbs: Crumb[]
  extraJsonLd: JsonLdNode[]
}

export function workshopCatalogSeo({
  site,
  url,
  title,
  workshopName,
  homeName,
  models
}: WorkshopCatalogSeoInput): WorkshopSeo {
  const mainEntityId = jsonLdId(url, 'itemlist')
  return {
    mainEntityId,
    breadcrumbs: [
      { name: homeName, url: absoluteUrl(site, '/') },
      { name: workshopName }
    ],
    extraJsonLd: [
      itemListNode(
        url,
        title,
        models.slice(0, WORKSHOP_INITIAL_MODEL_LIMIT).map((model) => ({
          url: absoluteUrl(site, model.href),
          name: model.name
        })),
        mainEntityId
      )
    ]
  }
}

export function workshopModelSeo({
  site,
  siteUrl,
  url,
  workshopName,
  homeName,
  model
}: WorkshopModelSeoInput): WorkshopSeo {
  const mainEntityId = jsonLdId(url, 'software')
  return {
    mainEntityId,
    breadcrumbs: [
      { name: homeName, url: absoluteUrl(site, '/') },
      { name: workshopName, url: absoluteUrl(site, '/workshop') },
      { name: model.displayName }
    ],
    extraJsonLd: [
      softwareApplicationNode({
        siteUrl,
        id: mainEntityId,
        name: model.displayName,
        url,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Any',
        description: model.description
      })
    ]
  }
}
