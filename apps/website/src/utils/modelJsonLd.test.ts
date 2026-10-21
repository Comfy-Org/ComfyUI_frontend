import { describe, expect, it, onTestFinished, vi } from 'vitest'

import type { ModelPageLaunch } from '@/config/model-page-launch'
import { MODEL_DEVELOPERS, modelDeveloper } from '@/config/model-vendors'
import { modelsUrlKind, modelsUrlPaths } from '@/config/models-url-registry'
import { workshopModels } from '@/config/workshop-browse-content'
import {
  getWorkshopPageDetail,
  workshopPagePaths
} from '@/config/workshop-page-content'
import { validateHtml } from '@website/scripts/validate-jsonld'
import { escapeJsonLd } from './escapeJsonLd'
import type { JsonLdNode } from './jsonLd'
import { buildPageGraph } from './jsonLd'
import {
  hubSectionJsonLd,
  modelPageJsonLd,
  modelsHubJsonLd
} from './modelJsonLd'
import { modelsByProvider } from '@/routes/models/models-directory'

const launch = vi.hoisted(
  (): {
    launchedModelPages: ModelPageLaunch
    launchedWorkflowPages: boolean
  } => ({
    launchedModelPages: 'all',
    launchedWorkflowPages: false
  })
)
vi.mock(import('@/config/model-page-launch'), () => launch)

const siteUrl = 'https://comfy.org'
const url = 'https://comfy.org/hub/models/example/'

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
      { name: 'Models', url: 'https://comfy.org/hub/models/' },
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
        url: 'https://bfl.ai/',
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

describe('modelsHubJsonLd', () => {
  const hubUrl = 'https://comfy.org/hub/models/'
  const directoryModels = modelsByProvider(workshopModels, 'Other').flatMap(
    (group) => group.models
  )
  const directoryUrls = directoryModels.flatMap(({ href }) =>
    href === undefined ? [] : [`${siteUrl}${href}`]
  )
  const [workflowPath] = modelsUrlPaths('workflow')

  function listedUrls(
    models: Parameters<typeof modelsHubJsonLd>[0]['models'],
    launched: ModelPageLaunch = 'all'
  ) {
    return modelsHubJsonLd({
      models,
      url: hubUrl,
      siteUrl,
      launched
    }).extraJsonLd.flatMap(({ itemListElement }) =>
      Array.isArray(itemListElement)
        ? itemListElement.map((element: { url: string }) => element.url)
        : []
    )
  }

  it('lists every directory link, in the order the directory shows them', () => {
    const { pageType, mainEntityId, extraJsonLd } = modelsHubJsonLd({
      models: directoryModels,
      url: hubUrl,
      siteUrl,
      launched: 'all'
    })
    expect(directoryUrls.length).toBeGreaterThan(0)
    expect(pageType).toBe('CollectionPage')
    expect(mainEntityId).toBe(`${hubUrl}#itemlist`)
    expect(extraJsonLd[0]).toMatchObject({
      '@type': 'ItemList',
      numberOfItems: directoryUrls.length
    })
    expect(listedUrls(directoryModels)).toEqual(directoryUrls)
  })

  it('lists only absolute, unique model page URLs from the registry', () => {
    const urls = listedUrls(directoryModels)
    expect(new Set(urls).size).toBe(urls.length)
    expect(
      urls.map((listed) => {
        const { origin, pathname } = new URL(listed)
        return {
          origin,
          trailingSlash: pathname.endsWith('/'),
          kind: modelsUrlKind(pathname)
        }
      })
    ).toEqual(
      urls.map(() => ({ origin: siteUrl, trailingSlash: true, kind: 'model' }))
    )
  })

  it('leaves out a launched workflow page and links that are not model pages', () => {
    const [listedModel] = directoryModels
    expect(workflowPath).toBeDefined()
    launch.launchedWorkflowPages = true
    onTestFinished(() => {
      launch.launchedWorkflowPages = false
    })
    expect(
      listedUrls([
        { name: 'No page' },
        { name: 'Workflow', href: workflowPath },
        { name: 'Unknown', href: '/hub/models/not-a-model/' },
        listedModel
      ])
    ).toEqual([`${siteUrl}${listedModel.href}`])
  })

  it('lists only the model pages the launch keeps', () => {
    const [kept] = directoryModels
    const dropped = directoryModels
      .filter(({ routerId }) => routerId !== kept.routerId)
      .slice(0, 1)
    expect(dropped).toHaveLength(1)
    expect(listedUrls([kept, ...dropped], new Set([kept.routerId]))).toEqual([
      `${siteUrl}${kept.href}`
    ])
  })

  it('resolves a link without a trailing slash to the canonical page URL', () => {
    const [model] = directoryModels
    expect(
      listedUrls([{ name: model.name, href: model.href?.replace(/\/$/, '') }])
    ).toEqual([`${siteUrl}${model.href}`])
  })

  it('keeps the Home > Models breadcrumb but drops the list when nothing is listed', () => {
    expect(modelsHubJsonLd({ models: [], url: hubUrl, siteUrl })).toEqual({
      pageType: 'CollectionPage',
      breadcrumbs: [
        { name: 'Home', url: 'https://comfy.org/' },
        { name: 'Models' }
      ],
      extraJsonLd: []
    })
  })
})

