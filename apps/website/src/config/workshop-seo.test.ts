import { describe, expect, it } from 'vitest'

import type { WorkshopDetailModel } from './workshop-detail'
import type { WorkshopBrowseModel } from './workshop'
import { WORKSHOP_INITIAL_MODEL_LIMIT } from './workshop'
import { workshopCatalogSeo, workshopModelSeo } from './workshop-seo'

const site = new URL('https://comfy.org/')

function browseModel(index: number): WorkshopBrowseModel {
  return {
    id: `provider/model-${index}`,
    slug: `provider--model-${index}`,
    href: `/workshop/models/provider--model-${index}/`,
    name: `Model ${index}`,
    provider: 'provider',
    output: 'image',
    description: 'Description',
    tags: []
  }
}

const detailModel: WorkshopDetailModel = {
  id: 'bfl/flux',
  slug: 'bfl--flux',
  displayName: 'Flux',
  provider: 'bfl',
  modality: 'image',
  description: 'Generate an image',
  tags: [],
  fields: []
}

describe('Workshop SEO builders', () => {
  it('describes only the models initially visible in the catalog', () => {
    const seo = workshopCatalogSeo({
      site,
      url: 'https://comfy.org/workshop/',
      title: 'Comfy Workshop',
      workshopName: 'Workshop',
      homeName: 'Home',
      models: Array.from({ length: 50 }, (_, index) => browseModel(index))
    })

    expect(seo.mainEntityId).toBe('https://comfy.org/workshop/#itemlist')
    expect(seo.breadcrumbs.at(-1)?.name).toBe('Workshop')
    expect(seo.extraJsonLd[0]).toMatchObject({
      '@id': seo.mainEntityId,
      numberOfItems: WORKSHOP_INITIAL_MODEL_LIMIT
    })
    expect(seo.extraJsonLd[0].itemListElement).toHaveLength(
      WORKSHOP_INITIAL_MODEL_LIMIT
    )
  })

  it('emits honest application metadata and matching references', () => {
    const seo = workshopModelSeo({
      site,
      siteUrl: 'https://comfy.org',
      url: 'https://comfy.org/workshop/models/bfl--flux/',
      workshopName: 'Workshop',
      homeName: 'Home',
      model: detailModel
    })

    expect(seo.breadcrumbs).toEqual([
      { name: 'Home', url: 'https://comfy.org/' },
      { name: 'Workshop', url: 'https://comfy.org/workshop/' },
      { name: 'Flux' }
    ])
    expect(seo.extraJsonLd[0]).toMatchObject({
      '@type': 'SoftwareApplication',
      '@id': seo.mainEntityId,
      name: 'Flux',
      operatingSystem: 'Any'
    })
    expect(JSON.parse(JSON.stringify(seo.extraJsonLd[0]))).not.toHaveProperty(
      'author'
    )
  })
})
