import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  RouterWorkshopModelDetail,
  WorkshopModelDetail
} from '@/config/models-catalogue'
import { workshopContractSchema } from '@/config/workshop-contract'
import { prepareModelPage } from './model-page'

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  pages: [] as WorkshopModelDetail[],
  successor: vi.fn(),
  price: vi.fn()
}))
vi.mock(import('@/config/workshop-page-content'), () => ({
  getWorkshopPageDetail: mocks.lookup,
  workshopPages: mocks.pages
}))
vi.mock(import('@/config/workshop-node-pricing'), () => ({
  estimateWorkshopNodePrice: mocks.price
}))
vi.mock(import('@/config/workshop-browse-content'), () => ({
  getWorkshopModel: mocks.successor,
  workshopModels: []
}))

const model: RouterWorkshopModelDetail = {
  slug: 'provider--model--generate-images',
  name: 'Example Model',
  href: '/models/provider--model--generate-images/',
  routerId: 'provider/model',
  workflowCount: 1,
  provider: 'Example Provider',
  modality: 'image',
  capabilities: ['Image & text'],
  fields: [],
  examples: [],
  defaults: {}
}

beforeEach(() => {
  mocks.lookup.mockReturnValue(model)
  mocks.pages.length = 0
  mocks.price.mockResolvedValue(undefined)
  mocks.successor.mockReturnValue(undefined)
})

describe('Models route preparation', () => {
  it('canonicalizes aliases before evaluating prices or provider rows', async () => {
    expect(await prepareModelPage('old-alias')).toEqual({
      kind: 'redirect',
      href: model.href
    })
    expect(mocks.price).not.toHaveBeenCalled()
  })

  it('does not invent a price or successor, and encodes capability searches', async () => {
    const page = await prepareModelPage(model.slug)
    expect(page).toMatchObject({
      kind: 'page',
      priceEstimate: undefined,
      successor: undefined,
      providerModels: []
    })
    if (page.kind !== 'page') throw new Error('Expected canonical page')
    expect(new URLSearchParams(page.tags[0].search).get('q')).toBe(
      'Image & text'
    )
  })

  it.for([
    ['zero tags', [], [], [], 0],
    [
      'exactly three tags',
      ['One', 'Two', 'Three'],
      ['One', 'Two', 'Three'],
      [],
      0
    ],
    [
      'more than three tags',
      ['One', 'Two', 'Three', 'Four'],
      ['One', 'Two', 'Three'],
      ['Four'],
      1
    ]
  ] as const)(
    'splits %s for the visible row and overflow control',
    async ([, capabilities, shown, rest, restTagCount]) => {
      mocks.lookup.mockReturnValue({ ...model, capabilities })

      const page = await prepareModelPage(model.slug)

      if (page.kind !== 'page') throw new Error('Expected canonical page')
      expect(page.shownTags.map((tag) => tag.label)).toEqual(shown)
      expect(page.restTags.map((tag) => tag.label)).toEqual(rest)
      expect(page.restTagCount).toBe(restTagCount)
    }
  )

  it('shows only capability tags, in their original order', async () => {
    mocks.lookup.mockReturnValue({
      ...model,
      name: 'FLUX 2 Max Text-to-Image',
      provider: 'Black Forest Labs',
      capabilities: [
        'bfl',
        'flux',
        'high-detail',
        'flux-2',
        'text-to-image',
        'premium'
      ]
    })

    const page = await prepareModelPage(model.slug)

    if (page.kind !== 'page') throw new Error('Expected canonical page')
    expect(page.tags.map((tag) => tag.label)).toEqual([
      'high-detail',
      'text-to-image',
      'premium'
    ])
  })

  it("lists the provider's other model pages, most recommended first, with what each offers", async () => {
    const sibling = (
      slug: string,
      fields: Partial<RouterWorkshopModelDetail> = {}
    ): RouterWorkshopModelDetail => ({
      ...model,
      slug,
      name: slug,
      href: `/hub/models/${slug}/`,
      routerId: `provider/${slug}`,
      ...fields
    })
    mocks.pages.push(
      model,
      sibling('video', {
        recommendedRank: 1,
        resolutions: ['1080p', '480p'],
        execution: workshopContractSchema.parse({
          id: 'provider/video',
          sourceCommit: 'a'.repeat(40),
          inputSchema: {
            properties: {
              duration: { type: 'integer', minimum: -1, maximum: 15 }
            }
          },
          output: {
            format: 'binary',
            kind: 'video',
            contentTypes: ['video/mp4']
          }
        })
      }),
      sibling('still', { recommendedRank: 0, resolutions: ['2K'] }),
      sibling('elsewhere', { provider: 'Someone Else' }),
      sibling('no-page', { href: undefined })
    )
    mocks.lookup.mockImplementation((slug: string) =>
      mocks.pages.find((page) => page.slug === slug)
    )
    mocks.price.mockImplementation(async (other: WorkshopModelDetail) =>
      other.slug === 'still' ? '~9.5 credits/Image' : undefined
    )

    const page = await prepareModelPage(model.slug)

    if (page.kind !== 'page') throw new Error('Expected canonical page')
    expect(page.providerModels).toEqual([
      {
        slug: 'still',
        name: 'still',
        href: '/hub/models/still/',
        provider: 'Example Provider',
        price: '~9.5 credits/Image',
        resolution: '2K'
      },
      {
        slug: 'video',
        name: 'video',
        href: '/hub/models/video/',
        provider: 'Example Provider',
        resolution: '480p – 1080p',
        duration: { max: 15 }
      }
    ])
  })

  it('lists no rows for a model without a provider', async () => {
    mocks.lookup.mockReturnValue({ ...model, provider: undefined })
    mocks.pages.push({ ...model, slug: 'other', provider: undefined })

    const page = await prepareModelPage(model.slug)

    if (page.kind !== 'page') throw new Error('Expected canonical page')
    expect(page.providerModels).toEqual([])
  })

  it('localizes headings and carries the resolved successor and estimate', async () => {
    mocks.lookup.mockReturnValue({ ...model, successorSlug: 'new-model' })
    const successor = { ...model, slug: 'new-model', name: 'New Model' }
    mocks.successor.mockReturnValue(successor)
    mocks.price.mockResolvedValue('4–8 credits')
    const page = await prepareModelPage(model.slug, 'zh-CN')
    expect(page).toMatchObject({
      kind: 'page',
      successor,
      priceEstimate: '4–8 credits',
      useCaseLabel: '生成图像'
    })
    expect(mocks.successor).toHaveBeenCalledWith('new-model')
  })

  it.for(['old-alias', model.slug])(
    'fails the build when %s resolves to a model with no page',
    async (slug) => {
      mocks.lookup.mockReturnValue({ ...model, href: undefined })
      await expect(prepareModelPage(slug)).rejects.toThrow(
        `Models route ${slug} resolved to ${model.slug}, which has no page`
      )
    }
  )

  it('fails an unknown or missing route explicitly', async () => {
    mocks.lookup.mockReturnValue(undefined)
    await expect(prepareModelPage('unknown')).rejects.toThrow(
      'Unknown Models route: unknown'
    )
    await expect(prepareModelPage(undefined)).rejects.toThrow(
      'Unknown Models route: (missing)'
    )
  })
})