describe('hubSectionJsonLd', () => {
  const records = [
    { name: 'Product Photo Relight', href: '/hub/workflows/product-relight/' },
    { name: 'Sketch to Render', href: '/hub/workflows/sketch-to-render/' }
  ]

  function sectionHtml(pathname: string, locale: 'en' | 'zh-CN') {
    const url = `${siteUrl}${pathname}`
    const jsonLd = hubSectionJsonLd({
      name: 'ComfyUI workflows',
      homeName: 'Home',
      items: records,
      url,
      siteUrl,
      locale
    })
    const graph = buildPageGraph(
      { siteUrl, locale },
      {
        url,
        name: 'ComfyUI workflows',
        type: jsonLd.pageType,
        crumbs: jsonLd.breadcrumbs,
        mainEntityId: jsonLd.mainEntityId
      },
      ...jsonLd.extraJsonLd
    )
    return {
      jsonLd,
      html: `<link rel="canonical" href="${url}"><script type="application/ld+json">${escapeJsonLd(graph)}</script>`
    }
  }

  it.for([
    { locale: 'en', prefix: '' },
    { locale: 'zh-CN', prefix: '/zh-CN' }
  ] as const)(
    'lists each $locale record as a valid ItemList on a CollectionPage',
    ({ locale, prefix }) => {
      const pathname = `${prefix}/hub/workflows/`
      const { jsonLd, html } = sectionHtml(pathname, locale)
      expect(validateHtml(html, pathname)).toEqual([])
      expect(jsonLd.pageType).toBe('CollectionPage')
      expect(jsonLd.mainEntityId).toBe(`${siteUrl}${pathname}#itemlist`)
      expect(jsonLd.extraJsonLd).toEqual([
        expect.objectContaining({
          '@type': 'ItemList',
          name: 'ComfyUI workflows',
          numberOfItems: 2,
          itemListElement: records.map(({ name, href }, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name,
            url: `${siteUrl}${prefix}${href}`
          }))
        })
      ])
    }
  )

  it('keeps the breadcrumb but drops the list when the page has no records', () => {
    expect(
      hubSectionJsonLd({
        name: 'ComfyUI apps',
        homeName: 'Home',
        items: [],
        url: `${siteUrl}/hub/apps/`,
        siteUrl,
        locale: 'en'
      })
    ).toEqual({
      pageType: 'CollectionPage',
      breadcrumbs: [
        { name: 'Home', url: 'https://comfy.org/' },
        { name: 'ComfyUI apps' }
      ],
      extraJsonLd: []
    })
  })
})
