import { describe, expect, it } from 'vitest'

import { MODEL_DEVELOPERS, modelDeveloper } from '../config/model-vendors'
import {
  getWorkshopPageDetail,
  workshopPagePaths
} from '../config/workshop-page-content'
import type { JsonLdNode } from './jsonLd'
import { modelPageJsonLd } from './modelJsonLd'

const siteUrl = 'https://comfy.org'
const url = 'https://comfy.org/models/example/'

const imageModel = {
  name: 'FLUX 2 Max Text-to-Image',
  summary: 'Generates an image from text.',
  thumbnail: { url: 'https://cdn.example/flux.png', kind: 'image' as const }
}
const videoModel = {
  name: 'Seedance 2.5 Text-to-Video',
  summary: 'Generates a video from text.',
  thumbnail: { url: 'https://cdn.example/seedance.mp4', kind: 'video' as const }
}

function software(
  input: Partial<Parameters<typeof modelPageJsonLd>[0]>
): JsonLdNode {
  const [node] = modelPageJsonLd({
    model: imageModel,
    url,
    siteUrl,
    developer: modelDeveloper('Black Forest Labs'),
    ...input
  }).extraJsonLd
  return node
}

describe('modelPageJsonLd', () => {
  it('describes the page as Home > Models > model with the app as main entity', () => {
    const result = modelPageJsonLd({
      model: imageModel,
      useCaseLabel: 'Generate images',
      url,
      siteUrl,
      developer: modelDeveloper('Black Forest Labs')
    })
    expect(result.pageType).toBe('WebPage')
    expect(result.mainEntityId).toBe(`${url}#software`)
    expect(result.breadcrumbs).toEqual([
      { name: 'Home', url: 'https://comfy.org/' },
      { name: 'Models', url: 'https://comfy.org/models/' },
      { name: 'FLUX 2 Max Text-to-Image' }
    ])
    expect(result.extraJsonLd[0]).toMatchObject({
      '@type': 'SoftwareApplication',
      '@id': `${url}#software`,
      name: 'FLUX 2 Max Text-to-Image',
      description: 'Generates an image from text.',
      applicationCategory: 'MultimediaApplication',
      applicationSubCategory: 'Generate images',
      operatingSystem: 'Web',
      provider: { '@id': 'https://comfy.org/#organization' },
      mainEntityOfPage: url,
      author: {
        '@type': 'Organization',
        name: 'Black Forest Labs',
        sameAs: ['https://www.wikidata.org/wiki/Q128801641']
      }
    })
  })

  it.for([
    ['an image thumbnail', imageModel, 'https://cdn.example/flux.png'],
    ['a video thumbnail', videoModel, undefined]
  ] as const)('sets image from %s', ([, model, image]) => {
    expect(software({ model }).image).toBe(image)
  })

  it.for([
    ['WaveSpeed, a host', 'WaveSpeed'],
    ['an unknown provider', 'Someone New'],
    ['no provider', undefined]
  ] as const)('omits the author for %s', ([, provider]) => {
    expect(software({ developer: modelDeveloper(provider) }).author).toBe(
      undefined
    )
  })

  it.for([
    ['no price', undefined, undefined],
    ['a zero price', 0, undefined],
    ['a sub-cent price, kept above $0', 0.57 / 211, '0.002701'],
    ['a non-finite price', Infinity, undefined],
    ['a dollar price, to the cent', 1.5, '1.5'],
    ['a large price, to the cent', 1234.5678, '1234.57']
  ] as const)('handles %s', ([, usd, price]) => {
    const node = software({
      price: usd === undefined ? undefined : { usd, settings: '1024x1024' }
    })
    expect(node.offers).toEqual(
      price === undefined ? undefined : expect.objectContaining({ price })
    )
  })

  it('states the priced settings on the offer', () => {
    expect(
      software({ price: { usd: 0.04, settings: '1024x1024' } }).offers
    ).toEqual({
      '@type': 'Offer',
      price: '0.04',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '0.04',
        priceCurrency: 'USD',
        description: '1024x1024'
      }
    })
  })
})

describe('MODEL_DEVELOPERS', () => {
  it('has a row for every catalogue provider', () => {
    const providers = new Set(
      workshopPagePaths.flatMap(
        (slug) => getWorkshopPageDetail(slug)?.provider ?? []
      )
    )
    expect(
      [...providers].filter((p) => !Object.hasOwn(MODEL_DEVELOPERS, p))
    ).toEqual([])
  })

  it('links only well-formed Wikidata ids', () => {
    for (const developer of Object.values(MODEL_DEVELOPERS))
      if (developer?.wikidata) expect(developer.wikidata).toMatch(/^Q\d+$/)
  })
})
